import { INSANITY_MAX } from "~/lib/insanity";

/**
 * Cash in the account that ends the round a win. Shares do not count.
 *
 * Measuring cash rather than net worth is what makes the last move a rug pull
 * every time: the player has to sell into the pump they created, and sitting on
 * a million in shares with the meter nearly full is a decision rather than a
 * victory.
 */
export const WIN_CASH = 1_000_000;

export type Outcome = "won" | "insane" | "bell";

/**
 * Whether the server's `closed` flag is about the round being played now.
 *
 * The snapshot is cached and refetched on a timer, so for a moment after the
 * player starts a round it still describes the one they just left. Starting a
 * second round switches to the trading screen immediately, and without this the
 * stale flag called that round over on its first frame and threw the player
 * straight back to the game over screen — with the meter already reset, so the
 * tally read zero.
 *
 * Comparing the two timestamps is enough: a snapshot older than the start cannot
 * know about the round the start opened. A page that never pressed start passes
 * `startedAt: 0`, so a browser joining a finished round still believes it.
 */
export function roundHasClosed({
  closed,
  snapshotAt,
  startedAt,
}: {
  /** What the latest snapshot said. */
  closed: boolean;
  /** When that snapshot's data was written. */
  snapshotAt: number;
  /** When this page last asked for a round, or 0 if it never has. */
  startedAt: number;
}): boolean {
  return closed && snapshotAt > startedAt;
}

/**
 * How the round ended, or `null` while it has not.
 *
 * The win is checked first so a million that lands on the last breath still
 * counts. Cash and the meter move on different actions, so in practice this only
 * decides a tie, and the tie is the one the player would never forgive.
 */
export function resolveOutcome({
  insanity,
  cash,
  closed,
}: {
  insanity: number;
  cash: number;
  /** Whether the closing bell has rung. */
  closed: boolean;
}): Outcome | null {
  if (cash >= WIN_CASH) return "won";
  if (insanity >= INSANITY_MAX) return "insane";
  if (closed) return "bell";

  return null;
}
