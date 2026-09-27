import { describe, expect, it } from "vitest";

import { applyPost, bandFor, costOf, INSANITY_MAX } from "./insanity";

describe("bandFor", () => {
  it("opens lucid", () => {
    expect(bandFor(0).id).toBe("lucid");
    expect(bandFor(39.9).id).toBe("lucid");
  });

  it("gives a boundary to the harsher band", () => {
    expect(bandFor(40).id).toBe("twitchy");
    expect(bandFor(70).id).toBe("feral");
    expect(bandFor(88).id).toBe("gone");
  });

  it("stays in the last band at the top of the meter", () => {
    expect(bandFor(INSANITY_MAX).id).toBe("gone");
  });
});

describe("costOf", () => {
  it("charges a post its full price in every band", () => {
    expect(costOf(0, "moon")).toBe(2);
    expect(costOf(95, "moon")).toBe(2);
    expect(costOf(0, "bullish")).toBe(0.6);
    expect(costOf(95, "bullish")).toBe(0.6);
  });

  it("pays a refund in full while the head is clear", () => {
    expect(costOf(0, "dump")).toBe(-1);
    expect(costOf(50, "bearish")).toBe(-0.3);
  });

  it("shrinks the refund with the damage", () => {
    // The column the whole design rests on: without it, living at 88 and
    // trading Hype against Panic is the only correct play.
    expect(costOf(70, "dump")).toBe(-0.5);
    expect(costOf(88, "dump")).toBe(-0.25);
  });

  it("rounds, so the smallest refund is a number and not a float artifact", () => {
    expect(costOf(88, "neutral")).toBe(-0.05);
  });
});

describe("applyPost", () => {
  it("charges and refunds", () => {
    expect(applyPost(0, "moon")).toBe(2);
    expect(applyPost(10, "dump")).toBe(9);
  });

  it("never reads below zero", () => {
    expect(applyPost(0, "dump")).toBe(0);
    expect(applyPost(0.1, "neutral")).toBe(0);
  });

  it("never reads above the maximum", () => {
    expect(applyPost(99, "moon")).toBe(INSANITY_MAX);
  });

  it("does not drift over a whole round", () => {
    // Sixty bullish posts is 36 exactly. Summed as raw binary floats it is
    // not, and a meter reading 35.999999999999996 shows a wrong number and
    // can miss its own ceiling.
    let insanity = 0;
    for (let index = 0; index < 60; index++) {
      insanity = applyPost(insanity, "bullish");
    }
    expect(insanity).toBe(36);
  });

  it("reads the band once, before the charge", () => {
    // A dump at exactly 70 is refunded at Feral's halved rate, which lands it
    // back in Twitchy. The rate must be the one in force when the button was
    // pressed, not the one the result implies.
    expect(applyPost(70, "dump")).toBe(69.5);
  });
});
