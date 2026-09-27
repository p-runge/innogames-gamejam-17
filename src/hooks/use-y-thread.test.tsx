// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TweetPayload } from "~/lib/events/types";
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
}: {
  publish: (payload: TweetPayload) => void;
  cooldownMs?: number;
}) {
  const { post, cooling } = useYThread({ publish, cooldownMs });

  return (
    <div>
      <output data-testid="cooling">{String(cooling)}</output>
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
