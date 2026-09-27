import type { Candle } from "~/lib/market/types";

/**
 * How far back the move is measured. Three closed candles is fifteen seconds of
 * wall time at `TRADING_SESSION.realSecondsPerCandle`, and an impulse spends
 * almost all of itself within five — so the window holds a whole reaction rather
 * than catching one halfway through.
 */
export const MOVE_WINDOW_CANDLES = 3;

/**
 * How big a move has to be before the trader reacts out loud.
 *
 * Calibrated against the two things that move this market. One suggested post at
 * `moon` or `dump` is worth roughly 7% (`MOOD_DRIFT` over the engine's decay),
 * and the drift and volatility between posts add about 1% across the window. Ten
 * percent therefore sits above anything a single post can do on its own: it takes
 * two posts pushing the same way, or a news event of medium strength upwards
 * (`STRENGTH_SCALE`). That keeps the scream and the ovation rare enough to still
 * mean something — the post itself already has a sound.
 */
export const MOVE_THRESHOLD = 0.1;

/** A move worth reacting to, or nothing if the price is merely moving. */
export type PriceMood = "crash" | "rally" | null;

/**
 * Read the last few candles as one gesture.
 *
 * Deliberately blind to everything before the window: the day's own trend is the
 * chart's business, and a trader who has been up 90% since the open should not
 * still be cheering about it.
 */
export function readPriceMove(
  candles: readonly Candle[],
  {
    window = MOVE_WINDOW_CANDLES,
    threshold = MOVE_THRESHOLD,
  }: { window?: number; threshold?: number } = {},
): PriceMood {
  const latest = candles.at(-1);
  const earlier = candles.at(-1 - window);

  // No window yet, or a price that cannot be divided by — the opening seconds of
  // a round, where there is nothing to compare against.
  if (!latest || !earlier || earlier.close <= 0) return null;

  const change = (latest.close - earlier.close) / earlier.close;

  if (change >= threshold) return "rally";
  if (change <= -threshold) return "crash";
  return null;
}
