import { z } from "zod";

/**
 * One candle of the session. The schema rather than a bare type, because the
 * event bus ships candles to clients and needs to validate them; keeping both in
 * one place is what stops the wire shape and the internal shape from drifting.
 */
export const candleSchema = z.object({
  /** The candle's slot on the in-game clock, in minutes since midnight. */
  t: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
});

export type Candle = z.infer<typeof candleSchema>;

/**
 * How a post reads to the market. Five steps rather than a number from -1 to 1:
 * small models return 0.8 and 0.75 for the same feeling, but they pick one of
 * five labels reliably.
 *
 * A schema and not a bare union because the client asks the server to draft lines
 * for named moods, so these cross the wire and have to be validated there.
 */
export const moodSchema = z.enum([
  "dump",
  "bearish",
  "neutral",
  "bullish",
  "moon",
]);

export type Mood = z.infer<typeof moodSchema>;

