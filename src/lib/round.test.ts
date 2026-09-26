import { afterEach, describe, expect, it, vi } from "vitest";
import { resetBus } from "~/lib/events/bus";
import { getMarketState, isRunning, resetMarket } from "~/lib/market/engine";

vi.mock("~/lib/llm/client", () => ({ generate: vi.fn(async () => null) }));

const { getCast, resetCast } = await import("./npc/cast");
const { activeJobCount, resetCrowd } = await import("./npc/crowd");
const { enqueueReply, pendingCount, recentBodies, resetQueue } = await import(
  "./npc/queue"
);
const { endRound, startRound } = await import("./round");

const PERSONA = {
  name: "Exit Liquidity",
  handle: "exitliq",
  bio: "sold the bike, sold the car, still here somehow",
  stance: "bear" as const,
  tic: "lists what he has sold",
};

function pending() {
  return {
    persona: PERSONA,
    body: "sell it all",
    mood: "dump" as const,
    source: "ambient" as const,
  };
}

afterEach(() => {
  endRound();
  resetCrowd();
  resetQueue();
  resetCast();
  resetMarket();
  resetBus();
  vi.useRealTimers();
});

describe("startRound", () => {
  it("has a market and a cast running afterwards", async () => {
    await startRound();
    expect(isRunning()).toBe(true);
    expect(getCast()).not.toHaveLength(0);
  });

  it("is idempotent, so a second browser joins instead of rebuilding", async () => {
    await startRound();
    const cast = getCast();
    await startRound();
    expect(getCast()).toBe(cast);
  });
});

describe("endRound", () => {
  it("stops the market", async () => {
    await startRound();
    endRound();
    expect(isRunning()).toBe(false);
  });

  it("drops the cast, the buffer and what was already published", async () => {
    // Without this the next round opens with the last one's accounts, replays
    // its leftover replies into the new price, and prompts against a thread
    // nobody can see any more.
    await startRound();
    enqueueReply(pending());
    endRound();

    expect(getCast()).toEqual([]);
    expect(pendingCount()).toBe(0);
    expect(recentBodies()).toEqual([]);
  });

  it("stops the crowd's timers", async () => {
    // The publish timer runs every 7s and the ambient timer every 11s. Left
    // running they keep posting into a finished round and keep a 4-core
    // inference request going forever on a shared host.
    vi.useFakeTimers();
    await startRound();
    endRound();

    vi.advanceTimersByTime(60_000);
    expect(activeJobCount()).toBe(0);
    expect(pendingCount()).toBe(0);
  });

  it("is safe to call when no round is running", () => {
    expect(() => endRound()).not.toThrow();
  });
});

describe("the round ending on its own", () => {
  it("tears everything down when the session clock passes the close", async () => {
    vi.useFakeTimers();
    await startRound();
    enqueueReply(pending());

    // Well past the 8.5 minute session.
    vi.advanceTimersByTime(15 * 60 * 1_000);

    expect(isRunning()).toBe(false);
    expect(getMarketState().closed).toBe(true);
    expect(getCast()).toEqual([]);
    expect(pendingCount()).toBe(0);
  });

  it("lets a later start open a genuinely fresh round", async () => {
    vi.useFakeTimers();
    await startRound();
    vi.advanceTimersByTime(15 * 60 * 1_000);
    vi.useRealTimers();

    await startRound();

    expect(isRunning()).toBe(true);
    expect(getMarketState().closed).toBe(false);
    expect(getMarketState().candles).toHaveLength(1);
    expect(getCast()).not.toHaveLength(0);
  });
});
