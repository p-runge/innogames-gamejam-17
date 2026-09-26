import { router } from "../init";
import { eventsRouter } from "./events";
import { sessionRouter } from "./session";
import { tweetsRouter } from "./tweets";

export const appRouter = router({
  events: eventsRouter,
  session: sessionRouter,
  tweets: tweetsRouter,
});

export type AppRouter = typeof appRouter;
