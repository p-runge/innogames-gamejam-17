// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useRoundStream } from "./use-round-stream";

afterEach(cleanup);

/*
  Driven through a button rather than by holding the hook's return value in a
  module variable, which is the shape this project's lint rules refuse — and
  rightly, since a stale copy of it is exactly the bug a hook test should not
  introduce.
*/
function Probe() {
  const { round, open } = useRoundStream();

  return (
    <div>
      <output data-testid="round">{round}</output>
      <button type="button" onClick={open}>
        open
      </button>
    </div>
  );
}

function press() {
  act(() => screen.getByRole("button", { name: "open" }).click());
}

function round() {
  return screen.getByTestId("round").textContent;
}

describe("useRoundStream", () => {
  it("starts before the first round", () => {
    render(<Probe />);

    expect(round()).toBe("0");
  });

  it("counts every round it opens", () => {
    render(<Probe />);

    press();
    expect(round()).toBe("1");

    press();
    expect(round()).toBe("2");
  });
});
