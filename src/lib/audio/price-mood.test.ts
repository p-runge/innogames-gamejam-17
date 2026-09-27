import { describe, expect, it } from "vitest";

import type { Candle } from "~/lib/market/types";
import { MOVE_WINDOW_CANDLES, readPriceMove } from "./price-mood";

/** A flat series of closes, one candle per slot, oldest first. */
function series(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    t: 9 * 60 + index * 5,
    open: close,
    high: close,
    low: close,
    close,
  }));
}

/** `count` candles all sitting at the same price. */
function flat(count: number, price = 1_000): number[] {
  return Array.from({ length: count }, () => price);
}

describe("readPriceMove", () => {
  it("says nothing about a series shorter than the window", () => {
    expect(readPriceMove(series(flat(MOVE_WINDOW_CANDLES)))).toBeNull();
  });

  it("says nothing about an empty series", () => {
    expect(readPriceMove([])).toBeNull();
  });

  it("reads a big climb as a rally", () => {
    const candles = series([...flat(MOVE_WINDOW_CANDLES, 1_000), 1_200]);

    expect(readPriceMove(candles, { threshold: 0.1 })).toBe("rally");
  });

  it("reads a big drop as a crash", () => {
    const candles = series([...flat(MOVE_WINDOW_CANDLES, 1_000), 800]);

    expect(readPriceMove(candles, { threshold: 0.1 })).toBe("crash");
  });

  it("says nothing about a move under the threshold", () => {
    const candles = series([...flat(MOVE_WINDOW_CANDLES, 1_000), 1_050]);

    expect(readPriceMove(candles, { threshold: 0.1 })).toBeNull();
  });

  it("measures from the window's edge, not from the open", () => {
    // The price doubled over the day but has been still for the whole window,
    // which is a market nobody should be screaming about.
    const candles = series([500, 1_000, ...flat(MOVE_WINDOW_CANDLES, 1_000)]);

    expect(readPriceMove(candles, { threshold: 0.1 })).toBeNull();
  });

  it("survives an earlier close of zero", () => {
    const candles = series([0, ...flat(MOVE_WINDOW_CANDLES, 1_000)]);

    expect(readPriceMove(candles, { threshold: 0.1 })).toBeNull();
  });
});
