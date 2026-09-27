// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import StartScene from "./start-scene";

afterEach(cleanup);

/*
  Plain vitest matchers, as everywhere else in this project: there is no
  `@testing-library/jest-dom` here to lean on.
*/
describe("StartScene", () => {
  it("starts the game when the player picks it from the menu", () => {
    const onStart = vi.fn();
    render(<StartScene onStart={onStart} />);

    act(() => {
      screen.getByRole("button", { name: /start game/i }).click();
    });

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("keeps the highscore list out of reach while there is none", () => {
    // The entry holds its place in the menu, but a round has no score to list
    // yet. A button that looks live and does nothing is worse than a dark one.
    render(<StartScene onStart={vi.fn()} />);

    const highscores = screen.getByRole("button", { name: /highscore/i });

    expect(highscores.hasAttribute("disabled")).toBe(true);
  });
});
