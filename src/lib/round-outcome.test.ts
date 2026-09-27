import { describe, expect, it } from "vitest";

import { resolveOutcome, WIN_CASH } from "./round-outcome";

const midRound = { insanity: 12, cash: 40_000, closed: false };


describe("resolveOutcome", () => {
  it("lets a round in progress run", () => {
    expect(resolveOutcome(midRound)).toBeNull();
  });

  it("wins on cash in the account", () => {
    expect(resolveOutcome({ ...midRound, cash: WIN_CASH })).toBe("won");
  });

  it("does not win one cent short", () => {
    expect(resolveOutcome({ ...midRound, cash: WIN_CASH - 0.01 })).toBeNull();
  });

  it("loses on a full meter", () => {
    expect(resolveOutcome({ ...midRound, insanity: 100 })).toBe("insane");
  });

  it("loses at the closing bell", () => {
    expect(resolveOutcome({ ...midRound, closed: true })).toBe("bell");
  });

  it("lets the million beat a full meter", () => {
    // The player pulled it off on their last breath. Dying with the money
    // already in the bank is the one ending they would never forgive.
    expect(resolveOutcome({ insanity: 100, cash: WIN_CASH, closed: true })).toBe(
      "won",
    );
  });

  it("names the meter before the bell when both have gone", () => {
    expect(resolveOutcome({ insanity: 100, cash: 0, closed: true })).toBe(
      "insane",
    );
  });
});
