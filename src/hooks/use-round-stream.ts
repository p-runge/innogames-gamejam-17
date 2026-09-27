"use client";

import { useCallback, useState } from "react";

import type { TipPayload } from "~/lib/events/types";
import { mergeCandle } from "~/lib/market/merge";
import type { Candle } from "~/lib/market/types";

/**
 * Everything the event stream has delivered for the round being played now.
 *
 * Its own hook rather than three `useState`s in the provider, because the part
 * that matters is the part that was missing: a round has to be able to end. The
 * provider sits above the scene switch and outlives a round, so without `open`
 * the second round of a page load began holding the first one's candles — whose
 * last slot is the close, which rang the bell five seconds into a day that had
 * just started, and then dropped every real candle of that day for being behind
 * the stale one.
 *
 * `round` counts the rounds this page has opened. It is the key anything else
 * holding per-round state watches, so one call clears all of it.
 */
export function useRoundStream() {
  const [round, setRound] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [tips, setTips] = useState<TipPayload[]>([]);

  /** Begin a round, throwing away whatever the last one left behind. */
  const open = useCallback(() => {
    setRound((previous) => previous + 1);
    setCandles([]);
    setTips([]);
  }, []);

  const addCandle = useCallback((candle: Candle) => {
    setCandles((previous) => mergeCandle(previous, candle));
  }, []);

  const addTip = useCallback((tip: TipPayload) => {
    setTips((previous) => [...previous, tip]);
  }, []);

  return { round, candles, tips, open, addCandle, addTip };
}
