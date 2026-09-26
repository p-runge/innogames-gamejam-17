import "server-only";

import { publish } from "~/lib/events/bus";
import type { ReplyPayload } from "~/lib/events/types";
import type { Persona, Reply } from "~/lib/llm/schemas";
import { applyImpulse, getMarketState } from "~/lib/market/engine";
import type { ImpulseSource } from "~/lib/market/types";

export type PendingReply = Reply & {
  persona: Persona;
  /** Whether this answers the player directly or is background chatter. */
  source: ImpulseSource;
};

/**
 * Replies waiting to be published. Bounded because a player posts faster than a
 * CPU-bound model generates: without a ceiling the server spends minutes
 * answering tweets nobody is looking at any more.
 */
export const MAX_PENDING = 12;

/**
 * Published bodies kept for the prompts. This is the cheapest lever against ten
 * accounts that sound like one: a generation is told what has just been said so
 * it can say something else.
 */
const RECENT_MEMORY = 6;

type QueueState = {
  pending: PendingReply[];
  published: string[];
  /** What the feed has shown, for a client that joins or reloads mid-round. */
  history: ReplyPayload[];
};

const globalForQueue = globalThis as typeof globalThis & {
  gameReplyQueue?: QueueState;
};

function getQueue(): QueueState {
  globalForQueue.gameReplyQueue ??= { pending: [], published: [], history: [] };
  return globalForQueue.gameReplyQueue;
}

export function pendingCount(): number {
  return getQueue().pending.length;
}

/** The most recently published bodies, newest first. */
export function recentBodies(): string[] {
  return [...getQueue().published].reverse();
}

/**
 * Every reply the feed has shown this round, oldest first.
 *
 * Price events are not replayed from the bus and replies are only buffered for
 * 100 events, so without this a player who reloads mid-round gets their candles
 * back to the cent and an empty thread.
 */
export function replyHistory(): ReplyPayload[] {
  return getQueue().history;
}

/**
 * Park a generated reply. Deliberately does not touch the market: a reply that
 * has not reached the feed must not move the price, or the buffer would let the
 * chart react to posts nobody has read yet.
 */
export function enqueueReply(reply: PendingReply): void {
  const { pending } = getQueue();
  pending.push(reply);
  // The oldest goes first: a stale reaction to a price that has since moved is
  // the least worth showing.
  while (pending.length > MAX_PENDING) pending.shift();
}

/**
 * Publish one reply and let it move the price, in that order and in one call.
 * This pairing is the whole point of the buffer: generation has no market
 * effect, publication does.
 */
export function publishNextReply(): PendingReply | null {
  const queue = getQueue();
  const reply = queue.pending.shift();
  if (reply === undefined) return null;

  queue.published.push(reply.body);
  while (queue.published.length > RECENT_MEMORY) queue.published.shift();

  const { candles } = getMarketState();
  const at = candles[candles.length - 1]?.t ?? 0;

  const payload = {
    author: reply.persona.name,
    handle: reply.persona.handle,
    body: reply.body,
    at,
  };

  queue.history.push(payload);
  publish({ type: "reply", payload });

  applyImpulse(reply.mood, reply.source);

  return reply;
}

/** Test-only: drop every pending reply and forget what was published. */
export function resetQueue(): void {
  globalForQueue.gameReplyQueue = undefined;
}
