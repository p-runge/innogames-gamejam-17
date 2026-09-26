// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TipPayload } from "~/lib/events/types";
import DmDock, { AUTO_CLOSE_MS } from "./dm-dock";

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
 * The region is in the document from the first render even when the dock is
 * shut — a live region inserted together with its content is commonly never
 * announced — so "closed" is an empty region, not a missing one.
 */
function logText(): string {
  return screen.getByRole("log").textContent ?? "";
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Explicit, because Testing Library only registers its own auto-cleanup when
  // vitest runs with `globals: true`, and this project does not. Without it
  // every render stays in the document and a later `queryByRole` finds an
  // earlier test's dock.
  cleanup();
  vi.useRealTimers();
});

/*
  Plain vitest matchers throughout. `@testing-library/jest-dom` is not a
  dependency of this project, and adding one for `toBeInTheDocument` would buy
  nothing the assertions below do not already say.
*/
describe("DmDock", () => {
  it("stays shut with nothing to show", () => {
    render(<DmDock tips={[]} />);

    expect(logText()).toBe("");
  });

  it("opens itself when a tip arrives", () => {
    const { rerender } = render(<DmDock tips={[]} />);

    rerender(<DmDock tips={[tip()]} />);

    expect(logText()).toContain("line two at nord");
  });

  it("closes again on its own", () => {
    const { rerender } = render(<DmDock tips={[]} />);
    rerender(<DmDock tips={[tip()]} />);

    act(() => {
      vi.advanceTimersByTime(AUTO_CLOSE_MS + 100);
    });

    expect(logText()).toBe("");
  });

  it("keeps an unread count after it closes", () => {
    const { rerender } = render(<DmDock tips={[]} />);
    rerender(<DmDock tips={[tip()]} />);

    act(() => {
      vi.advanceTimersByTime(AUTO_CLOSE_MS + 100);
    });

    expect(screen.getByRole("button").textContent).toContain("1");
  });

  it("clears the count when the player opens it", () => {
    const { rerender } = render(<DmDock tips={[]} />);
    rerender(<DmDock tips={[tip()]} />);
    act(() => {
      vi.advanceTimersByTime(AUTO_CLOSE_MS + 100);
    });

    act(() => {
      screen.getByRole("button").click();
    });

    expect(screen.getByRole("button").textContent).not.toContain("1");
  });

  it("does not reopen for a rerender that adds no tip", () => {
    // The provider rerenders on every price tick, four times a second. A dock
    // that reopened on each of them would never close.
    const only = tip();
    const { rerender } = render(<DmDock tips={[only]} />);
    act(() => {
      vi.advanceTimersByTime(AUTO_CLOSE_MS + 100);
    });

    rerender(<DmDock tips={[only]} />);

    expect(logText()).toBe("");
  });

  it("restarts the countdown when a second tip lands while it is open", () => {
    const first = tip({ id: "a" });
    const { rerender } = render(<DmDock tips={[]} />);
    rerender(<DmDock tips={[first]} />);

    act(() => {
      vi.advanceTimersByTime(AUTO_CLOSE_MS - 1_000);
    });
    rerender(<DmDock tips={[first, tip({ id: "b", body: "second" })]} />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    // The first message's countdown would have expired by now; the second
    // one's has not. Inheriting the remainder would flash a tip for a second.
    expect(logText()).toContain("second");
  });

  it("stays open when the player opened it on purpose", () => {
    // Eight seconds is how long an arriving message shows itself, not a limit
    // on reading. Snapping shut mid-read is how a missed tip stays missed, and
    // the badge points the player here precisely to recover one.
    render(<DmDock tips={[tip()]} />);

    act(() => {
      screen.getByRole("button").click();
    });
    act(() => {
      vi.advanceTimersByTime(AUTO_CLOSE_MS * 3);
    });

    expect(logText()).toContain("line two at nord");
  });

  it("shows the newest message last", () => {
    render(
      <DmDock
        tips={[
          tip({ id: "a", body: "first thing" }),
          tip({ id: "b", body: "second thing" }),
        ]}
      />,
    );

    // Mounting with a history does not open the dock, so the player opens it.
    act(() => {
      screen.getByRole("button").click();
    });

    const text = logText();
    expect(text.indexOf("second thing")).toBeGreaterThan(
      text.indexOf("first thing"),
    );
  });

  it("stays shut for the history that arrives on a mid-round reload", () => {
    /*
      The real reload sequence, which is why this renders empty first: the
      provider mounts with no snapshot, so the dock's first render sees an
      empty list, and the round's eight tips land a moment later in exactly the
      shape a newly arriving tip has. `ready` is what tells the two apart.
    */
    const history = [tip({ id: "a" }), tip({ id: "b" })];
    const { rerender } = render(<DmDock tips={[]} ready={false} />);

    rerender(<DmDock tips={history} ready />);

    expect(logText()).not.toContain(
      "line two at nord",
    );
    expect(screen.getByRole("button").textContent).not.toContain("2");
  });

  it("still opens for a tip that arrives after the snapshot has loaded", () => {
    // The other half of the same rule: once the history is in, anything new is
    // news. Without this the fix above would simply mute the feature.
    const { rerender } = render(<DmDock tips={[]} ready={false} />);
    rerender(<DmDock tips={[tip({ id: "a" })]} ready />);

    rerender(<DmDock tips={[tip({ id: "a" }), tip({ id: "b" })]} ready />);

    expect(logText()).toContain("line two at nord");
    expect(screen.getByRole("button").textContent).toContain("1");
  });
});
