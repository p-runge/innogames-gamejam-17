// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Mood } from "~/lib/market/types";
import { TRADING_SESSION } from "~/lib/trading-session";
import {
  FIRST_TIP_MS,
  MAX_GAP_MS,
  useInformantDesk,
} from "./use-informant-desk";

const impulses: { mood: Mood; scale: number }[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  impulses.length = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Probe({ running }: { running: boolean }) {
  const tips = useInformantDesk({
    running,
    at: TRADING_SESSION.openMinutes,
    applyImpulse: (mood, scale) => impulses.push({ mood, scale }),
  });

  return (
    <ul data-testid="tips">
      {tips.map((tip) => (
        <li key={tip.id}>{tip.body}</li>
      ))}
    </ul>
  );
}

function count() {
  return screen.getByTestId("tips").children.length;
}

describe("useInformantDesk", () => {
  it("says nothing before a round is running", () => {
    render(<Probe running={false} />);

    act(() => vi.advanceTimersByTime(FIRST_TIP_MS * 3));

    expect(count()).toBe(0);
  });

  it("waits out the opening before the first tip", () => {
    render(<Probe running />);

    act(() => vi.advanceTimersByTime(FIRST_TIP_MS - 1));
    expect(count()).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    expect(count()).toBe(1);
  });

  it("keeps leaking on its own schedule", () => {
    render(<Probe running />);

    act(() => vi.advanceTimersByTime(FIRST_TIP_MS + MAX_GAP_MS + 1_000));

    expect(count()).toBeGreaterThan(1);
  });

  it("does not repeat itself over a whole round", () => {
    render(<Probe running />);

    act(() => vi.advanceTimersByTime(FIRST_TIP_MS + MAX_GAP_MS * 12));

    const bodies = Array.from(screen.getByTestId("tips").children).map(
      (node) => node.textContent,
    );
    expect(bodies.length).toBeGreaterThan(5);
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it("pays out after the message, never before it", () => {
    // The one promise this feature makes: the message comes first. The payout
    // clock starts at publication, so nothing can have landed at the moment the
    // tip appears, whatever delay was drawn for it.
    render(<Probe running />);

    act(() => vi.advanceTimersByTime(FIRST_TIP_MS));

    expect(count()).toBe(1);
    expect(impulses).toHaveLength(0);
  });

  it("delivers the payout it promised, once its delay has run", () => {
    // Runs on until a paying event has been drawn, because `drawEvent` makes
    // some rumours false on purpose and a false one pays nothing. Bounded, so a
    // run of false draws fails the test rather than hanging it.
    render(<Probe running />);

    act(() => vi.advanceTimersByTime(FIRST_TIP_MS + 20_000));
    for (let round = 0; round < 20 && impulses.length === 0; round++) {
      act(() => vi.advanceTimersByTime(MAX_GAP_MS + 20_000));
    }

    expect(impulses.length).toBeGreaterThan(0);
    expect(impulses[0].scale).toBeGreaterThan(0);
  });

  it("drops a promised payout when the round ends", () => {
    // The whole reason the server desk carried an epoch counter. A hook should
    // not need one: ending the round tears the schedule down and its cleanup
    // clears the timers it armed.
    const { rerender } = render(<Probe running />);
    act(() => vi.advanceTimersByTime(FIRST_TIP_MS));
    const armed = impulses.length;

    rerender(<Probe running={false} />);
    act(() => vi.advanceTimersByTime(120_000));

    expect(impulses.length).toBe(armed);
  });

  it("forgets the last round's tips when a new one starts", () => {
    const { rerender } = render(<Probe running />);
    act(() => vi.advanceTimersByTime(FIRST_TIP_MS));
    expect(count()).toBe(1);

    rerender(<Probe running={false} />);
    rerender(<Probe running />);

    expect(count()).toBe(0);
  });

  it("leaves nothing scheduled once it unmounts", () => {
    const { unmount } = render(<Probe running />);
    act(() => vi.advanceTimersByTime(FIRST_TIP_MS));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
