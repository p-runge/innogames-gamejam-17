import "server-only";

import { randomUUID } from "node:crypto";
import { EventEmitter, on } from "node:events";

import type { GameEvent } from "./types";

export type PublishedEvent = { id: number; event: GameEvent };

export const BUFFER_SIZE = 100;

/**
 * Event kinds that are delivered live but never replayed.
 *
 * `price` is a snapshot kind: the newest candle supersedes every earlier one,
 * and a joining or reconnecting client gets the whole series from
 * `session.state` instead. The other kinds are a log — each one is a thing that
 * was said, and missing it means it is gone.
 *
 * Buffering both in one FIFO does not work: the engine publishes four price
 * events a second, so within 25 seconds they own every slot and a client
 * reconnecting after a blip replays a screenful of superseded candles and none
 * of the posts it actually missed.
 */
const EPHEMERAL_TYPES: ReadonlySet<GameEvent["type"]> = new Set(["price"]);

const CHANNEL = "event";

type BusState = {
  emitter: EventEmitter;
  buffer: PublishedEvent[];
  nextId: number;
  runId: string;
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
    // Ids restart at 1 in every process, so the number alone cannot say which
    // run minted it. This tags the run so a client reconnecting across a
    // restart is recognisable as belonging to a numbering that no longer holds.
    runId: randomUUID().slice(0, 8),
  };
  return globalForBus.gameEventBus;
}

/** Identifies this process's id sequence; changes whenever the bus is created. */
export function getRunId(): string {
  return getBus().runId;
}

export function publish(event: GameEvent): PublishedEvent {
  const bus = getBus();
  const published: PublishedEvent = { id: bus.nextId++, event };

  // Ids are handed out for every event, ephemeral or not, so a client's
  // Last-Event-ID still describes a single ordering.
  if (!EPHEMERAL_TYPES.has(event.type)) {
    bus.buffer.push(published);
    if (bus.buffer.length > BUFFER_SIZE) bus.buffer.shift();
  }

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

  // Recognising an id from an earlier process run is not decidable here — the
  // sequence number alone does not say which run minted it. That belongs to
  // whoever hands out the ids; see `parseLastEventId` in the events router.
  const backlog =
    lastEventId === null
      ? []
      : bus.buffer.filter((published) => published.id > lastEventId);

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
