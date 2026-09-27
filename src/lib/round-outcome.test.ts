import { describe, expect, it } from "vitest";

import { roundHasClosed, resolveOutcome, WIN_CASH } from "./round-outcome";

const midRound = { insanity: 12, cash: 40_000, closed: false };

describe("roundHasClosed", () => {
  it("believes a snapshot taken since the round started", () => {
    expect(
      roundHasClosed({ closed: true, snapshotAt: 2_000, startedAt: 1_000 }),
    ).toBe(true);
  });

  it("does not end a round that is running", () => {
    expect(
      roundHasClosed({ closed: false, snapshotAt: 2_000, startedAt: 1_000 }),
    ).toBe(false);
  });

  it("ignores a flag left over from the round before", () => {
    // The bug this exists for: pressing start after a finished round switched to
    // the trading screen while the cached snapshot still said `closed`, so the
    // new round was called over on its first frame and the player was thrown
    // straight back to the game over screen.
    expect(
      roundHasClosed({ closed: true, snapshotAt: 1_000, startedAt: 2_000 }),
    ).toBe(false);
  });

  it("believes a snapshot on a page that never pressed start", () => {
    // A second browser joining a round that is already over has no start of its
    // own, so there is nothing for the snapshot to be newer than.
    expect(
      roundHasClosed({ closed: true, snapshotAt: 1_000, startedAt: 0 }),
    ).toBe(true);
  });
});

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
