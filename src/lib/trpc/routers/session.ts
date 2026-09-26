import { getMarketState, isRunning } from "~/lib/market/engine";
import { startRound } from "~/lib/round";
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
   * The series as it stands. A joining client needs this because the bus buffer
   * does not replay price events at all — they are a snapshot kind, superseded
   * by the next one — so this query is the only way to a full series.
   */
  state: baseProcedure.query(() => {
    const { candles, closed } = getMarketState();
    return { candles, closed, running: isRunning() };
  }),
});
