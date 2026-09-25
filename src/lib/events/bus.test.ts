import { afterEach, describe, expect, it } from "vitest";
import {
  BUFFER_SIZE,
  listenerCount,
  publish,
  resetBus,
  subscribe,
} from "./bus";
import type { GameEvent } from "./types";

function tweet(message: string): GameEvent {
  return { type: "tweet", payload: { username: "gamejam", message } };
}

/** Collect `count` events, then stop so the generator terminates. */
async function collect(
  generator: AsyncGenerator<{ id: number; event: GameEvent }>,
  count: number,
) {
  const received: { id: number; event: GameEvent }[] = [];
  if (count === 0) return received;
  for await (const published of generator) {
    received.push(published);
    if (received.length === count) break;
  }
  return received;
}

afterEach(() => {
  resetBus();
});

describe("publish", () => {
  it("assigns monotonically increasing ids", () => {
    expect(publish(tweet("one")).id).toBe(1);
    expect(publish(tweet("two")).id).toBe(2);
  });
});

describe("subscribe", () => {
  it("delivers events published after subscribing", async () => {
    const controller = new AbortController();
    const generator = subscribe({ signal: controller.signal, lastEventId: null });
    const collected = collect(generator, 1);

    publish(tweet("live"));

    const received = await collected;
    expect(received[0]?.event.payload.message).toBe("live");
    controller.abort();
  });

  it("delivers to two subscribers at once", async () => {
    const a = new AbortController();
    const b = new AbortController();
    const first = collect(subscribe({ signal: a.signal, lastEventId: null }), 1);
    const second = collect(subscribe({ signal: b.signal, lastEventId: null }), 1);

    publish(tweet("broadcast"));

    expect((await first)[0]?.event.payload.message).toBe("broadcast");
    expect((await second)[0]?.event.payload.message).toBe("broadcast");
    a.abort();
    b.abort();
  });

  it("replays events after lastEventId before going live", async () => {
    publish(tweet("one"));
    publish(tweet("two"));
    const controller = new AbortController();

    const received = await collect(
      subscribe({ signal: controller.signal, lastEventId: 1 }),
      1,
    );

    expect(received.map((r) => r.event.payload.message)).toEqual(["two"]);
    controller.abort();
  });

  it("replays nothing when lastEventId is null", async () => {
    publish(tweet("before"));
    const controller = new AbortController();
    const generator = subscribe({ signal: controller.signal, lastEventId: null });
    const collected = collect(generator, 1);

    publish(tweet("after"));

    const received = await collected;
    expect(received.map((r) => r.event.payload.message)).toEqual(["after"]);
    controller.abort();
  });

  it("delivers an event published during replay exactly once", async () => {
    publish(tweet("buffered"));
    const controller = new AbortController();
    const generator = subscribe({ signal: controller.signal, lastEventId: 0 });

    // Pull the replayed event, then publish before pulling again. The listener
    // was attached before the replay, so this event is queued, not lost.
    const first = await generator.next();
    publish(tweet("during-replay"));
    const second = await generator.next();
    const third = generator.next();

    expect(first.value?.event.payload.message).toBe("buffered");
    expect(second.value?.event.payload.message).toBe("during-replay");
    controller.abort();
    await third;
  });

  it("falls back to live events when lastEventId predates the buffer", async () => {
    for (let i = 0; i < BUFFER_SIZE + 5; i++) publish(tweet(`event-${i}`));
    const controller = new AbortController();

    const received = await collect(
      subscribe({ signal: controller.signal, lastEventId: 1 }),
      1,
    );

    // Event 1 fell out of the buffer; the oldest survivor is delivered instead
    // of crashing or re-sending everything.
    expect(received[0]?.id).toBe(6);
    controller.abort();
  });

  it("ignores a lastEventId left over from a previous server run", async () => {
    // A redeploy restarts the id counter, so the browser reports an id the new
    // process has never issued. Resuming "after 57" would mute the stream until
    // the counter climbed past 57.
    publish(tweet("one"));
    const controller = new AbortController();
    const generator = subscribe({ signal: controller.signal, lastEventId: 57 });
    const collected = collect(generator, 1);

    publish(tweet("after-restart"));

    const received = await collected;
    expect(received[0]?.event.payload.message).toBe("after-restart");
    controller.abort();
  });

  it("drops the oldest entry when the buffer overflows", async () => {
    for (let i = 0; i < BUFFER_SIZE + 1; i++) publish(tweet(`event-${i}`));
    const controller = new AbortController();

    const received = await collect(
      subscribe({ signal: controller.signal, lastEventId: 0 }),
      1,
    );

    expect(received[0]?.id).toBe(2);
    controller.abort();
  });

  it("removes its listener when the signal aborts", async () => {
    const controller = new AbortController();
    const generator = subscribe({ signal: controller.signal, lastEventId: null });

    // The listener is attached by `subscribe` itself, before anything is
    // pulled — do not consume with `collect` here, because breaking out of a
    // `for await` closes the generator and would clean up for the wrong reason.
    expect(listenerCount()).toBe(1);
    const pending = generator.next();

    controller.abort();
    const result = await pending;

    expect(result.done).toBe(true);
    expect(listenerCount()).toBe(0);
  });
});
