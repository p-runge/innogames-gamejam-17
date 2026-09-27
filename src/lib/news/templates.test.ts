import { describe, expect, it } from "vitest";

import { INFORMANTS, pickInformant } from "./informant";
import { drawTip } from "./templates";
import {
  TOPIC_SEEDS,
  type NewsCredibility,
  type NewsDirection,
  type NewsEvent,
} from "./types";

const DIRECTIONS: NewsDirection[] = ["up", "down"];
const CREDIBILITIES: NewsCredibility[] = ["confirmed", "rumor"];

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

/** Every line the pool can produce, walked deterministically. */
function everyFact() {
  const drawn: { factId: string; body: string; seed: string }[] = [];

  for (const seed of TOPIC_SEEDS) {
    for (const direction of DIRECTIONS) {
      for (const credibility of CREDIBILITIES) {
        const used: string[] = [];
        // Excluding what has already come out walks the whole pool rather than
        // sampling it, so every authored line is checked and not just the first.
        for (let index = 0; index < 40; index++) {
          const tip = drawTip(event({ seed, direction, credibility }), used);
          if (used.includes(tip.factId)) break;
          used.push(tip.factId);
          drawn.push({ ...tip, seed });
        }
      }
    }
  }

  return drawn;
}

describe("drawTip", () => {
  it("covers every seed, direction and credibility", () => {
    for (const seed of TOPIC_SEEDS) {
      for (const direction of DIRECTIONS) {
        for (const credibility of CREDIBILITIES) {
          const { body } = drawTip(event({ seed, direction, credibility }));
          expect(body.trim().length).toBeGreaterThan(0);
          expect(body.length).toBeLessThanOrEqual(280);
        }
      }
    }
  });

  it("says something different for each seed", () => {
    const bodies = TOPIC_SEEDS.map(
      (seed) => drawTip(event({ seed }), [], () => 0).body,
    );
    expect(new Set(bodies).size).toBe(TOPIC_SEEDS.length);
  });

  it("says something different up and down", () => {
    expect(drawTip(event({ direction: "up" }), [], () => 0).body).not.toBe(
      drawTip(event({ direction: "down" }), [], () => 0).body,
    );
  });

  it("frames the same fact differently once it is only a rumour", () => {
    const confirmed = drawTip(event({ credibility: "confirmed" }), [], () => 0);
    const rumour = drawTip(event({ credibility: "rumor" }), [], () => 0);

    expect(confirmed.factId).toBe(rumour.factId);
    expect(confirmed.body).not.toBe(rumour.body);
  });

  it("holds enough lines that a round never repeats itself", () => {
    // A round sends about eight tips and walks the seeds in turn, so one seed
    // and direction is asked for at most twice. Six gives that room and then
    // some, and the count is asserted so shrinking the pool has to be deliberate.
    for (const seed of TOPIC_SEEDS) {
      for (const direction of DIRECTIONS) {
        const used: string[] = [];
        for (let index = 0; index < 6; index++) {
          const { factId } = drawTip(event({ seed, direction }), used);
          expect(used).not.toContain(factId);
          used.push(factId);
        }
      }
    }
  });

  it("does not repeat a fact the round has already used", () => {
    const first = drawTip(event(), [], () => 0);
    const second = drawTip(event(), [first.factId], () => 0);

    expect(second.factId).not.toBe(first.factId);
  });

  it("comes back round rather than going silent", () => {
    // A caller that has excluded everything must still get a line: a silent
    // informant reads as a broken one, and a repeat is the cheaper failure.
    const everything = Array.from({ length: 200 }, (_, i) => `plant-up-${i}`);
    expect(() =>
      drawTip(event({ seed: "plant", direction: "up" }), everything),
    ).not.toThrow();
  });

  it("stays inside the pool at the top of the random range", () => {
    // `Math.random` returns [0, 1), but a stub is free to hand back 1, and an
    // off-by-one here would read a line that is not there.
    expect(() => drawTip(event(), [], () => 1)).not.toThrow();
  });

  it("never names the market consequence, in any line", () => {
    // The one rule the whole feature rests on. A line that said "this will go
    // up" would be the single place in the game that hands the answer over.
    const banned = /\b(rise|rises|rising|fall|falls|falling|buy|sell|price)\b/i;

    for (const { body } of everyFact()) {
      expect(body).not.toMatch(banned);
    }
  });

  it("keeps every line in the informant's own register", () => {
    // Lowercase, clipped, no closing full stop on the fact itself, and never a
    // figure: this is somebody typing in a hurry who does not want to be quoted.
    // The framing adds its own punctuation, so only the fact is checked.
    const facts = new Map<string, string>();
    for (const { factId, body } of everyFact()) {
      // The confirmed framing appends to the fact, so the fact is what comes
      // before its first full stop.
      if (!facts.has(factId)) facts.set(factId, body.split(". ")[0]);
    }

    expect(facts.size).toBeGreaterThanOrEqual(TOPIC_SEEDS.length * 2 * 6);

    for (const fact of facts.values()) {
      expect(fact).not.toMatch(/\d/);
      expect(fact.slice(0, 1)).toBe(fact.slice(0, 1).toLowerCase());
    }
  });
});

describe("pickInformant", () => {
  it("returns the first informant on a zero roll", () => {
    expect(pickInformant(() => 0)).toBe(INFORMANTS[0]);
  });

  it("stays inside the list on a roll just short of one", () => {
    expect(INFORMANTS).toContain(pickInformant(() => 0.999));
  });

  it("gives every informant a handle the payload accepts", () => {
    for (const informant of INFORMANTS) {
      expect(informant.handle).toMatch(/^[a-z0-9_]{3,15}$/);
      expect(informant.name.length).toBeLessThanOrEqual(40);
    }
  });
});
