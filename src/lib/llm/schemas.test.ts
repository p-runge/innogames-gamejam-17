import { describe, expect, it } from "vitest";
import { z } from "zod";
import { personaSchema, replySchema } from "./schemas";

describe("replySchema", () => {
  it("puts mood before body so the model commits to it first", () => {
    // Constrained decoding follows the schema's field order. With body first the
    // model writes the reply and labels it as an afterthought, which measurably
    // produced "bullish" for plainly bearish copy — and the mood is what moves
    // the price. This test exists so a tidy-up does not silently reorder them.
    const json = z.toJSONSchema(replySchema) as { properties: object };
    expect(Object.keys(json.properties)).toEqual(["mood", "body"]);
  });

  it("holds a reply to what the feed can render", () => {
    // The ceiling is a safety net for the layout, not the way length is
    // controlled — the prompt asks for well under 240 characters. What matters
    // here is that a runaway generation cannot reach the feed, and that an
    // empty body is not a reply.
    const runaway = "x".repeat(1_000);
    expect(replySchema.safeParse({ mood: "dump", body: runaway }).success).toBe(
      false,
    );
    expect(replySchema.safeParse({ mood: "dump", body: "" }).success).toBe(false);
    expect(
      replySchema.safeParse({ mood: "dump", body: "x".repeat(240) }).success,
    ).toBe(true);
  });

  it("rejects a mood outside the five the market knows", () => {
    // An unknown label would reach MOOD_DRIFT as undefined and turn the impulse
    // into NaN, which poisons every later candle.
    expect(replySchema.safeParse({ mood: "angry", body: "sell" }).success).toBe(
      false,
    );
  });
});

describe("personaSchema", () => {
  const usable = {
    stance: "bull" as const,
    name: "A Name",
    handle: "a_handle",
    bio: "my portfolio is a crime scene",
    tic: "says 'champ'",
  };

  it("rejects a bio that is punctuation rather than a sentence", () => {
    // Observed in a real round: qwen3.5:4b returned ",,,,,,,,," as a bio. It
    // passes a length check and renders in the feed as a broken account.
    expect(personaSchema.safeParse({ ...usable, bio: ",,,,,,,,," }).success).toBe(
      false,
    );
    expect(personaSchema.safeParse({ ...usable, bio: "..." }).success).toBe(false);
    expect(personaSchema.safeParse({ ...usable, bio: "!!!" }).success).toBe(false);
  });

  it("rejects a tic that carries no words", () => {
    expect(personaSchema.safeParse({ ...usable, tic: "..." }).success).toBe(false);
  });

  it("accepts an ordinary persona", () => {
    expect(personaSchema.safeParse(usable).success).toBe(true);
  });

  it("accepts a bio that opens with punctuation but has words", () => {
    // Quoting itself is a normal way for these accounts to write.
    expect(
      personaSchema.safeParse({ ...usable, bio: '"they took the lot" — me' })
        .success,
    ).toBe(true);
  });

  it("rejects handles the feed cannot render as an account", () => {
    const base = {
      name: "A Name",
      bio: "my portfolio is a crime scene",
      stance: "bull" as const,
      tic: "says 'champ'",
    };
    expect(personaSchema.safeParse({ ...base, handle: "ok_handle" }).success).toBe(true);
    expect(personaSchema.safeParse({ ...base, handle: "Has Capitals" }).success).toBe(false);
    expect(personaSchema.safeParse({ ...base, handle: "ab" }).success).toBe(false);
    expect(personaSchema.safeParse({ ...base, handle: "a".repeat(16) }).success).toBe(false);
  });
});
