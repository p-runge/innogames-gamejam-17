"use client";

import { useEffect, useState } from "react";

import type { Candle } from "~/lib/market/types";
import { TRADING_SESSION } from "~/lib/trading-session";

/**
 * The slot the session's last candle occupies.
 *
 * `advance` closes the market once the clock reaches `closeMinutes`, so no candle
 * is ever stamped with it: the last one the player sees is a whole
 * `minutesPerCandle` earlier.
 */
export const FINAL_SLOT =
  TRADING_SESSION.closeMinutes - TRADING_SESSION.minutesPerCandle;

/**
 * Whether the closing bell has rung.
 *
 * Derived from the session clock rather than announced by the server. The market
 * stops publishing at the bell, so there is no event to wait for, and the
 * snapshot that carries `closed` is refetched only every fifteen seconds — long
 * enough that the game would stay playable well past the end of the day.
 *
 * `closed` is taken as the backstop, for a page that joined after the bell: the
 * final candle may already have been part way through on the first render, and
 * the snapshot is then the only thing that knows.
 *
 * Once rung it stays rung. A fresh round replaces the provider's series, and a
 * reading that fell back to `false` would put the player back into a day that is
 * already over.
 */
export function useClosingBell({
  candles,
  closed = false,
}: {
  candles: Candle[];
  /** The snapshot's own flag, if the client has one. */
  closed?: boolean;
}): boolean {
  const [rung, setRung] = useState(false);

  const inFinalSlot = (candles.at(-1)?.t ?? 0) >= FINAL_SLOT;

  useEffect(() => {
    if (!inFinalSlot) return;

    const timer = setTimeout(
      () => setRung(true),
      TRADING_SESSION.realSecondsPerCandle * 1_000,
    );

    return () => clearTimeout(timer);
  }, [inFinalSlot]);

  return rung || closed;
}
