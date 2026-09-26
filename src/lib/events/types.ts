import { z } from "zod";

import { candleSchema } from "~/lib/market/types";

export const tweetPayloadSchema = z.object({
  username: z.string().min(1).max(30),
  message: z.string().min(1).max(280),
});

export const pricePayloadSchema = z.object({
  /**
   * Only the candle that changed, not the series. At four ticks per second the
   * full array would flood the bus buffer within half a minute; the client
   * merges by `t` and gets its starting series from `session.state`.
   */
  candle: candleSchema,
});

export const replyPayloadSchema = z.object({
  author: z.string().min(1).max(30),
  /** Without the leading @; the feed adds it. */
  handle: z.string().min(1).max(15),
  body: z.string().min(1).max(280),
  /** The in-game clock, in minutes since midnight, as the posts carry it. */
  at: z.number(),
});

/**
 * Every event the server can push to connected clients. Adding a kind means
 * one variant here and one `case` on the client; the transport is untouched.
 */
export const gameEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tweet"), payload: tweetPayloadSchema }),
  z.object({ type: z.literal("price"), payload: pricePayloadSchema }),
  z.object({ type: z.literal("reply"), payload: replyPayloadSchema }),
]);

export type TweetPayload = z.infer<typeof tweetPayloadSchema>;
export type PricePayload = z.infer<typeof pricePayloadSchema>;
export type ReplyPayload = z.infer<typeof replyPayloadSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
