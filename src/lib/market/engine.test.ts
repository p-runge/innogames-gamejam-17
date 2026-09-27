import { afterEach, describe, expect, it, vi } from "vitest";
import { resetBus, subscribe } from "~/lib/events/bus";
import {
  getMarketState,
  isRunning,
  resetMarket,
  startSession,
  stopSession,
} from "./engine";

afterEach(() => {
  stopSession();
  resetMarket();
  resetBus();
  vi.useRealTimers();
});

describe("startSession", () => {
  it("reports running and exposes a state with one candle", () => {
    startSession();
    expect(isRunning()).toBe(true);
    expect(getMarketState().candles).toHaveLength(1);
  });

  it("is idempotent: a second call does not double the tick rate", () => {
    vi.useFakeTimers();
    startSession();
    startSession();
    vi.advanceTimersByTime(1_000);
    // One second of ticks, once. Two tickers would advance it twice.
    expect(getMarketState().elapsedSeconds).toBeCloseTo(1, 5);
  });

  it("publishes a price event per tick", async () => {
    vi.useFakeTimers();
    startSession();
    const controller = new AbortController();
    const stream = subscribe({ signal: controller.signal, lastEventId: null });
    const next = stream.next();
    vi.advanceTimersByTime(250);
    const published = await next;
    controller.abort();
    expect(published.value?.event.type).toBe("price");
  });

  it("stops ticking once the session closes", () => {
    vi.useFakeTimers();
    startSession();
    // Well past the 8.5 minute session.
    vi.advanceTimersByTime(15 * 60 * 1_000);
    expect(isRunning()).toBe(false);
    expect(getMarketState().closed).toBe(true);
  });

  it("starts a fresh round when called after the close", () => {
    // A finished round is not resumable: its series is full and `advance` is a
    // no-op on it. Without this, the first player to reach the close leaves the
    // game dead for every later page load in the same process.
    vi.useFakeTimers();
    startSession();
    vi.advanceTimersByTime(15 * 60 * 1_000);
    expect(getMarketState().closed).toBe(true);

    startSession();

    const fresh = getMarketState();
    expect(isRunning()).toBe(true);
    expect(fresh.closed).toBe(false);
    expect(fresh.candles).toHaveLength(1);
    expect(fresh.elapsedSeconds).toBe(0);
  });

  it("actually ticks again after restarting past the close", () => {
    vi.useFakeTimers();
    startSession();
    vi.advanceTimersByTime(15 * 60 * 1_000);
    startSession();
    vi.advanceTimersByTime(1_000);
    // The restarted round has to advance, not clear itself on its first tick.
    expect(getMarketState().elapsedSeconds).toBeCloseTo(1, 5);
    expect(isRunning()).toBe(true);
  });
});

describe("stopping a round before the close", () => {
  it("marks the market closed, so it is not resumable", () => {
    startSession();
    stopSession();

    expect(getMarketState().closed).toBe(true);
  });

  it("lets the next start open a fresh series", () => {
    // Losing to the Insane-O-Meter at two in the afternoon leaves the ticker
    // running. Without the flag above, going back to the menu and pressing start
    // joined the abandoned round at its old price with its remaining minutes.
    vi.useFakeTimers();
    startSession();
    vi.advanceTimersByTime(60_000);
    const abandoned = getMarketState().candles.length;
    expect(abandoned).toBeGreaterThan(1);

    stopSession();
    startSession();

    const state = getMarketState();
    expect(state.closed).toBe(false);
    expect(state.candles).toHaveLength(1);
    expect(state.elapsedSeconds).toBe(0);
  });
});
