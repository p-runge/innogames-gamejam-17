import { describe, expect, it } from "vitest";
import {
  gameEventSchema,
  sendTweetInputSchema,
  tweetPayloadSchema,
} from "./types";

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

describe("sendTweetInputSchema", () => {
  const post = { username: "You", suggestionId: "moon-3" };

  it("defaults to no mania at all", () => {
    expect(sendTweetInputSchema.parse(post).mania).toBe(1);
  });

  it("takes a scale a band can actually produce", () => {
    expect(sendTweetInputSchema.parse({ ...post, mania: 1.25 }).mania).toBe(1.25);
  });

  it("clamps rather than rejects, so a client rounding artifact costs no post", () => {
    expect(sendTweetInputSchema.parse({ ...post, mania: 1.6000001 }).mania).toBe(
      1.6,
    );
    expect(sendTweetInputSchema.parse({ ...post, mania: 0.2 }).mania).toBe(1);
    expect(sendTweetInputSchema.parse({ ...post, mania: 40 }).mania).toBe(1.6);
  });

  it("still needs a real post under it", () => {
    expect(
      sendTweetInputSchema.safeParse({ username: "You", mania: 1.6 }).success,
    ).toBe(false);
  });

  it("keeps mania out of what goes back on the bus", () => {
    // The broadcast payload is the narrower schema, and zod strips what it does
    // not know: a second player watching the feed learns nothing about the
    // poster's head.
    expect(tweetPayloadSchema.parse({ ...post, mania: 1.6 })).not.toHaveProperty(
      "mania",
    );
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
