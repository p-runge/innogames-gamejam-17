import { describe, expect, it } from "vitest";

import { drawFabrication, FABRICATION_GAP_MS } from "./fabrications";

const source = { at: 600, sender: "nachtschicht", handle: "nachtschicht" };

/** Every line id the pool could possibly mint, and then some. */
const everyLine = Array.from({ length: 200 }, (_, index) => `fab-${index}`);

describe("FABRICATION_GAP_MS", () => {
  it("says nothing for the two clear-headed bands", () => {
    expect(FABRICATION_GAP_MS.lucid).toBeUndefined();
    expect(FABRICATION_GAP_MS.twitchy).toBeUndefined();
  });

  it("gets faster the worse things get", () => {
    expect(FABRICATION_GAP_MS.gone!.max).toBeLessThan(
      FABRICATION_GAP_MS.feral!.min,
    );
  });
});

describe("drawFabrication", () => {
  it("wears the sender it was given, so it cannot be told from a real tip", () => {
    const { tip } = drawFabrication({ ...source, random: () => 0 });

    expect(tip.sender).toBe("nachtschicht");
    expect(tip.handle).toBe("nachtschicht");
    expect(tip.at).toBe(600);
  });

  it("gives every message its own id", () => {
    const first = drawFabrication({ ...source, random: () => 0 });
    const second = drawFabrication({ ...source, random: () => 0 });

    expect(first.tip.id).not.toBe(second.tip.id);
  });

  it("skips a line it has already used", () => {
    const first = drawFabrication({ ...source, random: () => 0 });
    const second = drawFabrication({
      ...source,
      exclude: [first.lineId],
      random: () => 0,
    });

    expect(second.lineId).not.toBe(first.lineId);
    expect(second.tip.body).not.toBe(first.tip.body);
  });

  it("comes back round rather than running dry", () => {
    // A round long enough to exhaust the pool is one the player is losing badly,
    // and a phone that stopped inventing would read as the distortion lifting.
    const { tip } = drawFabrication({
      ...source,
      exclude: everyLine,
      random: () => 0,
    });

    expect(tip.body.length).toBeGreaterThan(0);
  });

  it("stays inside the pool at the top of the random range", () => {
    // `Math.random()` returns [0, 1), but a stub is free to hand back 1 and an
    // off-by-one here would read a line that is not there.
    expect(() =>
      drawFabrication({ ...source, random: () => 1 }),
    ).not.toThrow();
  });

  it("writes in the informant's register, not the crowd's", () => {
    // The informant reports a fact and never what it does to the price, so a
    // fabrication that named a direction or a figure would be the one message a
    // player could discount on sight.
    for (let index = 0; index < 200; index++) {
      const { tip } = drawFabrication({ ...source, random: () => index / 200 });

      expect(tip.body).toBe(tip.body.toLowerCase());
      expect(tip.body).not.toMatch(/\d/);
      expect(tip.body).not.toMatch(/\.$/);
      expect(tip.body).not.toMatch(/\b(buy|sell|price|hold|holding|dump|pump)\b/);
    }
  });
});
