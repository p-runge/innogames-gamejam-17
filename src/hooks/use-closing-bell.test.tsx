// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Candle } from "~/lib/market/types";
import { TRADING_SESSION } from "~/lib/trading-session";
import { FINAL_SLOT, useClosingBell } from "./use-closing-bell";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function candleAt(t: number): Candle {
  return { t, open: 1240, high: 1240, low: 1240, close: 1240 };
}

function Probe({ candles, closed }: { candles: Candle[]; closed?: boolean }) {
  return (
    <output data-testid="rung">
      {String(useClosingBell({ candles, closed }))}
    </output>
  );
}

function rung() {
  return screen.getByTestId("rung").textContent;
}

const oneCandle = TRADING_SESSION.realSecondsPerCandle * 1_000;

describe("useClosingBell", () => {
  it("has not rung mid-session", () => {
    render(<Probe candles={[candleAt(TRADING_SESSION.openMinutes)]} />);

    expect(rung()).toBe("false");
  });

  it("has not rung while the final candle is still forming", () => {
    render(<Probe candles={[candleAt(FINAL_SLOT)]} />);

    act(() => vi.advanceTimersByTime(oneCandle - 1));
    expect(rung()).toBe("false");
  });

  it("rings once the final candle has run out", () => {
    render(<Probe candles={[candleAt(FINAL_SLOT)]} />);

    act(() => vi.advanceTimersByTime(oneCandle));
    expect(rung()).toBe("true");
  });

  it("takes the server's word for a round that is already over", () => {
    // A page joined after the bell sees a finished series and no more events.
    // The derived timer alone would hand it five more seconds of play, so the
    // snapshot's own flag is the backstop.
    render(<Probe candles={[candleAt(FINAL_SLOT)]} closed />);

    expect(rung()).toBe("true");
  });

  it("does not un-ring when the series is replaced", () => {
    const { rerender } = render(<Probe candles={[candleAt(FINAL_SLOT)]} />);
    act(() => vi.advanceTimersByTime(oneCandle));
    expect(rung()).toBe("true");

    rerender(<Probe candles={[candleAt(TRADING_SESSION.openMinutes)]} />);
    expect(rung()).toBe("true");
  });

  it("puts the final slot one candle before the close", () => {
    // `advance` closes the market once the clock reaches the close, so no candle
    // is ever stamped with it.
    expect(FINAL_SLOT).toBe(
      TRADING_SESSION.closeMinutes - TRADING_SESSION.minutesPerCandle,
    );
  });
});
