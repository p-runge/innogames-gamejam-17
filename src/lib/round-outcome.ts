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
