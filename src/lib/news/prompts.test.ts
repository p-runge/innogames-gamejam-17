import { describe, expect, it } from "vitest";

import { INFORMANTS } from "./informant";
import { TIP_SYSTEM, tipPrompt } from "./prompts";
import { TOPIC_SEEDS, type NewsEvent } from "./types";

const INFORMANT = INFORMANTS[0];

function event(overrides: Partial<NewsEvent> = {}): NewsEvent {
  return {
    direction: "up",
    strength: "medium",
    credibility: "confirmed",
    seed: TOPIC_SEEDS[0],
    pays: true,
    delayMs: 8_000,
    ...overrides,
  };
}

describe("TIP_SYSTEM", () => {
  it("forbids naming the market consequence", () => {
    expect(TIP_SYSTEM).toMatch(/never/i);
    expect(TIP_SYSTEM.toLowerCase()).toContain("consequence");
  });

  it("asks for a direct message, not a public post", () => {
    expect(TIP_SYSTEM.toLowerCase()).toContain("private");
  });
});

describe("tipPrompt", () => {
  it("carries the informant's voice", () => {
    expect(tipPrompt(INFORMANT, event())).toContain(INFORMANT.voice);
  });

  it("names the subject the seed stands for", () => {
    const supply = tipPrompt(INFORMANT, event({ seed: "supply-chain" }));
    const board = tipPrompt(INFORMANT, event({ seed: "board" }));
    expect(supply).not.toBe(board);
    expect(supply.toLowerCase()).toContain("supplier");
  });

  it("states the slant without naming a direction", () => {
    // The direction words are exactly what the message must not contain, and a
    // small model given one in its instructions puts it in the output.
    const up = tipPrompt(INFORMANT, event({ direction: "up" }));
    const down = tipPrompt(INFORMANT, event({ direction: "down" }));
    expect(up).toContain("good news");
    expect(down).toContain("bad news");
    expect(up.toLowerCase()).not.toMatch(/\b(rise|rising|up)\b/);
    expect(down.toLowerCase()).not.toMatch(/\b(fall|falling|down)\b/);
  });

  it("distinguishes the three strengths", () => {
    const bodies = (["small", "medium", "large"] as const).map((strength) =>
      tipPrompt(INFORMANT, event({ strength })),
    );
    expect(new Set(bodies).size).toBe(3);
  });

  it("distinguishes a rumour from a confirmed tip", () => {
    expect(tipPrompt(INFORMANT, event({ credibility: "confirmed" }))).not.toBe(
      tipPrompt(INFORMANT, event({ credibility: "rumor" })),
    );
  });

  it("never hands the model a percentage", () => {
    for (const seed of TOPIC_SEEDS) {
      expect(tipPrompt(INFORMANT, event({ seed }))).not.toMatch(/\d+\s*%/);
    }
  });
});
