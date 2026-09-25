import { z } from "zod";

export const tweetPayloadSchema = z.object({
  username: z.string().min(1).max(30),
  message: z.string().min(1).max(280),
});

/**
 * Every event the server can push to connected clients. Adding a kind means
 * one variant here and one `case` on the client; the transport is untouched.
 */
export const gameEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tweet"), payload: tweetPayloadSchema }),
]);

export type TweetPayload = z.infer<typeof tweetPayloadSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
