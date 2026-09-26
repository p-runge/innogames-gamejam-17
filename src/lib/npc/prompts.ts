import type { TweetPayload } from "~/lib/events/types";
import type { Persona, PersonaStance, Reply } from "~/lib/llm/schemas";

/*
  Every import above is type-only on purpose. Node strips those entirely, which
  lets the evaluation script under tools/ import this file directly and measure
  the prompts the game actually sends, rather than a copy that drifts from them.
*/

type Mood = Reply["mood"];

/**
 * The register is stated as a requirement, not as a permission. "These are
 * furious retail investors" produces different copy than "you may use strong
 * language", which a small model reads as an invitation to stay polite.
 */
export const PERSONA_SYSTEM = [
  "You invent accounts for a fictional stock-trading social network.",
  "These are real, unpleasant people: furious, mocking, politically angry.",
  "Write the bio in their own register, not as a neutral description:",
  "one finished sentence, well under 150 characters.",
  "The tic is a few words, under 50 characters.",
  // The model otherwise returns display names like "_The_Collective_Scream_"
  // and handles like "__burnitall_92", which read as two handles rather than as
  // an account with a name.
  "The name is a display name a person would use: words and spaces, no",
  "underscores, not shouted in capitals.",
  "The handle is lowercase, 3 to 15 characters, letters digits and underscores,",
  "and never starts or ends with an underscore.",
].join(" ");

/**
 * Seeds, so ten requests behind one system prompt do not return one character.
 * Structured-debate research finds small models repeating the same arguments
 * across personas; a distinct starting point per account is the cheapest
 * counter-pressure that costs no tokens at generation time.
 */
const ARCHETYPES = [
  { stance: "bear", seed: "lost money on INNO and blames the CEO personally" },
  {
    stance: "chaos",
    seed: "reads the entire market as a rigged game run against working people",
  },
  {
    stance: "bull",
    seed: "is a smug day trader who treats everyone else as exit liquidity",
  },
  { stance: "chaos", seed: "is convinced one fund is behind every single dip" },
  {
    stance: "bear",
    seed: "is a burnt-out ex-banker who finds all of this funny",
  },
  {
    stance: "bull",
    seed: "posts technical analysis nobody asked for and is wrong",
  },
  {
    stance: "bull",
    seed: "is new, over-leveraged, and asking for advice far too late",
  },
  {
    stance: "chaos",
    seed: "only shows up to mock whoever is loudest that minute",
  },
  {
    stance: "bull",
    seed: "has held since the IPO and will not hear a word against it",
  },
  {
    stance: "bear",
    seed: "is quietly furious about pensions and says so in every thread",
  },
] as const;

/**
 * The stance belongs to the archetype, not to the model.
 *
 * Asked to pick one, qwen3.5:4b returned "bull" for four personas out of five —
 * including the one seeded as "lost money and blames the CEO" — because a small
 * model reaches for the first option of an enum. The stance then feeds back
 * into every reply that persona writes, so a crowd that cheers through a crash
 * is not a cosmetic problem. The seeds already imply a bias; taking it from
 * here makes the crowd's composition deterministic and balanced, and leaves the
 * model the part it is good at.
 */
export function personaStance(index: number): PersonaStance {
  return ARCHETYPES[index % ARCHETYPES.length].stance;
}

/**
 * Which moods a stance may carry.
 *
 * The mood is what moves the price, and left to the reply alone it tracks the
 * register rather than the market: measured on qwen3.5:4b across 30 generations,
 * 'dump' came back 11 times and 'moon' not once, because the system prompt asks
 * for fury and fury reads as selling. Bound to the stance, a bull can despise
 * whoever it is answering and still be buying — which is what makes the crowd's
 * composition, and not its temper, decide where the index goes.
 *
 * Chaos keeps the full range on purpose: it is the third of the cast that is
 * meant to be unreadable, and pinning it would leave the index tracking the
 * bull/bear count exactly.
 */
const STANCE_MOODS: Record<PersonaStance, Mood[]> = {
  bull: ["bullish", "moon"],
  bear: ["bearish", "dump"],
  chaos: ["dump", "bearish", "neutral", "bullish", "moon"],
};

