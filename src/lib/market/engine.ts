import "server-only";

import { publish } from "~/lib/events/bus";
import {
  addImpulse,
  advance,
  createState,
  TICK_SECONDS,
  type MarketState,
} from "./series";
import type { ImpulseSource, Mood } from "./types";

type EngineState = {
  market: MarketState;
  timer: ReturnType<typeof setInterval> | null;
};

// Pinned to globalThis for the same reason the event bus is: `next dev`
// re-evaluates modules on every edit, and a module-level ticker would leave
// connected clients subscribed to a world nobody advances any more.
const globalForMarket = globalThis as typeof globalThis & {
  gameMarket?: EngineState;
};

function getEngine(): EngineState {
  globalForMarket.gameMarket ??= { market: createState(), timer: null };
  return globalForMarket.gameMarket;
}

export function getMarketState(): MarketState {
  return getEngine().market;
}

export function isRunning(): boolean {
  return getEngine().timer !== null;
}

/**
 * Start the round. Idempotent on purpose: React double-mounts in development and
 * a second browser calls this too, and a second ticker would run the same world
 * at twice the speed without reporting anything wrong.
 */
export function startSession(): void {
  const engine = getEngine();
  if (engine.timer) return;

  // A finished round is not resumable: its series is full and `advance` is a
  // no-op on a closed state, so reusing it would start a ticker that clears
  // itself on its first tick and publishes nothing. Without this, the first
  // player to reach the close leaves the game dead for every later page load in
  // the same process, with a frozen price the trade buttons still fill against.
  if (engine.market.closed) engine.market = createState();

  engine.timer = setInterval(() => {
    const next = advance(engine.market, Math.random);
    engine.market = next;

    if (next.closed) {
      stopSession();
      return;
    }

    const candle = next.candles[next.candles.length - 1];
    publish({ type: "price", payload: { candle } });
  }, TICK_SECONDS * 1_000);
}

export function stopSession(): void {
  const engine = getEngine();
  if (!engine.timer) return;
  clearInterval(engine.timer);
  engine.timer = null;
}

/**
 * Let a post move the price. Ignored whenever no round is ticking, which covers
 * both before the first start and after the close: a stray call cannot shift a
 * series nobody is watching, and an impulse arriving after the bell is dropped
 * rather than held over into the next round.
 */
export function applyImpulse(mood: Mood, source: ImpulseSource): void {
  const engine = getEngine();
  if (!engine.timer) return;
  engine.market = addImpulse(engine.market, mood, source);
}

/** Test-only: drop all state so each test starts from a fresh session. */
export function resetMarket(): void {
  stopSession();
  globalForMarket.gameMarket = undefined;
}
