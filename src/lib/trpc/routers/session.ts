import { getMarketState, isRunning } from "~/lib/market/engine";
import { getCast } from "~/lib/npc/cast";
import { replyHistory } from "~/lib/npc/queue";
import { startRound } from "~/lib/round";
import { baseProcedure, router } from "../init";

export const sessionRouter = router({
  /**
   * Start the round. Safe to call from every client that loads: the engine
   * ignores a start while a session is already running, and the cast is cached,
   * so the second browser joins the same world instead of building its own.
   *
   * Generating ten personas takes seconds per persona on a CPU-bound model.
   * That cost is paid here, while the player is still looking at a loading
   * screen, rather than during the round.
   */
  start: baseProcedure.mutation(async () => {
    await startRound();
    const { candles, closed } = getMarketState();
    return { candles, closed, cast: getCast() };
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
      cast: getCast(),
      // The thread so far. A client that joins or reloads mid-round rebuilds
      // the feed from this; the subscription carries it from there.
      replies: replyHistory(),
    };
  }),
});
