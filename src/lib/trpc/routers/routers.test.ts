import { isTrackedEnvelope } from "@trpc/server";
import { afterEach, describe, expect, it } from "vitest";
import { getRunId, publish, resetBus } from "~/lib/events/bus";
import type { GameEvent } from "~/lib/events/types";
import { appRouter } from "./_app";

// The signal belongs to createCaller, not to the procedure call. Passing it as
// a second argument to the procedure type-checks nowhere and is dropped at
// runtime, which leaves the resolver with no signal at all.
const caller = (signal?: AbortSignal) => appRouter.createCaller({}, { signal });

function tweet(message: string): GameEvent {
  return { type: "tweet", payload: { username: "gamejam", message } };
}

/**
 * `tracked()` wraps each event in tRPC's envelope. The SSE layer turns that
 * into `{ id, data }` on the wire, but a direct caller sees the envelope
 * itself — a tuple. Unwrap it so assertions read against the event.
 */
function unwrap(value: unknown): { id: string; event: GameEvent } {
  expect(isTrackedEnvelope(value)).toBe(true);
  const [id, event] = value as [string, GameEvent];
  return { id, event };
}

afterEach(() => {
  resetBus();
});

describe("sendTweet", () => {
  it("publishes a valid tweet and returns its id", async () => {
    const result = await caller().tweets.sendTweet({
      username: "gamejam",
      message: "hello world",
    });
    expect(result.id).toBe(1);
  });

  it("rejects an empty message without publishing", async () => {
    await expect(
      caller().tweets.sendTweet({ username: "gamejam", message: "" }),
    ).rejects.toThrow();

    // Nothing reached the bus, so the next publish still gets id 1.
    expect(publish(tweet("next")).id).toBe(1);
  });

  it("rejects a message longer than 280 characters", async () => {
    await expect(
      caller().tweets.sendTweet({
        username: "gamejam",
        message: "x".repeat(281),
      }),
    ).rejects.toThrow();
  });
});

describe("onEvent", () => {
  it("yields events published to the bus", async () => {
    const controller = new AbortController();
    const iterable = await caller(controller.signal).events.onEvent({ lastEventId: null });
    const iterator = iterable[Symbol.asyncIterator]();
    const next = iterator.next();

    publish(tweet("streamed"));

    const received = unwrap((await next).value);
    // Ids carry this run's tag so a client reconnecting across a restart can
    // be told apart from one resuming within the same run.
    expect(received.id).toBe(`${getRunId()}:1`);
    expect(received.event).toMatchObject({
      type: "tweet",
      payload: { message: "streamed" },
    });
    controller.abort();
  });

  it("treats a non-numeric lastEventId as no replay", async () => {
    publish(tweet("history"));
    const controller = new AbortController();
    const iterable = await caller(controller.signal).events.onEvent({ lastEventId: "abc" });
    const iterator = iterable[Symbol.asyncIterator]();
    const next = iterator.next();

    publish(tweet("live"));

    // "abc" must not replay the buffer and must not swallow live events.
    expect(unwrap((await next).value).event).toMatchObject({
      payload: { message: "live" },
    });
    controller.abort();
  });

  it("treats a negative lastEventId as no replay", async () => {
    // Every real id is greater than a negative number, so without the guard in
    // parseLastEventId this would resume "after -5" and dump the entire buffer
    // at a client that asked for nothing.
    publish(tweet("history"));
    const controller = new AbortController();
    const iterable = await caller(controller.signal).events.onEvent({ lastEventId: "-5" });
    const iterator = iterable[Symbol.asyncIterator]();
    const next = iterator.next();

    publish(tweet("live"));

    expect(unwrap((await next).value).event).toMatchObject({
      payload: { message: "live" },
    });
    controller.abort();
  });

  it("ignores a lastEventId minted by a previous server run", async () => {
    // The dangerous case is a stale id that is *below* the new run's counter:
    // it compares as resumable and silently skips everything the new run
    // published before it. Comparing numbers cannot catch this, because both
    // runs issue an event 1.
    // Take the id exactly as the server hands it to a client, rather than
    // constructing one — a constructed id could assume a format the server
    // does not actually emit, and the test would prove nothing.
    const oldRun = new AbortController();
    const oldStream = await caller(oldRun.signal).events.onEvent({
      lastEventId: null,
    });
    const oldIterator = oldStream[Symbol.asyncIterator]();
    const oldPending = oldIterator.next();
    publish(tweet("old run"));
    const stale = unwrap((await oldPending).value).id;
    oldRun.abort();

    resetBus(); // a redeploy: new process, counter back to 1

    publish(tweet("new run first"));
    publish(tweet("new run second"));

    const controller = new AbortController();
    const iterable = await caller(controller.signal).events.onEvent({
      lastEventId: stale,
    });
    const iterator = iterable[Symbol.asyncIterator]();
    const next = iterator.next();

    publish(tweet("live"));

    // Resuming "after 1" would hand back the new run's second event. The id
    // belongs to a numbering that no longer exists, so nothing is replayed.
    expect(unwrap((await next).value).event).toMatchObject({
      payload: { message: "live" },
    });
    controller.abort();
  });

  it("terminates when its signal aborts", { timeout: 2_000 }, async () => {
    // Nothing pinned this before: the signal used to be passed as a second
    // argument to the procedure, where tRPC drops it, so the resolver fell back
    // to a never-aborting signal and the subscription could not be ended.
    const controller = new AbortController();
    const iterable = await caller(controller.signal).events.onEvent({
      lastEventId: null,
    });
    const iterator = iterable[Symbol.asyncIterator]();
    const pending = iterator.next();

    controller.abort();

    expect((await pending).done).toBe(true);
  });

  it("replays from an id minted by this run", async () => {
    publish(tweet("one"));
    publish(tweet("two"));
    const controller = new AbortController();
    const iterable = await caller(controller.signal).events.onEvent({
      lastEventId: `${getRunId()}:1`,
    });
    const iterator = iterable[Symbol.asyncIterator]();

    const received = unwrap((await iterator.next()).value);
    expect(received.id).toBe(`${getRunId()}:2`);
    expect(received.event).toMatchObject({ payload: { message: "two" } });
    controller.abort();
  });

  it("ignores a bare sequence number with no run tag", async () => {
    // What the server emitted before ids carried a run tag. A client holding
    // one of those cannot be placed in this run's numbering.
    publish(tweet("history"));
    const controller = new AbortController();
    const iterable = await caller(controller.signal).events.onEvent({
      lastEventId: "1",
    });
    const iterator = iterable[Symbol.asyncIterator]();
    const next = iterator.next();

    publish(tweet("live"));

    expect(unwrap((await next).value).event).toMatchObject({
      payload: { message: "live" },
    });
    controller.abort();
  });
});
