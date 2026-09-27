/** Smallest pause between any two effects, in milliseconds. */
export const MIN_GAP_MS = 250;

export type PlayGate = {
  /**
   * Whether `id` may sound at `now`, recording the play if it may. Refusals
   * leave no trace, so a refused trigger keeps its next turn.
   */
  allows: (id: string, cooldownMs: number, now: number) => boolean;
};

/**
 * Decides which effects actually reach the speakers.
 *
 * Two rules, both answering the same problem: triggers arrive far faster than a
 * one-second clip takes to play. The price moves four times a second and the
 * order buttons can be hammered, so without a gate the same voice overlaps
 * itself and the whole soundtrack turns into noise.
 *
 * - a per-sound cooldown, so one trigger cannot machine-gun its own clip
 * - a global minimum gap, so two unrelated triggers landing in the same frame
 *   do not talk over each other
 *
 * The clock is a parameter rather than read from `Date.now()` inside, which is
 * what makes both rules testable without waiting them out.
 */
export function createPlayGate({ minGapMs = MIN_GAP_MS } = {}): PlayGate {
  const lastPlayed = new Map<string, number>();
  let lastAnything = Number.NEGATIVE_INFINITY;

  return {
    allows(id, cooldownMs, now) {
      if (now - lastAnything < minGapMs) return false;

      const previous = lastPlayed.get(id);
      if (previous !== undefined && now - previous < cooldownMs) return false;

      lastPlayed.set(id, now);
      lastAnything = now;
      return true;
    },
  };
}
