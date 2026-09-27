// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TweetPayload } from "~/lib/news/types";
import { REPLY_DELAY_MS } from "~/lib/feed/replies";
import type { Mood } from "~/lib/market/types";
import { TRADING_SESSION } from "~/lib/trading-session";
import { useYThread } from "./use-y-thread";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Probe({
  publish,
  cooldownMs,
  replies,
}: {
  publish: (payload: TweetPayload, mood: Mood) => void;
  cooldownMs?: number;
  replies?: number;
}) {
  const { post, posts, cooling } = useYThread({ publish, cooldownMs, replies });

  return (
    <div>
      <output data-testid="cooling">{String(cooling)}</output>
      <ul>
        {posts
          .filter((entry) => !entry.mine)
          .map((entry) => (
            <li key={entry.id} data-testid="reply">
              {entry.body}
            </li>
          ))}
      </ul>
      <button
        type="button"
        onClick={() => post("moon", TRADING_SESSION.openMinutes)}
      >
        hype
      </button>
    </div>
  );
}

function press() {
  act(() => screen.getByRole("button", { name: "hype" }).click());
}

describe("useYThread", () => {
  it("publishes a post once", () => {
    const publish = vi.fn();
    render(<Probe publish={publish} />);

    press();

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("tells the caller which mood went out", () => {
    // The caller charges the Insane-O-Meter from this argument. Drop it and the
    // post still goes, the price still moves, and the meter silently never
    // fills again — which no other test in the suite would notice.
    const publish = vi.fn();
    render(<Probe publish={publish} />);

    press();

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ suggestionId: expect.any(String) }),
      "moon",
    );
  });

  it("draws its replies at the count the caller asked for", () => {
    // The upper bands flood the feed by raising this. Nothing else pins it, and
    // a default that quietly won that argument would take the escalation's
    // loudest symptom with it.
    const publish = vi.fn();
    render(<Probe publish={publish} replies={3} />);

    press();
    act(() => vi.advanceTimersByTime(REPLY_DELAY_MS));

    expect(screen.getAllByTestId("reply")).toHaveLength(3);
  });

  it("swallows a press during the cooldown without publishing it", () => {
    // The meter is charged from `publish`, so a swallowed press that still
    // reached it would bill the player for a post that never went out.
    const publish = vi.fn();
    render(<Probe publish={publish} />);

    press();
    press();
    press();

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it("takes its cooldown from the caller", () => {
    const publish = vi.fn();
    render(<Probe publish={publish} cooldownMs={1_600} />);

    press();
    act(() => vi.advanceTimersByTime(1_599));
    press();
    expect(publish).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(1));
    press();
    expect(publish).toHaveBeenCalledTimes(2);
  });
});
