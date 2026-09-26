import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetBus, subscribe } from "~/lib/events/bus";
import {
  getMarketState,
  resetMarket,
  startSession,
  stopSession,
} from "~/lib/market/engine";

vi.mock("~/lib/llm/client", () => ({ generate: vi.fn() }));
const { generate } = await import("~/lib/llm/client");
const mocked = vi.mocked(generate);

const { MIN_DELAY_MS } = await import("./outcome");
const {
  FIRST_TIP_MS,
  pendingPayoutCount,
  resetDesk,
  runTip,
  startDesk,
  stopDesk,
  tipHistory,
} = await import("./desk");

/**
 * Pin `Math.random` to a spelled-out sequence.
 *
 * The first value is the informant — `runTip` picks that before it draws the
 * event, and a sequence that forgets it shifts every field by one. After the
 * list runs out everything returns 0.5, which keeps a later `nextGap` from
 * wrapping back into the event's draws.
 */
function rolls(values: number[]): void {
  let index = 0;
  vi.spyOn(Math, "random").mockImplementation(() => values[index++] ?? 0.5);
}

/**
 * A confirmed, upward, medium tip that pays out after the shortest delay.
 *
 * Without pinning, one drawn event in five is a rumour that never pays, and
 * every assertion about the impulse landing fails that often — a test that is
 * right four times out of five is a test nobody can read a failure from.
 */
function payingEvent(): void {
  rolls([
    0, // pickInformant
    0.1, // direction: up
    0.5, // strength: medium
    0.9, // credibility: confirmed
    0.9, // payout roll, unused for a confirmed tip
    0, // delay: the floor, MIN_DELAY_MS
  ]);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stopDesk();
  resetDesk();
  stopSession();
  resetMarket();
  resetBus();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("runTip", () => {
  it("publishes a tip before the price moves", async () => {
    mocked.mockResolvedValue({ body: "line two at nord is down" });
    startSession();

    await runTip();

    expect(tipHistory()).toHaveLength(1);
    // The whole point of the delay: the message is readable before the chart
    // says the same thing.
    expect(getMarketState().impulse).toBe(0);
  });

  it("moves the price once the delay has run", async () => {
    mocked.mockResolvedValue({ body: "the whole board bought in yesterday" });
    payingEvent();
    startSession();

    await runTip();
    await vi.advanceTimersByTimeAsync(MIN_DELAY_MS + 250);

    // Upward, because the pinned draw says so: a payout that landed with the
    // wrong sign would still be "not zero".
    expect(getMarketState().impulse).toBeGreaterThan(0);
  });

  it("never moves the price for a rumour that does not pay out", async () => {
    mocked.mockResolvedValue({ body: "cannot stand this one up" });
    // No single constant can force a failing rumour: the credibility draw has
    // to come in under 0.4 and the payout draw at or over 0.5.
    rolls([
      0, // pickInformant
      0.1, // direction: up
      0.5, // strength: medium
      0.01, // credibility: rumor
      0.99, // payout: fails
      0.5, // delay
    ]);
    startSession();

    await runTip();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(tipHistory()).toHaveLength(1);
    expect(pendingPayoutCount()).toBe(0);
    expect(getMarketState().impulse).toBe(0);
  });

  it("falls back to a template when the model returns nothing", async () => {
    mocked.mockResolvedValue(null);
    startSession();

    await runTip();

    expect(tipHistory()[0].body.trim().length).toBeGreaterThan(0);
  });

  it("falls back to a template when the model returns only whitespace", async () => {
    // The mock goes around the schema on purpose. In production HAS_A_WORD
    // would reject this, but the desk is the thing that publishes and must not
    // depend on a validator upstream of it: a blank message is a tip the player
    // cannot read attached to a price move they cannot explain.
    mocked.mockResolvedValue({ body: "   " });
    startSession();

    await runTip();

    expect(tipHistory()[0].body.trim().length).toBeGreaterThan(0);
  });

  it("rotates the subject across consecutive tips", async () => {
    // With no model the whole round runs on templates, and templates are keyed
    // on the seed: without rotation a round would send the same line eight
    // times and the mechanic would be obvious.
    mocked.mockResolvedValue(null);
    startSession();

    await runTip();
    await runTip();
    await runTip();

    const bodies = tipHistory().map((tip) => tip.body);
    expect(new Set(bodies).size).toBe(3);
  });

  it("skips a second tip while one is still being written", async () => {
    // The schedule re-arms before the generation runs, so a slow model can put
    // the next timer on top of an unfinished tip. Two arriving together are two
    // the player cannot act on separately, and the later one is about a price
    // that has already moved.
    let release: () => void = () => {};
    mocked.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ body: "still writing" });
        }),
    );
    startSession();

    const first = runTip();
    await runTip();

    expect(tipHistory()).toHaveLength(0);

    release();
    await first;

    expect(tipHistory()).toHaveLength(1);
  });

  it("stamps the tip with the session clock", async () => {
    mocked.mockResolvedValue({ body: "two inspectors in the building" });
    startSession();

    await runTip();

    expect(tipHistory()[0].at).toBe(getMarketState().candles.at(-1)?.t);
  });

  it("gives every tip its own id", async () => {
    mocked.mockResolvedValue(null);
    startSession();

    await runTip();
    await runTip();

    const [first, second] = tipHistory();
    expect(first.id).not.toBe(second.id);
  });

  it("reaches a subscriber on the bus", async () => {
    mocked.mockResolvedValue({ body: "the big account signed" });
    startSession();
    const controller = new AbortController();
    const stream = subscribe({ signal: controller.signal, lastEventId: null });

    await runTip();
    const next = await stream.next();

    expect(next.value?.event.type).toBe("tip");
    controller.abort();
  });
});

