import { TRADING_SESSION } from "~/lib/trading-session";
import type { Candle, ImpulseSource, Mood } from "./types";

/** The index's opening print. */
export const START_PRICE = 1240;

/** How often the forming candle moves, in seconds of wall time. */
export const TICK_SECONDS = 0.25;

/** Per-tick bias with no impulse in play. */
const DRIFT = 0.00004;

/** Largest per-tick random move, as a fraction of the current price. */
const VOLATILITY = 0.0022;

/**
 * Per-tick drift a mood contributes while its impulse is alive. These and the
 * weights below are the balancing knobs; expect to turn them in playtesting.
 */
const MOOD_DRIFT: Record<Mood, number> = {
  dump: -0.004,
  bearish: -0.0015,
  neutral: 0,
  bullish: 0.0015,
  moon: 0.004,
};

const SOURCE_WEIGHT: Record<ImpulseSource, number> = {
  ambient: 1,
  reaction: 2.5,
};

/** Fraction of the impulse that survives each tick. */
const IMPULSE_DECAY = 0.85;

export type MarketState = {
  candles: Candle[];
  /** Active drift bonus from recent posts, decaying every tick. */
  impulse: number;
  elapsedSeconds: number;
  /** True once the session clock has passed the close. */
  closed: boolean;
};

export function createState(startPrice = START_PRICE): MarketState {
  return {
    candles: [
      {
        t: TRADING_SESSION.openMinutes,
        open: startPrice,
        high: startPrice,
        low: startPrice,
        close: startPrice,
      },
    ],
    impulse: 0,
    elapsedSeconds: 0,
    closed: false,
  };
}

export function addImpulse(
  state: MarketState,
  mood: Mood,
  source: ImpulseSource,
): MarketState {
  return {
    ...state,
    impulse: state.impulse + MOOD_DRIFT[mood] * SOURCE_WEIGHT[source],
  };
}

/**
 * One tick of wall time. `random` returns [0, 1) and is a parameter so tests can
 * hold the shock at zero and assert on drift and impulse alone.
 */
export function advance(state: MarketState, random: () => number): MarketState {
  if (state.closed) return state;

  const { openMinutes, closeMinutes, minutesPerCandle, realSecondsPerCandle } =
    TRADING_SESSION;

  const elapsedSeconds = state.elapsedSeconds + TICK_SECONDS;
  // Wall time drives which candle is forming; the candle itself is stamped with
  // the in-game clock, which runs far faster.
  const slot =
    openMinutes +
    Math.floor(elapsedSeconds / realSecondsPerCandle) * minutesPerCandle;

  if (slot >= closeMinutes) {
    return { ...state, elapsedSeconds, closed: true };
  }

  const forming = state.candles[state.candles.length - 1];
  const shock = (random() * 2 - 1) * VOLATILITY;
  const price = Math.max(
    0.01,
    forming.close * (1 + DRIFT + state.impulse + shock),
  );
  const impulse = state.impulse * IMPULSE_DECAY;

  // Crossing into the next slot closes the forming candle and opens the next at
  // the price it closed at, so the series has no gaps.
  const candles =
    slot > forming.t
      ? [
          ...state.candles,
          {
            t: slot,
            open: forming.close,
            high: Math.max(forming.close, price),
            low: Math.min(forming.close, price),
            close: price,
          },
        ]
      : [
          ...state.candles.slice(0, -1),
          {
            ...forming,
            high: Math.max(forming.high, price),
            low: Math.min(forming.low, price),
            close: price,
          },
        ];

  return { candles, impulse, elapsedSeconds, closed: false };
}
