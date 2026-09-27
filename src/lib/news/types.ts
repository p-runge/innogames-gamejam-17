import { z } from "zod";

/**
 * A market event the informant leaks before it happens.
 *
 * Everything the player can profit from is decided here, at random, before a
 * word of the message exists. That order is the whole feature: the model
 * dresses a decided outcome and never chooses one, the same division
 * `personaStance` draws for the crowd.
 */

/** Which way the coming move goes. */
export type NewsDirection = "up" | "down";

/** How big the coming move is. Three steps, because the copy has to carry it. */
export type NewsStrength = "small" | "medium" | "large";

/**
 * How sure the informant is, and therefore whether the move is certain.
 * Readable from the message alone — that is what makes it a decision.
 */
export type NewsCredibility = "confirmed" | "rumor";

/**
 * What a tip is about. Rotated rather than drawn, so eight tips in a round are
 * not all about the same factory — the same reason the crowd's archetypes are
 * seeded per persona instead of sampled.
 */
export const TOPIC_SEEDS = [
  "supply-chain",
  "regulator",
  "key-customer",
  "board",
  "plant",
  "analyst",
  "takeover",
] as const;

export type TopicSeed = (typeof TOPIC_SEEDS)[number];

export type NewsEvent = {
  direction: NewsDirection;
  strength: NewsStrength;
  credibility: NewsCredibility;
  seed: TopicSeed;
  /**
   * Whether the move actually arrives. False only for a rumour that turns out
   * to be wrong, and a false one is published exactly like a true one: a tip
   * whose text betrayed the outcome would be no risk at all.
   */
  pays: boolean;
  /** Wall-clock milliseconds between the tip reaching the feed and the impulse. */
  delayMs: number;
};

/**
 * A message from the informant, as the phone receives it.
 *
 * `id` rather than position, because the phone tracks what it has already
 * announced: two messages sharing an id would collapse into one on the desk.
 *
 * A schema rather than a bare type, and it stays one now that nothing puts it on
 * a wire. The fabrications in `~/lib/feed/fabrications.ts` are built to this
 * shape deliberately, so the phone cannot tell an invented message from a real
 * one — and a shape that is only a type is a shape nothing checks.
 */
export const tipPayloadSchema = z.object({
  id: z.string().min(1),
  sender: z.string().min(1).max(40),
  /** Without the leading @; the phone adds it. */
  handle: z.string().min(1).max(15),
  body: z.string().min(1).max(280),
  /** The in-game clock, in minutes since midnight, as the posts carry it. */
  at: z.number(),
});

export type TipPayload = z.infer<typeof tipPayloadSchema>;
