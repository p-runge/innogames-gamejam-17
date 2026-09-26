import type { Mood } from "~/lib/market/types";
import type {
  NewsCredibility,
  NewsDirection,
  NewsEvent,
  NewsStrength,
  TopicSeed,
} from "./types";

/** The window the player has between reading a tip and the move arriving. */
export const MIN_DELAY_MS = 6_000;
export const MAX_DELAY_MS = 15_000;

/** Cumulative weights, walked against one draw. Weighted toward the middle. */
const STRENGTHS: ReadonlyArray<readonly [NewsStrength, number]> = [
  ["small", 0.3],
  ["medium", 0.75],
  ["large", 1],
];

const RUMOR_SHARE = 0.4;
const RUMOR_HIT_RATE = 0.5;

/**
 * What one event is worth as a market impulse, by strength.
 *
 * With the engine's decay an impulse of `m` contributes `m / (1 - decay)` over
 * its life, and these are multiples of `MOOD_DRIFT.moon` — so a tip is worth
 * 0.6, 1.2 or 2.2 of what one suggested post at the same mood is worth, spent
 * inside about five seconds. That is one decisive candle rather than a new
 * plateau.
 *
 * Balancing knobs, like `MOOD_DRIFT`: expect to turn them in playtesting, and
 * turn these before the frequency — the tips are the readable part. The
 * yardstick is `SUGGESTIONS`, since a suggested post is the only other thing
 * that moves this market.
 */
export const STRENGTH_SCALE: Record<NewsStrength, number> = {
  small: 0.6,
  medium: 1.2,
  large: 2.2,
};

/**
 * What a rumour is worth when it comes true. Above 1 on purpose: the class the
 * player is right to distrust has to be the one worth taking, or nobody would
 * ever act on one.
 */
export const RUMOR_PAYOUT_BONUS = 1.5;

function weighted<T>(
  roll: number,
  table: ReadonlyArray<readonly [T, number]>,
): T {
  for (const [value, upTo] of table) {
    if (roll < upTo) return value;
  }
  return table[table.length - 1][0];
}

/**
 * Draw one event. `random` returns [0, 1) and is a parameter so tests can pin
 * every branch.
 *
 * Exactly five draws, always in this order — direction, strength, credibility,
 * rumour payout, delay — and the payout draw is taken even for a confirmed tip
 * that does not need it. A branch that skipped a draw would shift every later
 * field, which makes a sequence a test hands in mean something different
 * depending on what it rolled earlier.
 */
export function drawEvent(random: () => number, seed: TopicSeed): NewsEvent {
  const direction: NewsDirection = random() < 0.5 ? "up" : "down";
  const strength = weighted(random(), STRENGTHS);
  const credibility: NewsCredibility =
    random() < RUMOR_SHARE ? "rumor" : "confirmed";
  const payoutRoll = random();
  const delayMs = MIN_DELAY_MS + random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  return {
    direction,
    strength,
    credibility,
    seed,
    pays: credibility === "confirmed" || payoutRoll < RUMOR_HIT_RATE,
    delayMs,
  };
}

/**
 * The market impulse one event pays out.
 *
 * Direction takes the outer mood step and nothing in between: the five steps
 * exist so the crowd can be read at five intensities, while a news event
 * already carries its own intensity in the scale. Using `bullish` for a small
 * tip would leave two knobs doing one job.
 */
export function impulseFor(event: NewsEvent): { mood: Mood; scale: number } {
  return {
    mood: event.direction === "up" ? "moon" : "dump",
    scale:
      STRENGTH_SCALE[event.strength] *
      (event.credibility === "rumor" ? RUMOR_PAYOUT_BONUS : 1),
  };
}
