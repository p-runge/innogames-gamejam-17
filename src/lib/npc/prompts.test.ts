import { describe, expect, it } from "vitest";

import { replySchema, type PersonaStance } from "~/lib/llm/schemas";
import { moodsFor, personaStance } from "./prompts";

const STANCES: PersonaStance[] = ["bull", "bear", "chaos"];

const SELLING = ["dump", "bearish"];
const BUYING = ["bullish", "moon"];

describe("moodsFor", () => {
  it("lets a bull only buy", () => {
    expect(moodsFor("bull")).toEqual(expect.arrayContaining(BUYING));
    expect(moodsFor("bull")).not.toEqual(expect.arrayContaining(SELLING));
  });

  it("lets a bear only sell", () => {
    expect(moodsFor("bear")).toEqual(expect.arrayContaining(SELLING));
    expect(moodsFor("bear")).not.toEqual(expect.arrayContaining(BUYING));
  });

  it("leaves chaos both directions", () => {
    expect(moodsFor("chaos")).toEqual(
      expect.arrayContaining([...SELLING, ...BUYING]),
    );
  });

  it("names only moods the reply schema accepts", () => {
    const allowed = replySchema.shape.mood.options;

    for (const stance of STANCES) {
      for (const mood of moodsFor(stance)) {
        expect(allowed).toContain(mood);
      }
    }
  });

  it("covers every stance the cast can hold", () => {
    for (let index = 0; index < 10; index++) {
      expect(moodsFor(personaStance(index)).length).toBeGreaterThan(0);
    }
  });
});
