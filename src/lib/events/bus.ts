import "server-only";

import { EventEmitter, on } from "node:events";

import type { GameEvent } from "./types";

export type PublishedEvent = { id: number; event: GameEvent };

export const BUFFER_SIZE = 100;

const CHANNEL = "event";

type BusState = {
  emitter: EventEmitter;
  buffer: PublishedEvent[];
  nextId: number;
};

// Pinned to globalThis because `next dev` re-evaluates modules on every edit.
// A module-level emitter would become a new emitter after each save, leaving
// already-connected clients listening to one nobody publishes to.
const globalForBus = globalThis as typeof globalThis & {
  gameEventBus?: BusState;
};

function getBus(): BusState {
  globalForBus.gameEventBus ??= {
    // One listener per connected client, and the world is shared, so Node's
    // default warning threshold of 10 would fire on the eleventh browser.
    emitter: new EventEmitter().setMaxListeners(0),
    buffer: [],
    nextId: 1,
  };
  return globalForBus.gameEventBus;
}

export function publish(event: GameEvent): PublishedEvent {
  const bus = getBus();
  const published: PublishedEvent = { id: bus.nextId++, event };

  bus.buffer.push(published);
  if (bus.buffer.length > BUFFER_SIZE) bus.buffer.shift();
  bus.emitter.emit(CHANNEL, published);

  return published;
}

/**
 * Stream events to one client: the part of the buffer it has not seen, then
 * everything published from now on.
 *
 * Deliberately not an async generator. A generator body does not start until
 * its first `next()`, which would leave the listener unattached for as long as
 * the caller takes to pull — and every event published in that window would be
 * lost. Attaching here, synchronously, closes that window.
 */
export function subscribe(opts: {
  signal: AbortSignal;
  lastEventId: number | null;
}): AsyncGenerator<PublishedEvent> {
  const bus = getBus();

  // Attached before the buffer is read below, so an event published during the
  // replay queues up in `live` instead of falling into the gap between the
  // snapshot and the live stream.
  const live = on(bus.emitter, CHANNEL, {
    signal: opts.signal,
  }) as AsyncIterableIterator<[PublishedEvent]>;

  const { lastEventId } = opts;
  const newestId = bus.buffer.at(-1)?.id ?? 0;

  // An id above everything this process has issued comes from a client that
  // reconnected across a restart, which reset the counter. It cannot resume, so
  // it starts from the present rather than waiting out the old numbering.
  const canResume = lastEventId !== null && lastEventId <= newestId;
  const backlog = canResume
    ? bus.buffer.filter((published) => published.id > lastEventId)
    : [];

  return stream(live, backlog, newestId, opts.signal);
}

async function* stream(
  live: AsyncIterableIterator<[PublishedEvent]>,
  backlog: PublishedEvent[],
  newestId: number,
  signal: AbortSignal,
): AsyncGenerator<PublishedEvent> {
  for (const published of backlog) {
    yield published;
  }

  // Everything up to `newestId` is either replayed above or deliberately
  // skipped, so live events at or below it are duplicates.
  let lastYieldedId = newestId;

  try {
    for await (const [published] of live) {
      if (published.id <= lastYieldedId) continue;
      lastYieldedId = published.id;
      yield published;
    }
  } catch (error) {
    // `on()` rejects with an AbortError when the client disconnects, which is
    // the normal end of a subscription rather than a failure to report.
    if (signal.aborted) return;
    throw error;
  }
}

/** Test-only: number of attached listeners, for leak assertions. */
export function listenerCount(): number {
  return getBus().emitter.listenerCount(CHANNEL);
}

/** Test-only: drop all state so each test starts from an empty world. */
export function resetBus(): void {
  getBus().emitter.removeAllListeners(CHANNEL);
  globalForBus.gameEventBus = undefined;
}
