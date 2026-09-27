import { describe, expect, it } from "vitest";
import { gameEventSchema, tweetPayloadSchema } from "./types";

describe("tweetPayloadSchema", () => {
  it("accepts a well-formed tweet", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "gamejam",
      suggestionId: "moon-3",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty suggestion id", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "gamejam",
      suggestionId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a suggestion id longer than 40 characters", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "gamejam",
      suggestionId: "x".repeat(41),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a tweet with no suggestion id at all", () => {
    // The body is not on the wire, so this field is the whole post: without it
    // the server has nothing to resolve a mood from.
    const result = tweetPayloadSchema.safeParse({ username: "gamejam" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty username", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "",
      suggestionId: "moon-3",
    });
    expect(result.success).toBe(false);
  });
});

describe("gameEventSchema", () => {
  it("accepts a tweet event", () => {
    const result = gameEventSchema.safeParse({
      type: "tweet",
      payload: { username: "gamejam", suggestionId: "moon-3" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = gameEventSchema.safeParse({
      type: "explosion",
      payload: { username: "gamejam", suggestionId: "moon-3" },
    });
    expect(result.success).toBe(false);
  });
});
