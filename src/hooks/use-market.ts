"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  addImpulse,
  advance,
  createState,
  TICK_SECONDS,
  type MarketState,
} from "~/lib/market/series";
import type { Candle, Mood } from "~/lib/market/types";

/**
 * The trading day, ticking in the browser.
 *
 * `series.ts` does the arithmetic and always did; this only owns the clock. That
 * clock used to live on the server, pinned to `globalThis` so an edit in
 * development could not orphan it, started idempotently so a second browser
 * joined rather than doubling the speed, and torn down by a module that knew a
 * round had ended. None of that is needed here: a round is a mount, a second tab
 * is a second world, and the interval dies with the component.
 *
 * The market is held in a ref as well as in state. The ticker needs the newest
 * one on every tick and must not be re-armed to get it, and a state updater
 * cannot be read from outside a render.
 */
export function useMarket() {
  const [market, setMarket] = useState<MarketState | null>(null);
  const latest = useRef<MarketState | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current === null) return;
    clearInterval(timer.current);
    timer.current = null;
  }, []);

  /** Begin a day. Safe to call on a running one: it replaces it. */
  const open = useCallback(() => {
    stop();

    const fresh = createState();
    latest.current = fresh;
    setMarket(fresh);

    timer.current = setInterval(() => {
      const current = latest.current;
      if (current === null) return;

      const next = advance(current, Math.random);
      latest.current = next;
      setMarket(next);

      // `advance` is a no-op on a closed state, so this only stops the interval
      // running for nothing. The round is over either way.
      if (next.closed) stop();
    }, TICK_SECONDS * 1_000);
  }, [stop]);

  // The only teardown this needs. An interval that outlived its component would
  // hold the whole market alive and go on setting state into nothing.
  useEffect(() => stop, [stop]);

  const applyImpulse = useCallback((mood: Mood, scale = 1) => {
    const current = latest.current;
    /*
      Dropped rather than queued when no day is running or it has closed. The
      informant arms a payout for some seconds after a tip, so one sent just
      before the bell would otherwise land on the next round's price.
    */
    if (current === null || current.closed) return;

    const next = addImpulse(current, mood, scale);
    latest.current = next;
    setMarket(next);
  }, []);

  const candles: Candle[] = market?.candles ?? [];

  return { candles, closed: market?.closed ?? false, open, applyImpulse };
}
