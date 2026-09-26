"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { joinSeries, mergeCandle } from "~/lib/market/merge";
import type { Candle } from "~/lib/market/types";
import { useTRPC } from "~/lib/trpc/client";

type GameState = { candles: Candle[] };

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
  const [live, setLive] = useState<Candle[]>([]);

  const start = useMutation(trpc.session.start.mutationOptions());
  // Refetched on a timer, not just once. The snapshot is this client's only way
  // back to the shared series after the stream misses something: a late attach,
  // a reconnect whose backlog outran the 100-event buffer, or a subscription
  // that ended for good. joinSeries folds whatever it brings into the holes, so
  // a gap lasts seconds instead of the rest of the round.
  const snapshot = useQuery({
    ...trpc.session.state.queryOptions(),
    refetchInterval: 15_000,
  });

  // The round has to be running before the snapshot means anything. The server
  // ignores a start while a session is already up, so every client may ask.
  const startRound = start.mutate;
  useEffect(() => {
    startRound();
  }, [startRound]);

  const candles = useMemo(
    () => joinSeries(snapshot.data?.candles, live),
    [snapshot.data, live],
  );

  useSubscription(
    trpc.events.onEvent.subscriptionOptions(undefined, {
      // `tracked()` on the server wraps each event, so the payload arrives as
      // { id, data } rather than the event itself.
      onData: ({ data }) => {
        switch (data.type) {
          case "price":
            setLive((previous) => mergeCandle(previous, data.payload.candle));
            break;
          case "tweet":
            console.log(`@${data.payload.username}: ${data.payload.message}`);
            break;
        }
      },
      onError: (error) => {
        console.error("event stream failed", error);
      },
    }),
  );

  return (
    <GameStateContext.Provider value={{ candles }}>
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
