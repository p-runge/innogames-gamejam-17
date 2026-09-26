"use client";

import { useGameState } from "~/components/game-state-provider";
import type { Candle } from "~/lib/market/types";

/**
 * The session's candles as the server computes them. The random walk that used
 * to live here moved to `src/lib/market/series.ts`, because the crowd's replies
 * have to be able to move the same series every client sees.
 */
export function useMarketFeed(): Candle[] {
  return useGameState().candles;
}
