import type { FeedPost } from "~/lib/feed/thread";
import type { Persona, Reply } from "~/lib/llm/schemas";
import { TRADING_SESSION } from "~/lib/trading-session";

/**
 * The thread's opening post.
 *
 * The feed renders `posts[0]` as the subject of the thread, in its own styling.
 * With nothing seeded, whatever arrives first takes that slot — and since the
 * cast takes a minute or two to build on a CPU-bound model, that is usually the
 * player's own first sentence, promoted to the thread's subject and attributed
 * to them for the rest of the round.
 *
 * Invented, like every account here: the handle belongs to nobody, and the tip
 * is the game's fiction rather than a claim about anything tradable.
 */
export const OPENING_POST: FeedPost = {
  id: "opening",
  author: "Market Whisper",
  handle: "@whisper",
  body: "Something is happening at INNO today. Watch the open. Not financial advice.",
  at: TRADING_SESSION.openMinutes,
  replies: 412,
  reposts: 1203,
  likes: 8941,
};

/** Which way the price has been going, as the templates care about it. */
export type PriceDirection = "up" | "down" | "flat";

const BODIES: Record<PriceDirection, readonly string[]> = {
  down: [
    "this is what they meant by long term value",
    "every single time. every time.",
    "who is buying this. actually who",
    "i am so tired of funding other people's yachts",
    "hope everyone enjoyed the ride down",
    "called it, nobody listened, nobody ever does",
  ],
  up: [
    "oh now everyone is a genius",
    "enjoy it while the fund lets you",
    "this is the part before the part nobody likes",
    "cannot wait to read the posts at the close",
    "buying this is how they get you, again",
    "someone is getting out right now and it is not you",
  ],
  flat: [
    "is anyone actually here",
    "nothing. absolutely nothing. thrilling",
    "watching paint would pay better",
    "at some point something has to happen. right?",
    "flat all morning and somehow still down on the year",
    "i have made and lost this much walking to the shop",
  ],
};

const MOODS: Record<PriceDirection, readonly Reply["mood"][]> = {
  down: ["dump", "bearish", "bearish", "neutral"],
  up: ["bullish", "bullish", "moon", "neutral"],
  flat: ["neutral", "neutral", "bearish", "bullish"],
};

function pick<T>(from: readonly T[]): T {
  return from[Math.floor(Math.random() * from.length)];
}

/**
 * A reply for when the model cannot answer: switched off, unreachable, or every
 * request past its timeout.
 *
 * Without these the fallback is only half a fallback — the curated personas are
 * assembled and then never say anything, so the market keeps moving while the
 * feed stays empty for the whole round and the player's posts have no effect at
 * all. These are deliberately plain: they are not trying to pass for the model's
 * output, they are keeping the game playable.
 *
 * The persona is taken for its stance, which decides nothing here yet but keeps
 * the signature honest for when it should.
 */
export function templatedReply(
  persona: Persona,
  direction: PriceDirection,
): Reply {
  void persona;
  return { mood: pick(MOODS[direction]), body: pick(BODIES[direction]) };
}
