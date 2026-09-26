import type { Informant } from "./informant";
import type {
  NewsCredibility,
  NewsDirection,
  NewsEvent,
  NewsStrength,
  TopicSeed,
} from "./types";

/*
  Every import above is type-only on purpose. Node strips those entirely, which
  lets the evaluation script under tools/ import this file directly and measure
  the prompt the game actually sends, rather than a copy that drifts from it.
*/

/**
 * The one rule the whole feature rests on, stated as a requirement rather than
 * a preference.
 *
 * A tip that says "this will go up" is not a prediction the player makes, it
 * is an instruction they follow, and the mechanic collapses. Small models
 * reach for the consequence because it is the obvious thing to write, so the
 * ban is spelled out in the words they would reach for.
 */
export const TIP_SYSTEM = [
  "You write one private direct message on a fictional stock-trading social",
  "network. You are leaking something about a company called INNO to a single",
  "person you half-trust.",
  "Report the fact and never its consequence. Never say the price will rise or",
  "fall, never say to buy or sell, never give a percentage or a target, and",
  "never explain what the news means for the stock. The person you are writing",
  "to works that out themselves; spelling it out is how people get caught.",
  "This is a private message, not a post: no hashtags, no handles, no audience.",
  "Write one message, at most two sentences and well under 200 characters,",
  "ending on a finished sentence.",
  "Stay in the given voice. Do not sign it and do not greet anyone.",
].join(" ");

/** What each seed is about, in the words the prompt hands over. */
const SUBJECT: Record<TopicSeed, string> = {
  "supply-chain": "INNO's suppliers and what is or is not arriving",
  regulator: "a regulator, an audit or an inspection at INNO",
  "key-customer": "one of INNO's largest customers",
  board: "somebody on INNO's board or in its management",
  plant: "one of INNO's production sites",
  analyst: "an analyst or a research desk that covers INNO",
  takeover: "a stake, a buyer or a deal around INNO",
};

/**
 * The slant, without the words the ban covers.
 *
 * "Good news" and "bad news" rather than "up" and "down": the direction words
 * are exactly what the message must not contain, and a small model given one
 * in its instructions puts it in the output.
 */
const SLANT: Record<NewsDirection, string> = {
  up: "This is good news for INNO.",
  down: "This is bad news for INNO.",
};

/** How big a deal it is, as the size of the fact rather than as a number. */
const SIZE: Record<NewsStrength, string> = {
  small: "It is a small thing: one detail, one delay, one person's decision.",
  medium: "It is a real development, the kind that gets an internal email.",
  large:
    "It is enormous: the kind of thing that changes the company's whole year.",
};

/** How sure the informant is, which is the only risk signal the player gets. */
const SOURCING: Record<NewsCredibility, string> = {
  confirmed:
    "You have this first-hand and you are certain of it. Let that certainty show.",
  rumor:
    "You only heard this second-hand and you are not sure it is true. Let that doubt show, without naming who told you.",
};

export function tipPrompt(informant: Informant, event: NewsEvent): string {
  return [
    `You are ${informant.name}. ${informant.voice}.`,
    "",
    `Write about ${SUBJECT[event.seed]}. ${SLANT[event.direction]} ${SIZE[event.strength]}`,
    "",
    SOURCING[event.credibility],
    "",
    "Send the message.",
  ].join("\n");
}
