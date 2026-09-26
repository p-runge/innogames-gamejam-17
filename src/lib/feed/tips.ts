import type { TipPayload } from "~/lib/events/types";

/**
 * The informant's messages as one list: the server's history, then whatever
 * the live stream has added.
 *
 * Deduplicated on `id`, because after a reload both sources carry the tips
 * published before the reconnect — the snapshot has them as history and the
 * bus replays them from its buffer. Left in twice, the dock would count them
 * as unread a second time and announce messages the player has already read.
 *
 * The history's copy wins, for the same reason it comes first: it is the
 * server's own record of what was sent.
 */
export function mergeTips(
  history: TipPayload[],
  live: TipPayload[],
): TipPayload[] {
  const seen = new Set<string>();
  const merged: TipPayload[] = [];

  for (const tip of [...history, ...live]) {
    if (seen.has(tip.id)) continue;
    seen.add(tip.id);
    merged.push(tip);
  }

  return merged;
}
