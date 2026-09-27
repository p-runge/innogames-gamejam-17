import { getMarketState, isRunning } from "~/lib/market/engine";
import { tipHistory } from "~/lib/news/desk";
import { endRound, startRound } from "~/lib/round";
import { baseProcedure, router } from "../init";

export const sessionRouter = router({
  /**
   * Start the round. Safe to call from every client that loads: the engine
   * ignores a start while a session is already running, so the second browser
   * joins the same world instead of building its own.
   */
  start: baseProcedure.mutation(() => {
    startRound();
    const { candles, closed } = getMarketState();
    return { candles, closed };
  }),

  /**
   * End the round for good.
   *
   * Called when the player leaves a finished round for the menu. Without it the
   * ticker outlives the ending, and the next start joins the abandoned round
   * rather than opening a new day.
   */
  end: baseProcedure.mutation(() => {
    endRound();

    return { closed: true } as const;
  }),

  /**
   * The series as it stands. A joining client needs this because the bus buffer
   * does not replay price events at all — they are a snapshot kind, superseded
   * by the next one — so this query is the only way to a full series.
   */
  state: baseProcedure.query(() => {
    const { candles, closed } = getMarketState();
    return {
      candles,
      closed,
      running: isRunning(),
      // The informant's messages so far. A client that joins or reloads
      // mid-round rebuilds the dock from this; the subscription carries it
      // from there.
      tips: tipHistory(),
    };
  }),
});
