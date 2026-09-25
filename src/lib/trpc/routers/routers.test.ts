import { isTrackedEnvelope } from "@trpc/server";
import { afterEach, describe, expect, it } from "vitest";
import { publish, resetBus } from "~/lib/events/bus";
import type { GameEvent } from "~/lib/events/types";
import { appRouter } from "./_app";

const caller = () => appRouter.createCaller({});

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
    const iterable = await caller().events.onEvent(
      { lastEventId: null },
      { signal: controller.signal },
    );
    const iterator = iterable[Symbol.asyncIterator]();
    const next = iterator.next();

    publish(tweet("streamed"));

    const received = unwrap((await next).value);
    expect(received.id).toBe("1");
    expect(received.event).toMatchObject({
      type: "tweet",
      payload: { message: "streamed" },
    });
    controller.abort();
  });

  it("treats a non-numeric lastEventId as no replay", async () => {
    publish(tweet("history"));
    const controller = new AbortController();
    const iterable = await caller().events.onEvent(
      { lastEventId: "abc" },
      { signal: controller.signal },
    );
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
    const iterable = await caller().events.onEvent(
      { lastEventId: "-5" },
      { signal: controller.signal },
    );
    const iterator = iterable[Symbol.asyncIterator]();
    const next = iterator.next();

    publish(tweet("live"));

    expect(unwrap((await next).value).event).toMatchObject({
      payload: { message: "live" },
    });
    controller.abort();
  });

  it("replays from a numeric lastEventId", async () => {
    publish(tweet("one"));
    publish(tweet("two"));
    const controller = new AbortController();
    const iterable = await caller().events.onEvent(
      { lastEventId: "1" },
      { signal: controller.signal },
    );
    const iterator = iterable[Symbol.asyncIterator]();

    const received = unwrap((await iterator.next()).value);
    expect(received.id).toBe("2");
    expect(received.event).toMatchObject({ payload: { message: "two" } });
    controller.abort();
  });
});
