import { describe, expect, it } from "vitest";

import { createPlayGate } from "./gate";

describe("createPlayGate", () => {
  it("lets the first request through", () => {
    const gate = createPlayGate();

    expect(gate.allows("coins", 1_000, 0)).toBe(true);
  });

  it("holds a sound back until its own cooldown has passed", () => {
    const gate = createPlayGate({ minGapMs: 0 });
    gate.allows("coins", 1_000, 0);

    expect(gate.allows("coins", 1_000, 999)).toBe(false);
    expect(gate.allows("coins", 1_000, 1_000)).toBe(true);
  });

  it("counts cooldowns per sound", () => {
    const gate = createPlayGate({ minGapMs: 0 });

    expect(gate.allows("coins", 1_000, 0)).toBe(true);
    expect(gate.allows("victory", 1_000, 0)).toBe(true);
  });

  it("keeps two different sounds from speaking over each other", () => {
    const gate = createPlayGate({ minGapMs: 250 });
    gate.allows("coins", 0, 0);

    expect(gate.allows("victory", 0, 249)).toBe(false);
    expect(gate.allows("victory", 0, 250)).toBe(true);
  });

  it("does not spend a cooldown on a request it refused", () => {
    // A trigger can arrive four times a second. If a refusal restarted the
    // clock, the sound would never get its next turn.
    const gate = createPlayGate({ minGapMs: 0 });
    gate.allows("coins", 1_000, 0);
    gate.allows("coins", 1_000, 500);

    expect(gate.allows("coins", 1_000, 1_000)).toBe(true);
  });
});
