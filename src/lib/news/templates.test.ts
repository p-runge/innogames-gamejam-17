import { describe, expect, it } from "vitest";

import { INFORMANTS, pickInformant } from "./informant";
import { templatedTip } from "./templates";
import {
  TOPIC_SEEDS,
  type NewsCredibility,
  type NewsDirection,
  type NewsEvent,
} from "./types";

const DIRECTIONS: NewsDirection[] = ["up", "down"];
const CREDIBILITIES: NewsCredibility[] = ["confirmed", "rumor"];

function event(overrides: Partial<NewsEvent>): NewsEvent {
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

describe("templatedTip", () => {
  it("covers every seed, direction and credibility", () => {
    for (const seed of TOPIC_SEEDS) {
      for (const direction of DIRECTIONS) {
        for (const credibility of CREDIBILITIES) {
          const body = templatedTip(event({ seed, direction, credibility }));
          expect(body.trim().length).toBeGreaterThan(0);
          expect(body.length).toBeLessThanOrEqual(280);
        }
      }
    }
  });

  it("says something different for each seed", () => {
    const bodies = TOPIC_SEEDS.map((seed) => templatedTip(event({ seed })));
    expect(new Set(bodies).size).toBe(TOPIC_SEEDS.length);
  });

  it("says something different up and down", () => {
    expect(templatedTip(event({ direction: "up" }))).not.toBe(
      templatedTip(event({ direction: "down" })),
    );
  });

  it("frames a rumour differently from a confirmed tip", () => {
    expect(templatedTip(event({ credibility: "confirmed" }))).not.toBe(
      templatedTip(event({ credibility: "rumor" })),
    );
  });

  it("never names the market consequence", () => {
    // The one rule the whole feature rests on. A template that said "this will
    // go up" would be the single place in the game that hands the answer over,
    // and unlike the model's output nobody would ever re-read it.
    const banned = /\b(rise|rises|rising|fall|falls|falling|buy|sell|price)\b/i;
    for (const seed of TOPIC_SEEDS) {
      for (const direction of DIRECTIONS) {
        for (const credibility of CREDIBILITIES) {
          expect(
            templatedTip(event({ seed, direction, credibility })),
          ).not.toMatch(banned);
        }
      }
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
