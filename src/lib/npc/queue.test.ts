import { afterEach, describe, expect, it } from "vitest";
import { resetBus, subscribe } from "~/lib/events/bus";
import type { Persona } from "~/lib/llm/schemas";
import {
  getMarketState,
  resetMarket,
  startSession,
  stopSession,
} from "~/lib/market/engine";
import {
  enqueueReply,
  MAX_PENDING,
  pendingCount,
  publishNextReply,
  recentBodies,
  resetQueue,
} from "./queue";

const persona: Persona = {
  name: "Exit Liquidity",
  handle: "exitliq",
  bio: "sold the bike",
  stance: "bear",
  tic: "lists what he has sold so far",
};

function pending(mood: "moon" | "dump" = "moon", body = "to the moon") {
  return { persona, body, mood, source: "ambient" as const };
}

const impulse = () => getMarketState().impulse;

afterEach(() => {
  resetQueue();
  stopSession();
  resetMarket();
  resetBus();
});

describe("enqueueReply", () => {
  it("does not move the price", () => {
    // The whole reason the buffer exists: a reply nobody has read yet must not
    // reach the market, or the chart reacts to posts that are not in the feed.
    startSession();
    enqueueReply(pending());
    expect(impulse()).toBe(0);
    expect(pendingCount()).toBe(1);
  });

  it("drops the oldest entry past MAX_PENDING", () => {
    // A player posts faster than a CPU-bound model generates. Without a ceiling
    // the server keeps answering tweets nobody is looking at any more.
    for (let i = 0; i < MAX_PENDING + 5; i++) enqueueReply(pending());
    expect(pendingCount()).toBe(MAX_PENDING);
  });
});

describe("publishNextReply", () => {
  it("moves the price when the reply reaches the feed", () => {
    startSession();
    enqueueReply(pending());
    expect(impulse()).toBe(0);
    publishNextReply();
    expect(impulse()).toBeGreaterThan(0);
  });

  it("pulls the price down for a dump", () => {
    startSession();
    enqueueReply(pending("dump"));
    publishNextReply();
    expect(impulse()).toBeLessThan(0);
  });

  it("weighs a reaction heavier than ambient chatter", () => {
    startSession();
    enqueueReply({ ...pending(), source: "ambient" });
    publishNextReply();
    const ambient = impulse();

    resetQueue();
    resetMarket();
    startSession();
    enqueueReply({ ...pending(), source: "reaction" });
    publishNextReply();
    expect(impulse()).toBeGreaterThan(ambient);
  });

  it("emits a reply event carrying the persona", async () => {
    startSession();
    const controller = new AbortController();
    const stream = subscribe({ signal: controller.signal, lastEventId: null });
    const next = stream.next();
    enqueueReply(pending());
    publishNextReply();
    const published = await next;
    controller.abort();

    expect(published.value?.event.type).toBe("reply");
    if (published.value?.event.type === "reply") {
      expect(published.value.event.payload.handle).toBe("exitliq");
      expect(published.value.event.payload.author).toBe("Exit Liquidity");
    }
  });

  it("returns null and changes nothing on an empty buffer", () => {
    startSession();
    expect(publishNextReply()).toBeNull();
    expect(impulse()).toBe(0);
  });

  it("empties the buffer one reply at a time", () => {
    enqueueReply(pending());
    enqueueReply(pending());
    publishNextReply();
    expect(pendingCount()).toBe(1);
  });
});

describe("recentBodies", () => {
  it("remembers published bodies newest first, and not pending ones", () => {
    enqueueReply(pending("moon", "first"));
    enqueueReply(pending("moon", "second"));
    enqueueReply(pending("moon", "still waiting"));
    publishNextReply();
    publishNextReply();

    expect(recentBodies().slice(0, 2)).toEqual(["second", "first"]);
    expect(recentBodies()).not.toContain("still waiting");
  });

  it("is empty before anything is published", () => {
    enqueueReply(pending());
    expect(recentBodies()).toEqual([]);
  });
});
