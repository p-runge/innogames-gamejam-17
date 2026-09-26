import "server-only";

import { startSession, stopSession } from "~/lib/market/engine";
import { generateCast, resetCast } from "~/lib/npc/cast";
import { startCrowd, stopCrowd } from "~/lib/npc/crowd";
import { resetQueue } from "~/lib/npc/queue";

/**
 * The round's lifecycle in one place.
 *
 * Four pieces of state live on `globalThis` and survive a module reload: the
 * market, the cast, the reply queue and the crowd's timers. Starting them is
 * spread across three modules, and nothing owned stopping them — so the crowd
 * kept generating after the bell and the next round opened with the last one's
 * accounts and its leftover replies. This module is the one thing that knows a
 * round begins and ends.
 */

/**
 * Start the round: the price ticker, the cast, and the crowd that posts into it.
 *
 * Every layer underneath is idempotent, so the second browser to call this joins
 * the running round rather than building a second one.
 */
export async function startRound(): Promise<void> {
  startSession(endRound);
  // Awaited before the crowd starts: the first ambient tick would otherwise
  // have nobody to speak.
  await generateCast();
  startCrowd();
}

/**
 * End the round and leave nothing of it behind.
 *
 * Called when the session clock passes the close, and safe to call when no round
 * is running. Everything here is a fresh-per-round thing: the cast, what is
 * waiting to be posted, and what was already said — the last of which feeds the
 * "do not repeat this" half of the prompts and would otherwise argue against a
 * thread the new round's players never saw.
 */
export function endRound(): void {
  stopCrowd();
  stopSession();
  resetQueue();
  resetCast();
}
