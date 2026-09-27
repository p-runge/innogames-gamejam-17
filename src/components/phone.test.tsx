// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TipPayload } from "~/lib/news/types";
import { BUBBLE_MS, PhoneOnDesk } from "./phone";

function tip(overrides: Partial<TipPayload> = {}): TipPayload {
  return {
    id: "tip-1",
    sender: "nachtschicht",
    handle: "nachtschicht",
    body: "line two at nord is down and the fix is weeks out",
    at: 9 * 60 + 25,
    ...overrides,
  };
}

/**
 * What the live region currently holds.
 *
 * The region is in the document from the first render even when no message is
 * showing — a live region inserted together with its content is commonly never
 * announced — so "nothing showing" is an empty region, not a missing one.
 */
function bubbleText(): string {
  return screen.getByRole("log").textContent ?? "";
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Explicit, because Testing Library only registers its own auto-cleanup when
  // vitest runs with `globals: true`, and this project does not.
  cleanup();
  vi.useRealTimers();
});

describe("PhoneOnDesk", () => {
  it("shows nothing with no messages", () => {
    render(<PhoneOnDesk tips={[]} />);

    expect(bubbleText()).toBe("");
  });

  it("speaks up when a message arrives", () => {
    const { rerender } = render(<PhoneOnDesk tips={[]} />);

    rerender(<PhoneOnDesk tips={[tip()]} />);

    expect(bubbleText()).toContain("line two at nord");
  });

  it("goes quiet again on its own", () => {
    const { rerender } = render(<PhoneOnDesk tips={[]} />);
    rerender(<PhoneOnDesk tips={[tip()]} />);

    act(() => {
      vi.advanceTimersByTime(BUBBLE_MS + 100);
    });

    expect(bubbleText()).toBe("");
  });

  it("shows only the message that just landed", () => {
    // The bubble is an announcement, not an inbox: an older message is gone.
    const first = tip({ id: "a", body: "first thing" });
    const { rerender } = render(<PhoneOnDesk tips={[first]} />);

    rerender(<PhoneOnDesk tips={[first, tip({ id: "b", body: "second thing" })]} />);

    const text = bubbleText();
    expect(text).toContain("second thing");
    expect(text).not.toContain("first thing");
  });

  it("does not speak up for a rerender that adds no message", () => {
    // The provider rerenders on every price tick, four times a second. A phone
    // that buzzed on each of them would never stop.
    const only = tip();
    const { rerender } = render(<PhoneOnDesk tips={[only]} />);
    act(() => {
      vi.advanceTimersByTime(BUBBLE_MS + 100);
    });

    rerender(<PhoneOnDesk tips={[only]} />);

    expect(bubbleText()).toBe("");
  });

  it("restarts the countdown when a second message lands while one is up", () => {
    const first = tip({ id: "a" });
    const { rerender } = render(<PhoneOnDesk tips={[]} />);
    rerender(<PhoneOnDesk tips={[first]} />);

    act(() => {
      vi.advanceTimersByTime(BUBBLE_MS - 1_000);
    });
    rerender(<PhoneOnDesk tips={[first, tip({ id: "b", body: "second" })]} />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    // The first message's countdown would have expired by now; the second
    // one's has not. Inheriting the remainder would flash a message for a
    // second.
    expect(bubbleText()).toContain("second");
  });

  it("stays quiet for the history that arrives on a mid-round reload", () => {
    /*
      The real reload sequence, which is why this renders empty first: the
      provider mounts with no snapshot, so the phone's first render sees an
      empty list, and the round's eight messages land a moment later in exactly
      the shape an arriving message has. `ready` is what tells the two apart.
    */
    const history = [tip({ id: "a" }), tip({ id: "b" })];
    const { rerender } = render(<PhoneOnDesk tips={[]} ready={false} />);

    rerender(<PhoneOnDesk tips={history} ready />);

    expect(bubbleText()).toBe("");
  });

  it("still speaks up for a message that arrives after the snapshot has loaded", () => {
    // The other half of the same rule: once the history is in, anything new is
    // news. Without this the fix above would simply mute the feature.
    const { rerender } = render(<PhoneOnDesk tips={[]} ready={false} />);
    rerender(<PhoneOnDesk tips={[tip({ id: "a" })]} ready />);

    rerender(<PhoneOnDesk tips={[tip({ id: "a" }), tip({ id: "b" })]} ready />);

    expect(bubbleText()).toContain("line two at nord");
  });
});
