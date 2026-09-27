// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TICK_SECONDS } from "~/lib/market/series";
import { TRADING_SESSION } from "~/lib/trading-session";
import { useMarket } from "./use-market";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Probe() {
  const { candles, closed, open, applyImpulse } = useMarket();

  return (
    <div>
      <output data-testid="count">{candles.length}</output>
      <output data-testid="closed">{String(closed)}</output>
      <output data-testid="last">{candles.at(-1)?.t ?? ""}</output>
      <output data-testid="close">{candles.at(-1)?.close ?? ""}</output>
      <button type="button" onClick={open}>
        open
      </button>
      <button type="button" onClick={() => applyImpulse("moon")}>
        moon
      </button>
    </div>
  );
}

function press(label: string) {
  act(() => screen.getByRole("button", { name: label }).click());
}

function read(id: string) {
  return screen.getByTestId(id).textContent;
}

const ONE_CANDLE_MS = TRADING_SESSION.realSecondsPerCandle * 1_000;

/** Wall-clock milliseconds for one whole trading day. */
const WHOLE_DAY =
  ((TRADING_SESSION.closeMinutes - TRADING_SESSION.openMinutes) /
    TRADING_SESSION.minutesPerCandle) *
  ONE_CANDLE_MS;

describe("useMarket", () => {
  it("does not tick before the round is opened", () => {
    render(<Probe />);

    act(() => vi.advanceTimersByTime(10_000));

    expect(read("count")).toBe("0");
  });

  it("opens on one candle and fills the session", () => {
    render(<Probe />);
    press("open");

    expect(read("count")).toBe("1");

    act(() => vi.advanceTimersByTime(ONE_CANDLE_MS));
    expect(read("count")).toBe("2");
  });

  it("closes itself at the bell, with no inference needed", () => {
    render(<Probe />);
    press("open");

    act(() => vi.advanceTimersByTime(WHOLE_DAY));

    expect(read("closed")).toBe("true");
  });

  it("stops ticking once it has closed", () => {
    render(<Probe />);
    press("open");
    act(() => vi.advanceTimersByTime(WHOLE_DAY));
    const atBell = read("count");

    act(() => vi.advanceTimersByTime(60_000));

    expect(read("count")).toBe(atBell);
  });

  it("starts a fresh day when opened again", () => {
    render(<Probe />);
    press("open");
    act(() => vi.advanceTimersByTime(WHOLE_DAY));
    expect(read("closed")).toBe("true");

    press("open");

    expect(read("closed")).toBe("false");
    expect(read("count")).toBe("1");
    expect(read("last")).toBe(String(TRADING_SESSION.openMinutes));
  });

  it("does not leave a second ticker behind when reopened", () => {
    // Two tickers on one market run the day at double speed and report nothing
    // wrong. This is the failure the server engine guarded with an idempotent
    // start; a hook has to guard it by owning exactly one interval.
    render(<Probe />);
    press("open");
    press("open");

    act(() => vi.advanceTimersByTime(ONE_CANDLE_MS));

    expect(read("count")).toBe("2");
  });

  it("stops its ticker when it unmounts", () => {
    const { unmount } = render(<Probe />);
    press("open");

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("lets a post push the price up", () => {
    // Twelve ticks is about three seconds, over which a moon impulse is worth
    // roughly six percent while the random shock is worth well under one. The
    // margin is what makes this an assertion rather than a coin flip.
    render(<Probe />);
    press("open");
    act(() => vi.advanceTimersByTime(TICK_SECONDS * 1_000 * 12));
    const before = Number(read("close"));

    press("moon");
    act(() => vi.advanceTimersByTime(TICK_SECONDS * 1_000 * 12));

    expect(Number(read("close"))).toBeGreaterThan(before * 1.02);
  });

  it("ignores an impulse after the bell", () => {
    // The informant can arm a payout seconds before the close. It must not land
    // on a market that is over, and must not throw.
    render(<Probe />);
    press("open");
    act(() => vi.advanceTimersByTime(WHOLE_DAY));
    const atBell = read("close");

    expect(() => press("moon")).not.toThrow();

    act(() => vi.advanceTimersByTime(10_000));
    expect(read("close")).toBe(atBell);
  });

  it("ignores an impulse before a round has opened", () => {
    render(<Probe />);

    expect(() => press("moon")).not.toThrow();
    expect(read("count")).toBe("0");
  });
});
