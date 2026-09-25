"use client";

import { useEffect, useState } from "react";

import type { Candle } from "~/components/candle-chart";
import { TRADING_SESSION } from "~/utils/trading-session";

type MarketFeedOptions = {
  startPrice?: number;
  /** Per-tick bias. Positive drifts the index up over a session. */
  drift?: number;
  /** Largest per-tick move, as a fraction of the current price. */
  volatility?: number;
  /** How often the price moves within the candle that is still forming. */
  tickMs?: number;
};

/**
 * A placeholder random walk on the session clock, so the screen has something
 * to show. Swap it for the game's own price state — CandleChart only needs the
 * array, and only cares that each candle's `t` is one of the session's slots.
 */
export function useMarketFeed({
  startPrice = 1240,
  drift = 0.00004,
  volatility = 0.0022,
  tickMs = 250,
}: MarketFeedOptions = {}) {
  const [candles, setCandles] = useState<Candle[]>(() => [
    {
      t: TRADING_SESSION.openMinutes,
      open: startPrice,
      high: startPrice,
      low: startPrice,
      close: startPrice,
    },
  ]);

  useEffect(() => {
    const { openMinutes, closeMinutes, minutesPerCandle, realSecondsPerCandle } =
      TRADING_SESSION;
    let elapsedSeconds = 0;

    const interval = setInterval(() => {
      elapsedSeconds += tickMs / 1000;

      // Wall time drives which candle is forming; the candle itself is stamped
      // with the in-game clock, which runs far faster.
      const slot =
        openMinutes +
        Math.floor(elapsedSeconds / realSecondsPerCandle) * minutesPerCandle;

      if (slot >= closeMinutes) {
        clearInterval(interval);
        return;
      }

      setCandles((previous) => {
        const forming = previous[previous.length - 1];
        const shock = (Math.random() * 2 - 1) * volatility;
        const price = Math.max(0.01, forming.close * (1 + drift + shock));

        // Within a slot the newest candle keeps growing; crossing into the next
        // one closes it and opens the next at the price it closed at, so the
        // series has no gaps.
        if (slot > forming.t) {
          return [
            ...previous,
            {
              t: slot,
              open: forming.close,
              high: Math.max(forming.close, price),
              low: Math.min(forming.close, price),
              close: price,
            },
          ];
        }

        return [
          ...previous.slice(0, -1),
          {
            ...forming,
            high: Math.max(forming.high, price),
            low: Math.min(forming.low, price),
            close: price,
          },
        ];
      });
    }, tickMs);

    return () => clearInterval(interval);
  }, [drift, tickMs, volatility]);

  return candles;
}
