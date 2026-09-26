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

/**
 * Every event the server can push to connected clients. Adding a kind means
 * one variant here and one `case` on the client; the transport is untouched.
 */
export const gameEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tweet"), payload: tweetPayloadSchema }),
  z.object({ type: z.literal("price"), payload: pricePayloadSchema }),
]);

export type TweetPayload = z.infer<typeof tweetPayloadSchema>;
export type PricePayload = z.infer<typeof pricePayloadSchema>;
export type GameEvent = z.infer<typeof gameEventSchema>;
