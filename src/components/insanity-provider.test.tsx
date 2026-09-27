// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import InsanityProvider, { useInsanity } from "./insanity-provider";

afterEach(cleanup);

function Probe() {
  const { insanity, band, register, cost, reset } = useInsanity();

  return (
    <div>
      <output data-testid="reading">{insanity}</output>
      <output data-testid="band">{band.id}</output>
      <output data-testid="dump-cost">{cost("dump")}</output>
      <button type="button" onClick={() => register("moon")}>
        hype
      </button>
      <button type="button" onClick={() => register("dump")}>
        panic
      </button>
      <button type="button" onClick={reset}>
        reset
      </button>
    </div>
  );
}

function mount() {
  render(
    <InsanityProvider>
      <Probe />
    </InsanityProvider>,
  );
}

function press(label: string, times = 1) {
  const button = screen.getByRole("button", { name: label });

  for (let index = 0; index < times; index++) {
    act(() => button.click());
  }
}

function reading() {
  return screen.getByTestId("reading").textContent;
}

function band() {
  return screen.getByTestId("band").textContent;
}

describe("InsanityProvider", () => {
  it("opens empty and lucid", () => {
    mount();

    expect(reading()).toBe("0");
    expect(band()).toBe("lucid");
  });

  it("charges a post and refunds a panic", () => {
    mount();

    press("hype", 3);
    expect(reading()).toBe("6");

    press("panic");
    expect(reading()).toBe("5");
  });

  it("climbs into the harsher bands", () => {
    mount();

    press("hype", 20);
    expect(reading()).toBe("40");
    expect(band()).toBe("twitchy");

    press("hype", 15);
    expect(band()).toBe("feral");
  });

  it("quotes the refund the current band actually pays", () => {
    mount();

    expect(screen.getByTestId("dump-cost").textContent).toBe("-1");

    press("hype", 35);
    expect(band()).toBe("feral");
    expect(screen.getByTestId("dump-cost").textContent).toBe("-0.5");
  });

  it("clears on reset, because the provider outlives a round", () => {
    mount();

    press("hype", 5);
    press("reset");

    expect(reading()).toBe("0");
    expect(band()).toBe("lucid");
  });

  it("refuses to be used without its provider", () => {
    // Rendered bare, so a missing context is a named error rather than a read
    // of `null` somewhere further down.
    expect(() => render(<Probe />)).toThrow(/InsanityProvider/);
  });
});
