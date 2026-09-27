// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EndScene from "./end-scene";

afterEach(cleanup);

const round = {
  cash: 1_240_500.5,
  shares: 0,
  insanity: 64,
  at: 15 * 60 + 40,
  onBackToMenu: () => {},
};

describe("EndScene", () => {
  it("names a win", () => {
    render(<EndScene {...round} outcome="won" />);

    expect(screen.getByRole("heading").textContent).toMatch(/out/i);
  });

  it("names a full meter", () => {
    render(<EndScene {...round} outcome="insane" cash={12_000} />);

    expect(screen.getByRole("heading").textContent).toMatch(/mind/i);
  });

  it("names the bell", () => {
    render(<EndScene {...round} outcome="bell" cash={12_000} />);

    expect(screen.getByRole("heading").textContent).toMatch(/bell/i);
  });

  it("shows the closing tally", () => {
    render(<EndScene {...round} outcome="won" />);

    expect(screen.getByText(/1\.240\.500,50/)).toBeDefined();
    expect(screen.getByText("64 / 100")).toBeDefined();
    expect(screen.getByText("15:40")).toBeDefined();
  });

  it("freezes the tally, so a ticking market cannot rewrite it", () => {
    // The market keeps running under the ending until the player leaves, and a
    // tally that tracked it would show a clock still moving after the day had
    // ended.
    const { rerender } = render(<EndScene {...round} outcome="won" />);

    rerender(<EndScene {...round} outcome="won" at={17 * 60 + 25} />);

    expect(screen.getByText("15:40")).toBeDefined();
  });

  it("goes back to the menu", () => {
    const onBackToMenu = vi.fn();
    render(<EndScene {...round} outcome="won" onBackToMenu={onBackToMenu} />);

    screen.getByRole("button", { name: /menu/i }).click();

    expect(onBackToMenu).toHaveBeenCalledTimes(1);
  });

  it("offers the menu and nothing else", () => {
    // Deliberately the whole button list rather than "no Hype button", which no
    // version of this component could ever have had. An ending that grew a
    // second way out — a restart, a share — is a change to what the round is
    // allowed to do next, and should have to say so here.
    render(<EndScene {...round} outcome="insane" cash={12_000} />);

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Back to menu"]);
  });
});
