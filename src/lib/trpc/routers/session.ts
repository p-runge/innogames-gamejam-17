import { getMarketState, isRunning, startSession } from "~/lib/market/engine";
import { baseProcedure, router } from "../init";

export const sessionRouter = router({
  /**
   * Start the round. Safe to call from every client that loads: the engine
   * ignores a start while a session is already running.
   */
  start: baseProcedure.mutation(() => {
    startSession();
    const { candles, closed } = getMarketState();
    return { candles, closed };
  }),

  /**
   * The series as it stands. A joining client needs this because the bus buffer
   * holds 100 events, which at four price ticks per second is 25 seconds of
   * history rather than the whole round.
   */
  state: baseProcedure.query(() => {
    const { candles, closed } = getMarketState();
    return { candles, closed, running: isRunning() };
  }),
});
