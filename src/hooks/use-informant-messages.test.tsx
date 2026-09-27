// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TipPayload } from "~/lib/news/types";
import { FABRICATION_GAP_MS } from "~/lib/feed/fabrications";
import { BANDS, type Band } from "~/lib/insanity";
import { useInformantMessages } from "./use-informant-messages";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const lucid = BANDS[0];
const gone = BANDS[3];

function tip(id: string): TipPayload {
  return {
    id,
    sender: "nachtschicht",
    handle: "nachtschicht",
    body: "the friday numbers went out twice",
    at: 600,
  };
}

function Probe({
  tips,
  band,
  round = 1,
}: {
  tips: TipPayload[];
  band: Band;
  round?: number;
}) {
  const messages = useInformantMessages({ tips, band, at: 600, round });

  return (
    <ul data-testid="messages">
      {messages.map((message) => (
        <li key={message.id}>{message.id}</li>
      ))}
    </ul>
  );
}

function ids() {
  return Array.from(screen.getByTestId("messages").children).map(
    (node) => node.textContent,
  );
}

describe("useInformantMessages", () => {
  it("passes the real tips straight through while the head is clear", () => {
    render(<Probe tips={[tip("a"), tip("b")]} band={lucid} />);

    expect(ids()).toEqual(["a", "b"]);

    act(() => vi.advanceTimersByTime(60_000));
    expect(ids()).toEqual(["a", "b"]);
  });

  it("appends a real tip that arrives", () => {
    const { rerender } = render(<Probe tips={[tip("a")]} band={lucid} />);

    rerender(<Probe tips={[tip("a"), tip("b")]} band={lucid} />);

    expect(ids()).toEqual(["a", "b"]);
  });

  it("invents messages once the head is gone", () => {
    render(<Probe tips={[tip("a")]} band={gone} />);

    act(() => vi.advanceTimersByTime(10_000));

    const after = ids();
    expect(after.length).toBeGreaterThan(1);
    expect(after[0]).toBe("a");
    expect(after.at(-1)).toMatch(/^fake-/);
  });

  it("invents nothing before there is anybody to impersonate", () => {
    // A fabrication wears the last real tip's account. With no tip yet there is
    // no account, and inventing a name would make the lie the obvious one.
    render(<Probe tips={[]} band={gone} />);

    act(() => vi.advanceTimersByTime(60_000));

    expect(ids()).toEqual([]);
  });

  it("keeps inventing once a tip finally arrives", () => {
    const { rerender } = render(<Probe tips={[]} band={gone} />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(ids()).toEqual([]);

    rerender(<Probe tips={[tip("a")]} band={gone} />);
    act(() => vi.advanceTimersByTime(10_000));

    expect(ids().at(-1)).toMatch(/^fake-/);
  });

  it("puts a real tip after a fabrication that came first", () => {
    const { rerender } = render(<Probe tips={[tip("a")]} band={gone} />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(ids().at(-1)).toMatch(/^fake-/);

    rerender(<Probe tips={[tip("a"), tip("b")]} band={gone} />);

    // The phone announces whatever is last, so arrival order has to survive the
    // merge or a real tip would be swallowed by an older lie.
    expect(ids().at(-1)).toBe("b");
  });

  it("forgets the last round, lies and all", () => {
    // The phone is mounted on the desk and never unmounts, so without this the
    // next round opened showing the previous one's messages — and the previous
    // one's fabrications, which by then have nothing behind them at all.
    const { rerender } = render(<Probe tips={[tip("a")]} band={gone} round={1} />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(ids().length).toBeGreaterThan(1);

    rerender(<Probe tips={[]} band={gone} round={2} />);

    expect(ids()).toEqual([]);
  });

  it("does not restart its schedule on every price tick", () => {
    // The provider rerenders four times a second. A schedule that re-armed on
    // each of them would never reach its own gap, and nothing would ever be
    // invented.
    const { rerender } = render(<Probe tips={[tip("a")]} band={gone} />);

    // Past the band's widest gap, so the assertion does not depend on which
    // jitter this run happened to draw.
    const beyondTheWidestGap = FABRICATION_GAP_MS.gone!.max + 1_000;
    for (let elapsed = 0; elapsed < beyondTheWidestGap; elapsed += 400) {
      act(() => vi.advanceTimersByTime(400));
      rerender(<Probe tips={[tip("a")]} band={gone} />);
    }

    expect(ids().length).toBeGreaterThan(1);
  });
});
