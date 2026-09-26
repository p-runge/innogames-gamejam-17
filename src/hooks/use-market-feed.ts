"use client";

import { useGameState } from "~/components/game-state-provider";
import type { Candle } from "~/lib/market/types";

/**
 * The session's candles as the server computes them. The random walk that used
 * to live here moved to `src/lib/market/series.ts`, so every client sees the
 * same series rather than one it walked itself.
 */
export function useMarketFeed(): Candle[] {
  return useGameState().candles;
}
