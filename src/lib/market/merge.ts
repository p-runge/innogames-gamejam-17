import type { Candle } from "./types";

/**
 * Fold one candle from the event stream into the series a client holds.
 *
 * Lives here rather than inside the provider component so it can be tested: the
 * test setup is node-only and collects `.test.ts`, so logic inside a `.tsx`
 * component is logic nothing can pin.
 */
export function mergeCandle(candles: Candle[], candle: Candle): Candle[] {
  const last = candles[candles.length - 1];
  if (last === undefined) return [candle];
  if (candle.t === last.t) return [...candles.slice(0, -1), candle];
  // Out-of-order arrivals would otherwise rewrite history behind the newest
  // candle, which the chart reads as the series jumping backwards.
  if (candle.t < last.t) return candles;
  return [...candles, candle];
}

/**
 * The series a client shows, assembled from the two sources it has: the snapshot
 * it fetched and the live stream it follows.
 *
 * Both exist because the bus buffer holds 100 events, which at four price ticks
 * per second is 25 seconds rather than a whole round, so a joining client cannot
 * get its history from the stream alone.
 *
 * Every slot from either side appears, and the live value wins where both carry
 * one, because the stream is always newer than a snapshot in a shared slot. The
 * union rather than a splice at the stream's first slot is what lets a later
 * snapshot repair a hole: the stream can attach late, miss slots across a
 * reconnect that outran the buffer, or stop entirely, and in each case the slots
 * it lacks are exactly the ones a refetched snapshot still has. Splicing at a
 * fixed boundary would keep discarding them and leave the gap on screen for the
 * rest of the round.
 */
export function joinSeries(
  history: Candle[] | undefined,
  live: Candle[],
): Candle[] {
  if (history === undefined) return live;
  if (live.length === 0) return history;

  const bySlot = new Map<number, Candle>();
  for (const candle of history) bySlot.set(candle.t, candle);
  for (const candle of live) bySlot.set(candle.t, candle);

  return [...bySlot.values()].sort((a, b) => a.t - b.t);
}
