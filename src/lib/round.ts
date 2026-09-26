import "server-only";

import { startSession, stopSession } from "~/lib/market/engine";

/**
 * The round's lifecycle in one place.
 *
 * The market's state lives on `globalThis` and survives a module reload, and
 * nothing owned stopping it — so the next round opened on the last one's series.
 * This module is the one thing that knows a round begins and ends.
 */

/**
 * Start the round: the price ticker.
 *
 * Every layer underneath is idempotent, so the second browser to call this joins
 * the running round rather than building a second one.
 */
export function startRound(): void {
  startSession(endRound);
}

/**
 * End the round and leave nothing of it behind.
 *
 * Called when the session clock passes the close, and safe to call when no round
 * is running.
 */
export function endRound(): void {
  stopSession();
}
