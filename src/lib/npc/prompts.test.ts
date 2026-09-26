import { describe, expect, it } from "vitest";

import { replySchema, type PersonaStance } from "~/lib/llm/schemas";
import { MOOD_DRIFT } from "~/lib/market/series";
import { FALLBACK_PERSONAS } from "./fallback";
import {
  ambientPrompt,
  moodForReaction,
  moodIntensity,
  moodsFor,
  personaStance,
  reactionPrompt,
} from "./prompts";

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

describe("moodIntensity", () => {
  /*
    The pair is what the player's post picks between, so "stronger" has to mean
    stronger to the market — not merely to whoever wrote the prompt. Asserted
    against MOOD_DRIFT for that reason: swapping the pair, or retuning the
    weights past each other, fails here rather than quietly inverting the one
    lever the player has.
  */
  it("gives a bull a stronger mood that buys harder", () => {
    const pair = moodIntensity("bull");

    expect(pair).not.toBeNull();
    expect(MOOD_DRIFT[pair!.strong]).toBeGreaterThan(MOOD_DRIFT[pair!.mild]);
    expect(MOOD_DRIFT[pair!.mild]).toBeGreaterThan(0);
  });

  it("gives a bear a stronger mood that sells harder", () => {
    const pair = moodIntensity("bear");

    expect(pair).not.toBeNull();
    expect(MOOD_DRIFT[pair!.strong]).toBeLessThan(MOOD_DRIFT[pair!.mild]);
    expect(MOOD_DRIFT[pair!.mild]).toBeLessThan(0);
  });

  it("leaves chaos without a pair, so it stays unreadable", () => {
    expect(moodIntensity("chaos")).toBeNull();
  });

  it("picks both moods from the ones the stance may carry", () => {
    for (const stance of STANCES) {
      const pair = moodIntensity(stance);
      if (pair === null) continue;

      expect(moodsFor(stance)).toContain(pair.mild);
      expect(moodsFor(stance)).toContain(pair.strong);
    }
  });
});

describe("ambientPrompt", () => {
  it("stays free of the player, so chatter is not steered by one tweet", () => {
    const [bull] = FALLBACK_PERSONAS.filter((p) => p.stance === "bull");
    const prompt = ambientPrompt(
      bull,
      "INNO has barely moved for several minutes.",
      [],
    );

    expect(prompt).not.toContain("Their post argues");
    // The account keeps its own range instead.
    for (const mood of moodsFor("bull")) expect(prompt).toContain(mood);
  });
});

describe("moodForReaction", () => {
  /*
    The comparison the model cannot make, made here instead. Asserted against
    MOOD_DRIFT so "the player got through" means the price actually moved their
    way, not merely that a different label came back.
  */
  it("sends a bull harder up when the player argues up", () => {
    const withPlayer = moodForReaction("bull", "up")!;
    const against = moodForReaction("bull", "down")!;

    expect(MOOD_DRIFT[withPlayer]).toBeGreaterThan(MOOD_DRIFT[against]);
    expect(MOOD_DRIFT[against]).toBeGreaterThan(0);
  });

  it("sends a bear harder down when the player argues down", () => {
    const withPlayer = moodForReaction("bear", "down")!;
    const against = moodForReaction("bear", "up")!;

    expect(MOOD_DRIFT[withPlayer]).toBeLessThan(MOOD_DRIFT[against]);
    expect(MOOD_DRIFT[against]).toBeLessThan(0);
  });

  it("never flips a persona's side, whichever way the player argues", () => {
    for (const lean of ["up", "down"] as const) {
      expect(MOOD_DRIFT[moodForReaction("bull", lean)!]).toBeGreaterThan(0);
      expect(MOOD_DRIFT[moodForReaction("bear", lean)!]).toBeLessThan(0);
    }
  });

  it("leaves chaos to the model", () => {
    expect(moodForReaction("chaos", "up")).toBeNull();
    expect(moodForReaction("chaos", "down")).toBeNull();
  });
});

describe("reactionPrompt with a known player lean", () => {
  const [bull] = FALLBACK_PERSONAS.filter((p) => p.stance === "bull");
  const CONTEXT = "INNO has barely moved for several minutes.";
  const TWEET = { username: "You", message: "earnings are fantastic" };

  it("names one mood and nothing to choose between", () => {
    const resolved = moodForReaction("bull", "up")!;
    const prompt = reactionPrompt(bull, CONTEXT, TWEET, [], "up");

    expect(prompt).toContain(resolved);
    /*
      A competing range is the whole failure: given both "must be one of:
      bullish, moon" and "your mood is 'moon'", qwen3.5:4b returned the first
      item of the list every time and the stated mood never landed. One
      instruction about the mood, or none of it works.
    */
    for (const other of moodsFor("bull")) {
      if (other !== resolved) expect(prompt).not.toContain(other);
    }
  });

  it("falls back to the account's own range when the lean is unknown", () => {
    const prompt = reactionPrompt(bull, CONTEXT, TWEET, []);

    for (const mood of moodsFor("bull")) expect(prompt).toContain(mood);
  });
});
