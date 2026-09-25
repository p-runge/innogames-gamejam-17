import { router } from "../init";
import { eventsRouter } from "./events";
import { tweetsRouter } from "./tweets";

export const appRouter = router({
  events: eventsRouter,
  tweets: tweetsRouter,
});

export type AppRouter = typeof appRouter;
