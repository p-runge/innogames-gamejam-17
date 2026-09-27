"use client";

import { createContext, useCallback, useContext, useMemo } from "react";

import { useInformantDesk } from "~/hooks/use-informant-desk";
import { useMarket } from "~/hooks/use-market";
import { useRoundStream } from "~/hooks/use-round-stream";
import type { Candle, Mood } from "~/lib/market/types";
import type { TipPayload } from "~/lib/news/types";
import { TRADING_SESSION } from "~/lib/trading-session";

type GameState = {
  candles: Candle[];
  /** Everything the informant has sent this round, oldest first. */
  tips: TipPayload[];
  /**
   * Open a round. The player leaving the start screen is the only caller — a
   * page load is not a start, or the market would run while the menu is still up.
   */
  start: () => void;
  /**
   * Whether a round has been opened.
   *
   * This used to mean "the server's snapshot has arrived", and the phone still
   * asks because the distinction it drew survives the server: it is the
   * difference between a message being delivered and a page arriving with
   * messages already on it.
   */
  ready: boolean;
  /** Whether the session clock has passed the close. */
  closed: boolean;
  /**
   * How many rounds this page has opened. The key anything holding per-round
   * state watches, so one `start` clears all of it.
   */
  round: number;
  /** Let a post move the price. */
  applyImpulse: (mood: Mood, scale?: number) => void;
};

const GameStateContext = createContext<GameState | null>(null);

/**
 * The round itself, for this tab and no other.
 *
 * This used to hold one subscription to a world the server ticked, and most of
 * its work was reconciling two views of that world: a snapshot fetched on a timer
 * and a stream that could attach late, miss slots across a reconnect, or stop
 * for good. There is one view now, and it is the only one, so the reconciliation
 * went with the bus that needed it.
 *
 * Every tab is its own game. Two people can play at once on one machine and
 * neither will see the other's price, which is what a round being a mount buys.
 */
export default function GameStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { round, open: openRound } = useRoundStream();
  const { candles, closed, open: openMarket, applyImpulse } = useMarket();

  // Tips are stamped with the session clock, so they sit on the same timeline as
  // the candles rather than on the player's wall clock.
  const at = candles.at(-1)?.t ?? TRADING_SESSION.openMinutes;

  /*
    The informant leaks while a day is open and stops at the bell. Derived rather
    than tracked separately: a market that has candles and has not closed is
    exactly the state in which a leak makes sense, and one flag cannot drift from
    another if there is only one.
  */
  const tips = useInformantDesk({
    running: candles.length > 0 && !closed,
    at,
    applyImpulse,
  });

  const start = useCallback(() => {
    openRound();
    openMarket();
  }, [openRound, openMarket]);

  const value = useMemo(
    () => ({
      candles,
      tips,
      start,
      ready: candles.length > 0,
      closed,
      round,
      applyImpulse,
    }),
    [candles, tips, start, closed, round, applyImpulse],
  );

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState(): GameState {
  const state = useContext(GameStateContext);
  if (state === null) {
    throw new Error("useGameState must be used inside GameStateProvider");
  }
  return state;
}
