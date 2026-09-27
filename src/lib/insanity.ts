import type { Mood } from "~/lib/market/types";

/** A full meter ends the round. */
export const INSANITY_MAX = 100;

/**
 * What one post does to the player's head.
 *
 * Mirrored on purpose: up costs, down pays, and the amount grows with the
 * volume. That is the whole tutorial, and it is readable straight off the five
 * buttons without a word of explanation.
 *
 * Down-posts are paid in sanity rather than in money because the player cannot
 * short. A falling price earns nothing when you can only go long — dumping and
 * then buying cheap moves the entry and the exit together and nets exactly zero
 * — so without this the bearish half of the palette would be decoration.
 *
 * Expect to turn these in playtesting. The reasoning behind the numbers, and
 * what each route through them costs, is in
 * `.private/specs/2026-09-27-insanity-meter.md`.
 */
export const INSANITY_COST: Record<Mood, number> = {
  moon: 2,
  bullish: 0.6,
  neutral: -0.2,
  bearish: -0.3,
  dump: -1,
};

export type BandId = "lucid" | "twitchy" | "feral" | "gone";

export type Band = {
  id: BandId;
  /** The word on the meter. */
  name: string;
  /** Lowest reading that is in this band. */
  from: number;
  /** Multiplier on the price move a post causes. */
  impulse: number;
  /** How long the buttons stay dead after a post. */
  cooldownMs: number;
  /** Fraction of a refund that actually arrives. */
  refund: number;
  /** How many replies one post draws. */
  replies: number;
};

/**
 * The deal the meter offers, in four steps.
 *
 * The top two bands make the player stronger and faster and their information
 * unreliable, which is a gamble rather than a death march: a round that has
 * fallen behind can still be won from there.
 *
 * `refund` is what stops that from becoming the only strategy. Shrinking it with
 * the damage turns the top bands into a sprint of twenty to fifty seconds
 * instead of a place to live, because a manic head cannot talk itself down.
 */
export const BANDS: readonly Band[] = [
  {
    id: "lucid",
    name: "Lucid",
    from: 0,
    impulse: 1,
    cooldownMs: 3_000,
    refund: 1,
    replies: 1,
  },
  {
    id: "twitchy",
    name: "Twitchy",
    from: 40,
    impulse: 1,
    cooldownMs: 3_000,
    refund: 1,
    replies: 1,
  },
  {
    id: "feral",
    name: "Feral",
    from: 70,
    impulse: 1.25,
    cooldownMs: 2_300,
    refund: 0.5,
    replies: 2,
  },
  {
    id: "gone",
    name: "Gone",
    from: 88,
    impulse: 1.6,
    cooldownMs: 1_600,
    refund: 0.25,
    replies: 3,
  },
];

/**
 * Two decimals, the finest the price list can produce: the smallest refund is
 * `neutral` at Gone, which is 0.05.
 *
 * Rounded at every step rather than only for display, because the meter is
 * compared against its own ceiling. Summed as raw binary floats, sixty bullish
 * posts land near 35.999999999999996 instead of 36, and the error grows for the
 * rest of the round.
 */
function toMeter(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The band a reading falls in. A boundary belongs to the harsher band. */
export function bandFor(insanity: number): Band {
  for (let index = BANDS.length - 1; index > 0; index--) {
    if (insanity >= BANDS[index].from) return BANDS[index];
  }

  return BANDS[0];
}

/**
 * What a mood costs right now, refund already shrunk.
 *
 * This is the number the button shows, so the player watches their refunds get
 * worse without anyone explaining it. Only a refund is scaled: a manic head pays
 * full price for a post and gets less back for calming down.
 */
export function costOf(insanity: number, mood: Mood): number {
  const raw = INSANITY_COST[mood];

  return raw < 0 ? toMeter(raw * bandFor(insanity).refund) : raw;
}

/**
 * The meter after a post has gone out.
 *
 * The band is read before the charge, so a post is priced by the state it was
 * written in rather than the state it leaves behind. That matters on a boundary:
 * a `dump` at exactly 70 is refunded at Feral's rate and lands back in Twitchy,
 * and reading the band afterwards would price it the other way.
 */
export function applyPost(insanity: number, mood: Mood): number {
  const next = toMeter(insanity + costOf(insanity, mood));

  return Math.min(INSANITY_MAX, Math.max(0, next));
}
