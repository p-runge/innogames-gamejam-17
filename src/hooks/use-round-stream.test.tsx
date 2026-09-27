// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TipPayload } from "~/lib/events/types";
import type { Candle } from "~/lib/market/types";
import { useRoundStream } from "./use-round-stream";

afterEach(cleanup);

function candleAt(t: number): Candle {
  return { t, open: 1240, high: 1240, low: 1240, close: 1240 };
}

function tip(id: string): TipPayload {
  return {
    id,
    sender: "nachtschicht",
    handle: "nachtschicht",
    body: "they changed the locks over the weekend",
    at: 600,
  };
}

/*
  Driven through buttons rather than by holding the hook's return value in a
  module variable, which is the shape this project's lint rules refuse — and
  rightly, since a stale copy of it is exactly the bug a hook test should not
  introduce. Same pattern as the insanity provider's test.
*/
function Probe() {
  const { round, candles, tips, open, addCandle, addTip } = useRoundStream();

  return (
    <div>
      <output data-testid="round">{round}</output>
      <output data-testid="candles">{candles.map((c) => c.t).join(",")}</output>
      <output data-testid="tips">{tips.map((t) => t.id).join(",")}</output>
      <button type="button" onClick={open}>
        open
      </button>
      <button type="button" onClick={() => addCandle(candleAt(540))}>
        candle 540
      </button>
      <button type="button" onClick={() => addCandle(candleAt(600))}>
        candle 600
      </button>
      <button type="button" onClick={() => addCandle(candleAt(1045))}>
        candle 1045
      </button>
      <button type="button" onClick={() => addTip(tip("a"))}>
        tip a
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

describe("useRoundStream", () => {
  it("opens empty", () => {
    render(<Probe />);

    expect(read("candles")).toBe("");
    expect(read("tips")).toBe("");
    expect(read("round")).toBe("0");
  });

  it("collects what the stream delivers", () => {
    render(<Probe />);

    press("candle 540");
    press("candle 600");
    press("tip a");

    expect(read("candles")).toBe("540,600");
    expect(read("tips")).toBe("a");
  });

  it("throws the last round away when a new one opens", () => {
    // The bug this exists for: nothing ever cleared these, and the provider
    // lives above the scene switch. A second round therefore started holding the
    // first one's candles, whose last slot is the close — so the closing bell
    // fired five seconds into a day that had just begun, and every real candle
    // of that day was then dropped for sitting behind the stale one.
    render(<Probe />);

    press("candle 1045");
    press("tip a");
    press("open");

    expect(read("candles")).toBe("");
    expect(read("tips")).toBe("");
  });

  it("counts the rounds it has opened, so what keyed off one can start over", () => {
    render(<Probe />);

    press("open");
    expect(read("round")).toBe("1");

    press("open");
    expect(read("round")).toBe("2");
  });

  it("still refuses a candle from behind the newest one", () => {
    // `mergeCandle`'s own rule, which the stream must not lose on the way
    // through: an out-of-order arrival would rewrite history behind the newest
    // slot, and the chart reads that as the series jumping backwards.
    render(<Probe />);

    press("candle 600");
    press("candle 540");

    expect(read("candles")).toBe("600");
  });
});
