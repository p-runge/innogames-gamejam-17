import { describe, expect, it } from "vitest";
import { replySchema } from "~/lib/llm/schemas";
import { FALLBACK_PERSONAS } from "./fallback";
import { OPENING_POST, templatedReply } from "./templates";

describe("OPENING_POST", () => {
  it("is authored by someone in the curated cast", () => {
    // The feed renders posts[0] as the thread's subject. Without a seeded one
    // the player's first sentence becomes the thread's root, restyled and
    // attributed to them, for the rest of the round.
    const handles = FALLBACK_PERSONAS.map((p) => p.handle);
    expect(handles).toContain(OPENING_POST.handle.replace("@", ""));
  });

  it("is stamped at the session open", () => {
    expect(OPENING_POST.at).toBe(9 * 60);
  });
});

describe("templatedReply", () => {
  const persona = FALLBACK_PERSONAS[0];

  it("produces a reply that passes the same schema the model's output does", () => {
    // Templates reach the feed and the market through exactly the same path as
    // generated replies, so they have to satisfy the same contract.
    for (let i = 0; i < 20; i++) {
      const reply = templatedReply(persona, "down");
      expect(replySchema.safeParse(reply).success).toBe(true);
    }
  });

  it("leans bearish when the price is falling", () => {
    const moods = new Set(
      Array.from({ length: 30 }, () => templatedReply(persona, "down").mood),
    );
    expect(moods.has("bullish")).toBe(false);
    expect(moods.has("moon")).toBe(false);
  });

  it("leans bullish when the price is rising", () => {
    const moods = new Set(
      Array.from({ length: 30 }, () => templatedReply(persona, "up").mood),
    );
    expect(moods.has("dump")).toBe(false);
    expect(moods.has("bearish")).toBe(false);
  });

  it("does not always say the same thing", () => {
    // A fallback that repeats one line is barely better than an empty feed.
    const bodies = new Set(
      Array.from({ length: 40 }, () => templatedReply(persona, "flat").body),
    );
    expect(bodies.size).toBeGreaterThan(3);
  });
});
