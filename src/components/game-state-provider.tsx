"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { createContext, useCallback, useContext, useMemo } from "react";

import { useRoundStream } from "~/hooks/use-round-stream";
import type { TipPayload } from "~/lib/events/types";
import { mergeTips } from "~/lib/feed/tips";
import { joinSeries } from "~/lib/market/merge";
import type { Candle } from "~/lib/market/types";
import { roundHasClosed } from "~/lib/round-outcome";
import { useTRPC } from "~/lib/trpc/client";

type GameState = {
  candles: Candle[];
  /** The informant's private messages, oldest first, deduplicated on id. */
  tips: TipPayload[];
  /**
   * Open the round. Called once, by the player leaving the start screen — a
   * page load is not a start, or the market would run while the menu is still
   * up. Safe to call again: the server ignores a start on a running session,
   * which is what lets a second browser join this one.
   */
  start: () => void;
  /**
   * Whether the server's snapshot has arrived at least once.
   *
   * The provider renders before its first query resolves, so everything above
   * starts empty and fills a moment later. For the candles that is invisible;
   * for the dock it is the difference between a delivery and a reload, and it
   * has no other way to tell.
   */
  ready: boolean;
  /**
   * How many rounds this page has opened.
   *
   * The key anything holding per-round state watches, so one `start` clears all
   * of it. Nothing about the world, and deliberately not the server's: it counts
   * this browser's rounds, which is what the phone and the meter are scoped to.
   */
  round: number;
  /**
   * Whether the server considers the round over.
   *
   * The backstop for the closing bell, which `useClosingBell` otherwise derives
   * from the candle clock: a page that joined after the bell has no candle
   * arriving to time, and this is the only thing that knows.
   */
  closed: boolean;
};

const GameStateContext = createContext<GameState | null>(null);

/**
 * Holds the single event subscription for the whole game. Every panel reads the
 * world from this context rather than opening a stream of its own, which is what
 * keeps one server-side session feeding every browser the same series.
 */
export default function GameStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const trpc = useTRPC();
  // Only what the stream has delivered. The history in front of it comes from the
  // snapshot below and is never copied into state: seeding state from a query
  // would mean setting state in an effect, which this project's lint rules
  // rightly refuse.
  const {
    round,
    candles: live,
    tips: liveTips,
    open,
    addCandle,
    addTip,
  } = useRoundStream();

  const queryClient = useQueryClient();
  const start = useMutation(
    trpc.session.start.mutationOptions({
      onSuccess: () => {
        // The scene switches on the click, so the chart is already up when this
        // lands. Without the refetch it would sit empty until the first live
        // candle arrives seconds later, and a joining player would wait out the
        // snapshot's own interval instead.
        void queryClient.invalidateQueries(trpc.session.state.queryFilter());
      },
    }),
  );

  const startMutate = start.mutate;
  const startRound = useCallback(() => {
    /*
      The last round's candles go before the request does, not when its reply
      lands. The scene switches on the click, so anything still held here is read
      by the new round's first frame — and the last thing the previous round
      streamed is the closing slot, which ends the new day about five seconds in.
    */
    open();
    startMutate();
  }, [open, startMutate]);
  // Refetched on a timer, not just once. The snapshot is this client's only way
  // back to the shared series after the stream misses something: a late attach,
  // a reconnect whose backlog outran the 100-event buffer, or a subscription
  // that ended for good. joinSeries folds whatever it brings into the holes, so
  // a gap lasts seconds instead of the rest of the round.
  const snapshot = useQuery({
    ...trpc.session.state.queryOptions(),
    refetchInterval: 15_000,
  });

  const candles = useMemo(
    () => joinSeries(snapshot.data?.candles, live),
    [snapshot.data, live],
  );

  const tips = useMemo(
    () => mergeTips(snapshot.data?.tips ?? [], liveTips),
    [snapshot.data, liveTips],
  );

  useSubscription(
    trpc.events.onEvent.subscriptionOptions(undefined, {
      // `tracked()` on the server wraps each event, so the payload arrives as
      // { id, data } rather than the event itself.
      onData: ({ data }) => {
        switch (data.type) {
          case "price":
            addCandle(data.payload.candle);
            break;
          case "tip":
            addTip(data.payload);
            break;
          case "tweet":
            // The player's own post is rendered optimistically where it was
            // typed, so the echo back over the bus needs no handling here. The
            // event still exists for a future second player.
            break;
        }
      },
      onError: (error) => {
        console.error("event stream failed", error);
      },
    }),
  );

  const ready = snapshot.isSuccess;
  /*
    Only believed about the round that is running now. `start` opens a new one,
    and the cached snapshot goes on describing the one before it until the
    refetch lands — long enough to end the new round on its first frame.
  */
  const closed = roundHasClosed({
    closed: snapshot.data?.closed ?? false,
    snapshotAt: snapshot.dataUpdatedAt,
    startedAt: start.submittedAt,
  });

  const value = useMemo(
    () => ({ candles, tips, ready, closed, round, start: startRound }),
    [candles, tips, ready, closed, round, startRound],
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
