import { z } from "zod";

import { candleSchema } from "~/lib/market/types";

/**
 * A post as it travels: who posted, and which suggestion they picked.
 *
 * The body is not on the wire. Every post comes from the pool in
 * `src/lib/feed/suggestions.ts`, so both sides resolve the text and the mood from
 * the id — which is what stops a client from posting a line of its own with a
 * mood it chose for itself.
 */
export const tweetPayloadSchema = z.object({
  username: z.string().min(1).max(30),
  suggestionId: z.string().min(1).max(40),
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
