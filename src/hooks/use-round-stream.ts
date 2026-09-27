"use client";

import { useCallback, useState } from "react";

/**
 * Which round this page is on.
 *
 * It used to hold the candles and tips the event stream had delivered as well,
 * because those were the thing that had to be thrown away between rounds. The
 * market and the informant own their own state now and clear it themselves, so
 * what is left is the counter — and the counter is the part nothing else can
 * derive.
 *
 * It is the key anything holding per-round state watches: the phone's inbox, the
 * lines a losing head has already invented. One `open` and all of it starts over.
 */
export function useRoundStream() {
  const [round, setRound] = useState(0);

  /** Begin a round. */
  const open = useCallback(() => setRound((previous) => previous + 1), []);

  return { round, open };
}
