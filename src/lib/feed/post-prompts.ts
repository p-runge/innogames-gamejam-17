import type { Mood } from "~/lib/market/types";

/*
  The import above is type-only on purpose. Node strips those entirely, which lets
  an evaluation script under tools/ import this file directly and measure the
  prompt the game actually sends, rather than a copy that drifts from it.
*/

/**
 * Who is posting, and how.
 *
 * The stake is the first thing stated, because it is what makes the lines sound
 * like anything. Asked for "a post about a stock" a 4B model writes a spectator's
 * comment — balanced, mildly amused, about the company. Told the rent is in it,
 * the same model writes a person.
 *
 * Every style rule below is a habit of that model named explicitly: it
 * capitalises, it finishes sentences, it hedges, it writes twice the length asked
 * for, and it reaches for hashtags the moment anything sounds like a meme. Naming
 * the habit is the only thing that reliably suppresses it.
 */
export const POST_SYSTEM = [
  "You are a small retail trader posting on a fictional stock-trading social",
  "network. Everything you have is in one stock, INNO: your savings, your rent,",
  "money you had no business putting in. You are not commenting on this stock,",
  "you are living inside it — it decides how your month goes.",
  "You post like the feed does: all lowercase, no capital letters anywhere,",
  "clipped fragments rather than sentences, no full stop at the end. Funny",
  "because it is bleak, not because you are making jokes.",
  "Use the feed's own words — bags, bagholder, rug, pumping, dumping, diamond",
  "hands, paper hands, margin call, liquidated, exit liquidity, cooked, down bad,",
  "it's over, we're so back, my life savings, rent money. Use at most one of them",
  "per post and vary which one, or you sound like a bot.",
  "Money is personal ruin, never analysis: the rent, the flat, the car you sold,",
  "what you will tell your mum. Never give a number, a percentage, a price or a",
  "target.",
  "Never give advice, never explain the market, never predict in so many words.",
  "You are shouting into a feed, not writing a note.",
  "No hashtags, no @handles, no quotation marks, no emoji, no links.",
  "At most 12 words. One line. Never mention that you are an AI.",
].join(" ");

/**
 * What the post has to carry, per mood.
 *
 * The mood is the player's choice and the price impulse is already decided from
 * it, so the line has to actually sound like that feeling — a "moon" line that
 * reads as doubt would push the price up while telling the player the opposite.
 * Each brief is a state of mind rather than a market call, because asked for the
 * call the model writes the call.
 *
 * All five are written from inside the position, not next to it: the difference
 * between "this looks weak" and "this is my rent".
 */
const BRIEF: Record<Mood, string> = {
  dump: [
    "you are being wiped out right now. this was the rent.",
    "full panic, no composure left, it is over and everyone should run.",
  ].join(" "),
  bearish: [
    "you are sour and you saw this coming. the trap is obvious to you and",
    "nobody listened. you are still holding, which is the worst part.",
  ].join(" "),
  neutral: [
    "nothing is happening and your money is stuck in it anyway. bored,",
    "tired, unimpressed, checking a chart that will not move.",
  ].join(" "),
  bullish: [
    "it is finally going your way. quiet, smug relief, the feeling of being",
    "right after months of not being. you are adding more.",
  ].join(" "),
  moon: [
    "euphoric and past all reason. this is the one that gets you out, you are",
    "going to be rich, and you are never selling a single share.",
  ].join(" "),
};

/**
 * One drafting request.
 *
 * `avoid` is what has already been posted this round. Small models restate their
 * own phrasing across a round and `repeat_penalty` only reaches inside a single
 * generation, so across separate requests the history has to be handed over
 * explicitly. The instruction names the failure rather than asking for variety,
 * because "be original" is the one it ignores: what it does is reword, so the ban
 * is on rewording.
 *
 * Handed over as the words to stay off rather than as a rule about them, and a
 * duplicate is caught in code afterwards regardless — this only reduces how often
 * that has to fire.
 */
export function postPrompt(mood: Mood, avoid: readonly string[]): string {
  const lines = [BRIEF[mood]];

  if (avoid.length > 0) {
    lines.push(
      "",
      "you have already posted the lines below. do not post any of them again and",
      "do not post a reworded version of one. different words, different joke,",
      "different complaint:",
      ...avoid.map((body) => `- ${body}`),
    );
  }

  lines.push("", "write the post.");

  return lines.join("\n");
}
