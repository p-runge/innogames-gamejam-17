import { describe, expect, it } from "vitest";

import { tweetPayloadSchema } from "~/lib/events/types";
import { MAX_TWEET_LENGTH, toTweetPayload } from "./tweet";

describe("toTweetPayload", () => {
  it("trims the body", () => {
    expect(toTweetPayload("You", "  inno is done  ")).toEqual({
      username: "You",
      message: "inno is done",
    });
  });

  it("returns null when the body holds no characters", () => {
    expect(toTweetPayload("You", "   \n  ")).toBeNull();
  });

  it("truncates a body the server would reject", () => {
    const payload = toTweetPayload("You", "a".repeat(MAX_TWEET_LENGTH + 40));

    expect(payload?.message).toHaveLength(MAX_TWEET_LENGTH);
  });

  it("produces a payload the server's own schema accepts", () => {
    const payload = toTweetPayload("You", "x".repeat(MAX_TWEET_LENGTH + 1));

    expect(tweetPayloadSchema.safeParse(payload).success).toBe(true);
  });
});