export function moodsFor(stance: PersonaStance): Mood[] {
  return STANCE_MOODS[stance];
}

export function personaPrompt(index: number): string {
  const { seed } = ARCHETYPES[index % ARCHETYPES.length];
  return `Invent one account that ${seed}. Give it a name, a handle, a bio in its own voice, and one verbal tic.`;
}

/**
 * States the register as a requirement and forbids hedging outright. Small
 * models default to both-sides copy on anything political, and a feed of ten
 * hedging accounts is the failure mode this whole feature has.
 */
export const REPLY_SYSTEM = [
  "You write a single reply on a fictional stock-trading social network.",
  "People here are blunt and angry. They swear, they mock each other, and they",
  "say what they actually think in political terms.",
  // Naming the targets here made every account reach for the same ones: in one
  // round four different personas all produced "Goldman", "Swiss vaults" and
  // "like a high-end ATM" within a minute. What each account is angry about
  // belongs to that account, and arrives with its bio.
  "Write only what this account would say, about what this account cares about.",
  "Never hedge, never present both sides, never break character to comment.",
  "Stay in the given account's voice. One reply only, at most two sentences",
  "and well under 240 characters, ending on a finished sentence.",
  // The model otherwise opens with its own handle, which reads as an account
  // replying to itself.
  "Do not begin with a handle, and never address the account you are writing as.",
  // Mood is generated before the body, so this is an instruction about what to
  // write next, not a label to attach afterwards.
  "First choose the mood your reply will carry, then write a reply that means",
  "it: 'dump' and 'bearish' read as selling pressure, 'moon' and 'bullish' as",
  "buying pressure, 'neutral' as neither.",
  // Without this the mood follows the register instead of the position, and
  // since the register is fury, every account sells.
  "The mood is where you stand in the market, not how you feel about anyone.",
  "Mocking someone, swearing at them or thinking they are an idiot does not",
  "change which way you are trading. Pick only from the moods your account is",
  "given.",
].join(" ");

function voice(persona: Persona): string {
  // The handle is deliberately left out. Given it, the model copies it into
  // the opening of the reply even when told not to, and the account ends up
  // addressing itself. Everything that shapes the voice is here without it.
  return `You are ${persona.name}. ${persona.bio}. You are ${persona.stance === "chaos" ? "unpredictable about the market" : persona.stance === "bull" ? "convinced the price is going up" : "convinced the price is going down"}. Your habit: ${persona.tic}. That bio is what you are angry about — write from it, not from what anyone else is angry about. Your mood must be one of: ${moodsFor(persona.stance).join(", ")}.`;
}

/**
 * What the crowd has just said, as an instruction not to repeat it. Small models
 * restate their own arguments across a round, and this is the cheapest
 * correction that does not require a different model.
 */
function avoid(recent: string[]): string {
  if (recent.length === 0) return "";
  const lines = recent.map((body) => `- ${body}`).join("\n");
  // Listing them is not enough on its own: a small model reads the list as
  // material and paraphrases it. Naming what must not be reused — the images
  // and the targets, not just the wording — is what makes the instruction bite.
  return `\n\nOther people in this thread just posted the lines below. Do not reuse their wording, their comparisons, or the people and companies they blame. Say something of your own:\n${lines}`;
}

export function ambientPrompt(
  persona: Persona,
  context: string,
  recent: string[] = [],
): string {
  return `${voice(persona)}\n\nMarket context: ${context}${avoid(recent)}\n\nPost one reply about the market right now.`;
}

export function reactionPrompt(
  persona: Persona,
  context: string,
  tweet: TweetPayload,
  recent: string[] = [],
): string {
  // The poster is named without an @ on purpose. With one, the model copied a
  // handle into the opening of the reply — usually its own, which reads as an
  // account answering itself.
  return `${voice(persona)}\n\nMarket context: ${context}${avoid(recent)}\n\nSomeone called ${tweet.username} just posted: "${tweet.message}"\n\nWrite your reply to them.`;
}