describe("stopDesk", () => {
  it("drops a generation that finishes after the round ended", async () => {
    // The bell can fall in the six to twelve seconds a generation takes. The
    // in-flight call holds its own reference to the desk, so neither clearing
    // the timers nor nulling the global reaches it: left alone it publishes a
    // DM into a finished round and arms a payout nothing can cancel, which
    // then lands on the *next* round's price.
    let release: () => void = () => {};
    mocked.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ body: "late news" });
        }),
    );
    payingEvent();
    startSession();

    const inFlight = runTip();
    stopDesk();
    release();
    await inFlight;

    expect(tipHistory()).toHaveLength(0);
    expect(pendingPayoutCount()).toBe(0);
  });

  it("lets a later round generate again", async () => {
    // The epoch guard must not wedge the desk shut: a cancelled generation is
    // this round's business, not a permanent state.
    mocked.mockResolvedValue({ body: "the inspection closed with nothing" });
    startSession();

    stopDesk();
    await runTip();

    expect(tipHistory()).toHaveLength(1);
  });


  it("cancels a payout that has not landed yet", async () => {
    // A tip published a second before the bell arms a payout for ten seconds
    // after it. Left running it moves a market nobody is watching, or holds the
    // process open.
    mocked.mockResolvedValue({ body: "a third shift starting tomorrow" });
    payingEvent();
    startSession();

    await runTip();
    expect(pendingPayoutCount()).toBe(1);

    stopDesk();
    await vi.advanceTimersByTimeAsync(20_000);

    expect(pendingPayoutCount()).toBe(0);
    expect(getMarketState().impulse).toBe(0);
  });
});

describe("startDesk", () => {
  it("holds the first tip back until the round has settled", async () => {
    mocked.mockResolvedValue({ body: "the deal died on the fourth floor" });
    startSession();
    startDesk();

    await vi.advanceTimersByTimeAsync(FIRST_TIP_MS - 1_000);
    expect(tipHistory()).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(tipHistory()).toHaveLength(1);
  });

  it("is idempotent, so a second browser does not double the schedule", async () => {
    mocked.mockResolvedValue({ body: "someone has been building a stake" });
    startSession();
    startDesk();
    startDesk();

    await vi.advanceTimersByTimeAsync(FIRST_TIP_MS + 1_000);

    expect(tipHistory()).toHaveLength(1);
  });
});

describe("resetDesk", () => {
  it("leaves nothing of the previous round behind", async () => {
    mocked.mockResolvedValue({ body: "the inspection closed with nothing" });
    startSession();

    await runTip();
    expect(tipHistory()).toHaveLength(1);

    resetDesk();

    expect(tipHistory()).toHaveLength(0);
    expect(pendingPayoutCount()).toBe(0);
  });
});
