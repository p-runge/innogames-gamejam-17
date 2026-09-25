import { describe, expect, it } from "vitest";
import { gameEventSchema, tweetPayloadSchema } from "./types";

describe("tweetPayloadSchema", () => {
  it("accepts a well-formed tweet", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "gamejam",
      message: "hello world",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty message", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "gamejam",
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a message longer than 280 characters", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "gamejam",
      message: "x".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty username", () => {
    const result = tweetPayloadSchema.safeParse({
      username: "",
      message: "hello",
    });
    expect(result.success).toBe(false);
  });
});

describe("gameEventSchema", () => {
  it("accepts a tweet event", () => {
    const result = gameEventSchema.safeParse({
      type: "tweet",
      payload: { username: "gamejam", message: "hello" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = gameEventSchema.safeParse({
      type: "explosion",
      payload: { username: "gamejam", message: "hello" },
    });
    expect(result.success).toBe(false);
  });
});
