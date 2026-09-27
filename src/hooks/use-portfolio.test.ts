import { describe, expect, it } from "vitest";

import { averageCost } from "./use-portfolio";

describe("averageCost", () => {
  it("is nothing while no position is held", () => {
    expect(averageCost({ shares: 0, costBasis: 0 })).toBe(0);
  });

  it("is what one share cost on average", () => {
    expect(averageCost({ shares: 4, costBasis: 400 })).toBe(100);
  });

  it("blends two buys at different prices", () => {
    // Two at 100 and two at 200 is an average entry of 150 — which is the price
    // a sale has to beat to count as a win.
    expect(averageCost({ shares: 4, costBasis: 2 * 100 + 2 * 200 })).toBe(150);
  });

  it("does not divide by a position that was fully sold", () => {
    expect(averageCost({ shares: 0, costBasis: 250 })).toBe(0);
  });
});
