import "server-only";

import { startSession, stopSession } from "~/lib/market/engine";
import { resetDesk, startDesk, stopDesk } from "~/lib/news/desk";

/**
 * The round's lifecycle in one place.
 *
 * The market's state lives on `globalThis` and survives a module reload, and
 * nothing owned stopping it — so the next round opened on the last one's series.
 * This module is the one thing that knows a round begins and ends.
 */

/**
 * Start the round: the price ticker and the informant who leaks into it.
 *
 * Every layer underneath is idempotent, so the second browser to call this joins
 * the running round rather than building a second one.
 */
export function startRound(): void {
  startSession(endRound);
  startDesk();
}

/**
 * End the round and leave nothing of it behind.
 *
 * Called when the session clock passes the close, and safe to call when no round
 * is running.
 *
 * The informant's schedule and its promised impulses go too: a tip is a thing
 * this round leaked, and its payout must not reach the next one.
 */
export function endRound(): void {
  // First, so a payout armed a second before the bell cannot land on a market
  // that is about to stop.
  stopDesk();
  stopSession();
  resetDesk();
}
