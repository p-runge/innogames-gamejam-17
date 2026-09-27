"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { applyPost, bandFor, costOf, type Band } from "~/lib/insanity";
import type { Mood } from "~/lib/market/types";

type Insanity = {
  /** The reading, 0 to `INSANITY_MAX`. */
  insanity: number;
  band: Band;
  /** Charge a post that has just gone out. */
  register: (mood: Mood) => void;
  /** What a mood costs right now, for the button offering it. */
  cost: (mood: Mood) => number;
  /**
   * Empty the meter.
   *
   * Called when a round starts rather than when one ends: this provider sits
   * above the scene switch and outlives a round, so going back to the menu and
   * starting again is what has to clear it.
   */
  reset: () => void;
};

const InsanityContext = createContext<Insanity | null>(null);

/**
 * The player's head, held for the whole document.
 *
 * Client state and not the server's, for the same reason the portfolio is: a
 * resource bar that lags a click by a network round trip feels broken, and a
 * single-player round has no score to defend.
 *
 * It wraps the tree rather than living inside `GameScene`, because the meter and
 * the informant's phone are in different subtrees. The phone sits outside the
 * laptop's display entirely, beside the hands, where there is nothing to thread
 * a prop through.
 */
export default function InsanityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [insanity, setInsanity] = useState(0);

  const register = useCallback((mood: Mood) => {
    setInsanity((previous) => applyPost(previous, mood));
  }, []);

  const reset = useCallback(() => setInsanity(0), []);

  const cost = useCallback((mood: Mood) => costOf(insanity, mood), [insanity]);

  const value = useMemo(
    () => ({ insanity, band: bandFor(insanity), register, cost, reset }),
    [insanity, register, cost, reset],
  );

  return (
    <InsanityContext.Provider value={value}>
      {children}
    </InsanityContext.Provider>
  );
}

export function useInsanity(): Insanity {
  const state = useContext(InsanityContext);
  if (state === null) {
    throw new Error("useInsanity must be used inside InsanityProvider");
  }
  return state;
}
