import { tracked } from "@trpc/server";
import { z } from "zod";

import { getRunId, subscribe } from "~/lib/events/bus";
import { baseProcedure, router } from "../init";

/**
 * Event ids are `<runId>:<sequence>`. The run tag is what makes a stale id
 * recognisable: sequence numbers restart at 1 in every process, so a client
 * reconnecting across a redeploy reports an id that compares as perfectly
 * resumable against a numbering that no longer exists.
 *
 * `Last-Event-ID` comes straight from the browser and is not trusted. Anything
 * from another run, or without a positive integer sequence, means "start now".
 */
function parseLastEventId(
  raw: string | null | undefined,
  runId: string,
): number | null {
  if (!raw) return null;

  const separator = raw.lastIndexOf(":");
  if (separator === -1) return null;
  if (raw.slice(0, separator) !== runId) return null;

  const sequence = raw.slice(separator + 1);
  // Deliberately stricter than Number(): that would accept "0x10", " 12 " and
  // "1e2", and an id of 0 would replay the entire buffer at a client that
  // asked for nothing.
  if (!/^\d+$/.test(sequence)) return null;

  const parsed = Number(sequence);
  return parsed >= 1 ? parsed : null;
}

export const eventsRouter = router({
  onEvent: baseProcedure
    .input(z.object({ lastEventId: z.string().nullish() }).optional())
    .subscription(async function* (opts) {
      // tRPC types `signal` as possibly undefined across all procedure kinds,
      // though subscriptions always receive one. A never-aborting fallback
      // keeps the types honest without a non-null assertion.
      const signal = opts.signal ?? new AbortController().signal;
      const runId = getRunId();

      const stream = subscribe({
        signal,
        lastEventId: parseLastEventId(opts.input?.lastEventId, runId),
      });

      for await (const published of stream) {
        yield tracked(`${runId}:${published.id}`, published.event);
      }
    }),
});
