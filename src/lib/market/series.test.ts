import { describe, expect, it } from "vitest";
import { TRADING_SESSION } from "~/lib/trading-session";
import {
  advance,
  createState,
  type MarketState,
  START_PRICE,
  TICK_SECONDS,
} from "./series";

/** No shock: 0.5 maps to the middle of the -1..1 range the walk samples. */
const flat = () => 0.5;

const TICKS_PER_CANDLE = TRADING_SESSION.realSecondsPerCandle / TICK_SECONDS;

function advanceBy(state: MarketState, ticks: number): MarketState {
  let next = state;
  for (let i = 0; i < ticks; i++) next = advance(next, flat);
  return next;
}

describe("createState", () => {
  it("opens one candle at the session open", () => {
    const state = createState();
    expect(state.candles).toHaveLength(1);
    expect(state.candles[0].t).toBe(TRADING_SESSION.openMinutes);
    expect(state.candles[0].close).toBe(START_PRICE);
  });
});

describe("advance", () => {
  it("drifts the forming candle upward with no shock", () => {
    const next = advance(createState(), flat);
    expect(next.candles).toHaveLength(1);
    expect(next.candles[0].close).toBeGreaterThan(START_PRICE);
  });

  it("opens a new candle when the slot changes", () => {
    const next = advanceBy(createState(), TICKS_PER_CANDLE + 1);
    expect(next.candles.length).toBeGreaterThan(1);
    const [first, second] = next.candles;
    expect(second.open).toBe(first.close);
    expect(second.t).toBe(first.t + TRADING_SESSION.minutesPerCandle);
  });

  it("closes the session at the session close and then ignores further ticks", () => {
    const slots = Math.floor(
      (TRADING_SESSION.closeMinutes - TRADING_SESSION.openMinutes) /
        TRADING_SESSION.minutesPerCandle,
    );
    const done = advanceBy(createState(), (slots + 2) * TICKS_PER_CANDLE);
    expect(done.closed).toBe(true);
    expect(advance(done, flat)).toBe(done);
  });
});

