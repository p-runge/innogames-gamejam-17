import { describe, expect, it } from "vitest";
import { TRADING_SESSION } from "~/lib/trading-session";
import {
  addImpulse,
  advance,
  createState,
  START_PRICE,
  TICK_SECONDS,
  type MarketState,
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

describe("addImpulse", () => {
  it("moves the price further up for moon than for neutral", () => {
    const base = advance(addImpulse(createState(), "neutral", "ambient"), flat);
    const hyped = advance(addImpulse(createState(), "moon", "ambient"), flat);
    expect(hyped.candles[0].close).toBeGreaterThan(base.candles[0].close);
  });

  it("weighs a reaction heavier than ambient chatter", () => {
    const ambient = advance(addImpulse(createState(), "moon", "ambient"), flat);
    const reaction = advance(addImpulse(createState(), "moon", "reaction"), flat);
    expect(reaction.candles[0].close).toBeGreaterThan(ambient.candles[0].close);
  });

  it("decays an impulse back toward zero", () => {
    const shocked = addImpulse(createState(), "moon", "reaction");
    const later = advanceBy(shocked, 40);
    expect(Math.abs(later.impulse)).toBeLessThan(Math.abs(shocked.impulse) / 10);
  });

  it("lets a dump pull the price below the open", () => {
    const dumped = advanceBy(addImpulse(createState(), "dump", "reaction"), 3);
    expect(dumped.candles[0].close).toBeLessThan(START_PRICE);
  });
});
