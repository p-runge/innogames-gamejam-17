import { afterEach, describe, expect, it, vi } from "vitest";
import { resetBus } from "~/lib/events/bus";
import { getMarketState, isRunning, resetMarket } from "~/lib/market/engine";
import { endRound, startRound } from "./round";

afterEach(() => {
  endRound();
  resetMarket();
  resetBus();
  vi.useRealTimers();
});

describe("startRound", () => {
  it("has a market running afterwards", () => {
    startRound();
    expect(isRunning()).toBe(true);
  });

  it("is idempotent, so a second browser joins instead of rebuilding", () => {
    // A second start that rebuilt the world would put the series back to its
    // opening candle under a player who is already trading.
    vi.useFakeTimers();
    startRound();
    vi.advanceTimersByTime(60 * 1_000);
    const elapsed = getMarketState().candles.length;
    expect(elapsed).toBeGreaterThan(1);

    startRound();
    expect(getMarketState().candles.length).toBe(elapsed);
  });
});

describe("endRound", () => {
  it("stops the market", () => {
    startRound();
    endRound();
    expect(isRunning()).toBe(false);
  });

  it("is safe to call when no round is running", () => {
    expect(() => endRound()).not.toThrow();
  });
});

describe("the round ending on its own", () => {
  it("tears everything down when the session clock passes the close", () => {
    vi.useFakeTimers();
    startRound();

    // Well past the 8.5 minute session.
    vi.advanceTimersByTime(15 * 60 * 1_000);

    expect(isRunning()).toBe(false);
    expect(getMarketState().closed).toBe(true);
  });

  it("lets a later start open a genuinely fresh round", () => {
    vi.useFakeTimers();
    startRound();
    vi.advanceTimersByTime(15 * 60 * 1_000);
    vi.useRealTimers();

    startRound();

    expect(isRunning()).toBe(true);
    expect(getMarketState().closed).toBe(false);
    expect(getMarketState().candles).toHaveLength(1);
  });
});
