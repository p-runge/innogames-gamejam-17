import { describe, expect, it } from "vitest";

import {
  drawEvent,
  impulseFor,
  MAX_DELAY_MS,
  MIN_DELAY_MS,
  RUMOR_PAYOUT_BONUS,
  STRENGTH_SCALE,
} from "./outcome";
import { TOPIC_SEEDS, type NewsEvent } from "./types";

const SEED = TOPIC_SEEDS[0];

/**
 * `drawEvent` takes a fixed number of draws in a fixed order, so a test can
 * hand it a sequence and pin every field at once. The order is: direction,
 * strength, credibility, rumour payout, delay.
 */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

function event(overrides: Partial<NewsEvent> = {}): NewsEvent {
  return {
    direction: "up",
    strength: "medium",
    credibility: "confirmed",
    seed: SEED,
    pays: true,
    delayMs: 8_000,
    ...overrides,
  };
}

describe("drawEvent", () => {
  it("draws upward on a low roll and downward on a high one", () => {
    expect(drawEvent(sequence([0.1, 0.1, 0.9, 0.9, 0]), SEED).direction).toBe(
      "up",
    );
    expect(drawEvent(sequence([0.9, 0.1, 0.9, 0.9, 0]), SEED).direction).toBe(
      "down",
    );
  });

  it("reaches every strength", () => {
    const strengths = [0.1, 0.5, 0.95].map(
      (roll) => drawEvent(sequence([0.1, roll, 0.9, 0.9, 0]), SEED).strength,
    );
    expect(strengths).toEqual(["small", "medium", "large"]);
  });

  it("always pays out a confirmed tip, even on the worst payout roll", () => {
    const drawn = drawEvent(sequence([0.1, 0.5, 0.99, 0.99, 0]), SEED);
    expect(drawn.credibility).toBe("confirmed");
    expect(drawn.pays).toBe(true);
  });

  it("lets a rumour fail", () => {
    const drawn = drawEvent(sequence([0.1, 0.5, 0.01, 0.99, 0]), SEED);
    expect(drawn.credibility).toBe("rumor");
    expect(drawn.pays).toBe(false);
  });

  it("lets a rumour come true", () => {
    const drawn = drawEvent(sequence([0.1, 0.5, 0.01, 0.01, 0]), SEED);
    expect(drawn.credibility).toBe("rumor");
    expect(drawn.pays).toBe(true);
  });

  it("keeps the delay inside its window", () => {
    expect(drawEvent(sequence([0.1, 0.5, 0.9, 0.9, 0]), SEED).delayMs).toBe(
      MIN_DELAY_MS,
    );
    expect(
      drawEvent(sequence([0.1, 0.5, 0.9, 0.9, 0.999]), SEED).delayMs,
    ).toBeLessThanOrEqual(MAX_DELAY_MS);
  });

  it("carries the seed it was given", () => {
    const drawn = drawEvent(sequence([0.1, 0.5, 0.9, 0.9, 0]), TOPIC_SEEDS[3]);
    expect(drawn.seed).toBe(TOPIC_SEEDS[3]);
  });

  it("takes the same number of draws whatever it rolls", () => {
    let confirmedDraws = 0;
    drawEvent(() => {
      confirmedDraws++;
      return 0.9;
    }, SEED);

    let rumorDraws = 0;
    drawEvent(() => {
      rumorDraws++;
      return 0.01;
    }, SEED);

    expect(rumorDraws).toBe(confirmedDraws);
  });
});

describe("impulseFor", () => {
  it("sends an upward event to the top mood step", () => {
    expect(impulseFor(event({ direction: "up" })).mood).toBe("moon");
  });

  it("sends a downward event to the bottom mood step", () => {
    expect(impulseFor(event({ direction: "down" })).mood).toBe("dump");
  });

  it("scales by strength", () => {
    expect(impulseFor(event({ strength: "small" })).scale).toBeCloseTo(
      STRENGTH_SCALE.small,
      10,
    );
    expect(impulseFor(event({ strength: "large" })).scale).toBeCloseTo(
      STRENGTH_SCALE.large,
      10,
    );
  });

  it("pays a rumour that comes true more than a confirmed tip", () => {
    const confirmed = impulseFor(event({ credibility: "confirmed" }));
    const rumor = impulseFor(event({ credibility: "rumor" }));
    expect(rumor.scale).toBeCloseTo(confirmed.scale * RUMOR_PAYOUT_BONUS, 10);
  });
});
