import { tracked } from "@trpc/server";
import { z } from "zod";

import { subscribe } from "~/lib/events/bus";
import { baseProcedure, router } from "../init";

/**
 * `Last-Event-ID` arrives as a string straight from the browser and is not
 * trusted: anything that is not a positive integer means "start from now".
 */
function parseLastEventId(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

export const eventsRouter = router({
  onEvent: baseProcedure
    .input(z.object({ lastEventId: z.string().nullish() }).optional())
    .subscription(async function* (opts) {
      // tRPC types `signal` as possibly undefined across all procedure kinds,
      // though subscriptions always receive one. A never-aborting fallback
      // keeps the types honest without a non-null assertion.
      const signal = opts.signal ?? new AbortController().signal;

      const stream = subscribe({
        signal,
        lastEventId: parseLastEventId(opts.input?.lastEventId),
      });

      for await (const published of stream) {
        yield tracked(String(published.id), published.event);
      }
    }),
});
