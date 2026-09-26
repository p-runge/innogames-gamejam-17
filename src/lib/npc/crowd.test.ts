import { afterEach, describe, expect, it, vi } from "vitest";
import { resetBus } from "~/lib/events/bus";
import { REPLY_SYSTEM } from "~/lib/npc/prompts";
import {
  getMarketState,
  resetMarket,
  startSession,
  stopSession,
} from "~/lib/market/engine";

vi.mock("~/lib/llm/client", () => ({ generate: vi.fn() }));
const { generate } = await import("~/lib/llm/client");
const mocked = vi.mocked(generate);

const { generateCast, resetCast } = await import("./cast");
const { pendingCount, resetQueue } = await import("./queue");
const {
  activeJobCount,
  MAX_CONCURRENT_JOBS,
  reactToTweet,
  resetCrowd,
  runAmbientJob,
  startCrowd,
  stopCrowd,
} = await import("./crowd");

const PERSONA = {
  name: "Exit Liquidity",
  handle: "exitliq",
  bio: "sold the bike",
  stance: "bear" as const,
  tic: "lists what he has sold",
};

const REPLY = { body: "you absolute clown", mood: "dump" as const };

/** Put a usable cast in place, then leave `generate` to the test's own mock. */
async function withCast(): Promise<void> {
  mocked.mockResolvedValue(PERSONA);
  await generateCast();
  mocked.mockReset();
}

afterEach(() => {
  stopCrowd();
  resetCrowd();
  resetQueue();
  resetCast();
  stopSession();
  resetMarket();
  resetBus();
  vi.resetAllMocks();
});

describe("reactToTweet", () => {
  it("buffers replies without moving the price", async () => {
    await withCast();
    mocked.mockResolvedValue(REPLY);
    startSession();

    await reactToTweet({ username: "you", message: "bought the dip" });

    expect(pendingCount()).toBeGreaterThan(0);
    // Still zero: generating is not publishing, and only publishing moves the
    // market. This is the requirement the whole buffer exists for.
    expect(getMarketState().impulse).toBe(0);
  });

  it("answers the player even while background chatter is generating", async () => {
    // MAX_CONCURRENT_JOBS is 2, an ambient job takes 6-12s in production and the
    // ambient timer fires every 11s, so background chatter holds a slot most of
    // the time. Sharing the budget means the headline mechanic — post something,
    // the crowd answers — silently does not happen, at random, with nothing
    // logged and no way for the player to tell it from being ignored.
    await withCast();
    let settle: (value: unknown) => void = () => {};
    mocked.mockImplementationOnce(
      () => new Promise((resolve) => (settle = resolve)),
    );
    startSession();
    startCrowd();

    // Occupy a slot with ambient work that never finishes.
    void runAmbientJob();
    await vi.waitFor(() => expect(activeJobCount()).toBeGreaterThan(0));

    mocked.mockResolvedValue(REPLY);
    await reactToTweet({ username: "you", message: "SELLING EVERYTHING" });

    expect(pendingCount()).toBeGreaterThan(0);
    settle(null);
  });

  it("still answers with a template when every generation fails", async () => {
    // Dropping the job left the curated cast assembled and silent: an empty feed
    // for the whole round and player posts with no market effect. The fallback
    // has to reach the feed, not just exist.
    await withCast();
    mocked.mockResolvedValue(null);
    startSession();

    await reactToTweet({ username: "you", message: "hello" });

    expect(pendingCount()).toBeGreaterThan(0);
  });

  it("sends a templated reply through the same publish path as a generated one", async () => {
    // Asserting on the impulse value would be asserting on a coin flip: a
    // template for a flat market may legitimately be "neutral", which is zero
    // drift by design. What matters is that the reply reaches the feed as a
    // player reaction, which is what carries the weight.
    await withCast();
    mocked.mockResolvedValue(null);
    startSession();

    await reactToTweet({ username: "you", message: "hello" });
    const { publishNextReply } = await import("./queue");
    const published = publishNextReply();

    expect(published).not.toBeNull();
    expect(published?.source).toBe("reaction");
    expect(published?.body.length).toBeGreaterThan(0);
  });

  it("stays within MAX_CONCURRENT_JOBS when the player spams", async () => {
    await withCast();
    // Generations that never settle, the way a CPU-bound model behaves while
    // the player keeps typing.
    mocked.mockImplementation(() => new Promise(() => {}));
    startSession();

    for (let i = 0; i < 20; i++) {
      void reactToTweet({ username: "you", message: `tweet ${i}` });
    }
    await vi.waitFor(() => expect(activeJobCount()).toBeGreaterThan(0));

    expect(activeJobCount()).toBeLessThanOrEqual(MAX_CONCURRENT_JOBS);
  });

  it("asks the model for a reply in the persona's voice", async () => {
    await withCast();
    mocked.mockResolvedValue(REPLY);
    startSession();

    await reactToTweet({ username: "you", message: "bought the dip at 1180" });

    // Selected by system prompt rather than by position: a reaction is preceded
    // by the request that reads the player's direction, which is not a reply and
    // carries none of the voice.
    const [call] = mocked.mock.calls.filter(
      (candidate) => candidate[0].system === REPLY_SYSTEM,
    );
    // Everything that shapes the voice: who they are, what they think, how they
    // talk.
    expect(call[0].prompt).toContain("Exit Liquidity");
    expect(call[0].prompt).toContain("sold the bike");
    expect(call[0].prompt).toContain("bought the dip at 1180");
    // The market context is what makes the crowd react to the chart rather than
    // to the post alone.
    expect(call[0].prompt).toContain("INNO");
  });

  it("keeps the persona's own handle out of the prompt", async () => {
    // Given its handle, the model opens the reply with it and the account ends
    // up addressing itself. Nothing about the voice needs it.
    await withCast();
    mocked.mockResolvedValue(REPLY);
    startSession();

    await reactToTweet({ username: "you", message: "hello" });

    expect(mocked.mock.calls[0][0].prompt).not.toContain("exitliq");
  });

  it("marks player reactions so they weigh more than ambient chatter", async () => {
    await withCast();
    mocked.mockResolvedValue(REPLY);
    startSession();

    await reactToTweet({ username: "you", message: "hello" });
    const { publishNextReply } = await import("./queue");
    const published = publishNextReply();

    expect(published?.source).toBe("reaction");
  });
});

describe("reactToTweet and the player's lean", () => {
  /** Every prompt `generate` was asked for, in call order. */
  function prompts(): string[] {
    return mocked.mock.calls.map((call) => call[0].prompt);
  }

  it("reads which way the post argues before answering it", async () => {
    await withCast();
    mocked.mockResolvedValueOnce({ lean: "down" }).mockResolvedValue(REPLY);
    startSession();

    await reactToTweet({ username: "you", message: "it is going to zero" });

    // The classification comes first and is asked about the post itself.
    expect(prompts()[0]).toContain("it is going to zero");
    // Every reply then knows it, whatever the persona's stance.
    const replyPrompts = prompts().slice(1);
    expect(replyPrompts.length).toBeGreaterThan(0);
    for (const prompt of replyPrompts) {
      expect(prompt).toContain("Their post argues the price is going down");
    }
  });

  it("still answers when the lean cannot be read", async () => {
    await withCast();
    mocked.mockResolvedValueOnce(null).mockResolvedValue(REPLY);
    startSession();

    await reactToTweet({ username: "you", message: "anything happening" });

    const replyPrompts = prompts().slice(1);
    expect(replyPrompts.length).toBeGreaterThan(0);
    for (const prompt of replyPrompts) {
      expect(prompt).not.toContain("Their post argues");
    }
  });
});
