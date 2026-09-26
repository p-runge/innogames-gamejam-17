import "server-only";

import type { TweetPayload } from "~/lib/events/types";
import { generate } from "~/lib/llm/client";
import { leanSchema, replySchema, type Persona } from "~/lib/llm/schemas";
import { getMarketState } from "~/lib/market/engine";
import { generateCast, getCast } from "./cast";
import {
  ambientPrompt,
  leanPrompt,
  LEAN_SYSTEM,
  reactionPrompt,
  REPLY_SYSTEM,
  type PlayerLean,
} from "./prompts";
import { enqueueReply, publishNextReply, recentBodies } from "./queue";
import { templatedReply, type PriceDirection } from "./templates";

/**
 * Concurrent generations. Four cores serve the model, so more parallel requests
 * make every one of them slower without producing replies any sooner.
 */
export const MAX_CONCURRENT_JOBS = 3;

/**
 * Of those, how many background chatter may hold.
 *
 * Reactions and ambient posts sharing one budget is not a fair split, it is a
 * lost mechanic: an ambient generation takes 6-12s in production and the ambient
 * timer fires every 11s, so chatter occupies a slot most of the time. A player
 * posting into that window got no answer at all, with nothing logged, and from
 * their seat that is indistinguishable from the crowd ignoring them. Answering
 * the player is the point of the feature, so it always has room.
 */
const MAX_AMBIENT_JOBS = 1;

/** How often a buffered reply reaches the feed. */
const PUBLISH_INTERVAL_MS = 7_000;

/** How often the crowd comments on the price unprompted. */
const AMBIENT_INTERVAL_MS = 11_000;

/** Personas that answer one player tweet. */
const REACTION_FANOUT = 2;

type CrowdState = {
  publishTimer: ReturnType<typeof setInterval> | null;
  ambientTimer: ReturnType<typeof setInterval> | null;
  activeJobs: number;
  ambientJobs: number;
};

const globalForCrowd = globalThis as typeof globalThis & {
  gameCrowd?: CrowdState;
};

function getCrowd(): CrowdState {
  globalForCrowd.gameCrowd ??= {
    publishTimer: null,
    ambientTimer: null,
    activeJobs: 0,
    ambientJobs: 0,
  };
  return globalForCrowd.gameCrowd;
}

export function activeJobCount(): number {
  return getCrowd().activeJobs;
}

/** How the price has moved recently, as a percentage over the last few candles. */
function recentChange(): number {
  const { candles } = getMarketState();
  const latest = candles[candles.length - 1];
  const earlier = candles[Math.max(0, candles.length - 6)];
  if (latest === undefined || earlier === undefined) return 0;
  if (earlier.open === 0) return 0;
  return ((latest.close - earlier.open) / earlier.open) * 100;
}

/** Recent price direction in words: the only market context a prompt needs. */
function priceContext(): string {
  const change = recentChange();
  if (change > 3) return `INNO is up ${change.toFixed(1)}% over recent minutes.`;
  if (change < -3) {
    return `INNO is down ${Math.abs(change).toFixed(1)}% over recent minutes.`;
  }
  return "INNO has barely moved for several minutes.";
}

function priceDirection(): PriceDirection {
  const change = recentChange();
  if (change > 3) return "up";
  if (change < -3) return "down";
  return "flat";
}

/**
 * A uniform sample of the cast.
 *
 * `sort(() => Math.random() - 0.5)` is not a shuffle: the comparator is
 * inconsistent, and the result stays measurably biased toward the original
 * order, so the first few accounts would do most of the talking. That is the
 * same "ten accounts, one voice" symptom the prompt work went after, arriving
 * through the back door.
 */
function pickPersonas(count: number): Persona[] {
  const pool = [...getCast()];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Generate one reply and park it. Buffers nothing when the model fails, so a
 * dead container costs a quiet feed rather than an error.
 */
async function runJob(
  persona: Persona,
  prompt: string,
  source: "ambient" | "reaction",
): Promise<void> {
  const crowd = getCrowd();
  const ambient = source === "ambient";

  // Checked before the counters go up, so a burst of tweets cannot open more
  // generations than the model can serve. Ambient work is capped separately and
  // lower, which is what leaves room for an answer to the player.
  if (crowd.activeJobs >= MAX_CONCURRENT_JOBS) return;
  if (ambient && crowd.ambientJobs >= MAX_AMBIENT_JOBS) return;

  crowd.activeJobs++;
  if (ambient) crowd.ambientJobs++;
  try {
    const generated = await generate({
      system: REPLY_SYSTEM,
      prompt,
      schema: replySchema,
    });
    // A template rather than silence. With the model switched off, unreachable,
    // or every request past its timeout, dropping the job left the curated cast
    // assembled and mute: an empty feed for the whole round and player posts
    // with no market effect at all. Templates travel the same path as generated
    // replies, so publication still moves the price and nothing else changes.
    const reply = generated ?? templatedReply(persona, priceDirection());
    enqueueReply({ ...reply, persona, source });
  } finally {
    crowd.activeJobs--;
    if (ambient) crowd.ambientJobs--;
  }
}

/** One piece of background chatter. Exported so a test can occupy the slot. */
export async function runAmbientJob(): Promise<void> {
  const [persona] = pickPersonas(1);
  if (persona === undefined) return;
  await runJob(
    persona,
    ambientPrompt(persona, priceContext(), recentBodies()),
    "ambient",
  );
}

/**
 * Which way the player argued, as the crowd will read it.
 *
 * One short request ahead of the replies rather than a judgement folded into
 * each of them. Asked to work out for itself whether a post agreed with its own
 * stance, qwen3.5:4b got it backwards; given the direction outright it complied
 * on every reply. `maxTokens` is tiny because the answer is one word, which is
 * what keeps this off the latency the player actually feels.
 *
 * Returns null when the model cannot answer, and the replies then fall back to
 * the account's own range — a quieter tweet, not a broken one.
 */
async function readLean(tweet: TweetPayload): Promise<PlayerLean | null> {
  const crowd = getCrowd();
  // Held against the same ceiling as the replies. This request sits in front of
  // every reaction, so left uncounted it is the one thing a burst of tweets can
  // open without limit — twenty posts would put twenty requests on four cores
  // and slow down the replies they were meant to steer.
  if (crowd.activeJobs >= MAX_CONCURRENT_JOBS) return null;

  crowd.activeJobs++;
  try {
    const judged = await generate({
      system: LEAN_SYSTEM,
      prompt: leanPrompt(tweet),
      schema: leanSchema,
      // A judgement, not a voice: sampling wide here buys nothing but noise.
      temperature: 0.2,
      maxTokens: 16,
    });

    return judged?.lean ?? null;
  } finally {
    crowd.activeJobs--;
  }
}

/** Two personas answer the player. Nothing reaches the market until published. */
export async function reactToTweet(tweet: TweetPayload): Promise<void> {
  await generateCast();
  const context = priceContext();
  const recent = recentBodies();
  const lean = await readLean(tweet);

  await Promise.all(
    pickPersonas(REACTION_FANOUT).map((persona) =>
      runJob(
        persona,
        reactionPrompt(persona, context, tweet, recent, lean ?? undefined),
        "reaction",
      ),
    ),
  );
}

/** Start the background chatter and the drain that publishes it. */
export function startCrowd(): void {
  const crowd = getCrowd();

  crowd.publishTimer ??= setInterval(() => {
    publishNextReply();
  }, PUBLISH_INTERVAL_MS);

  crowd.ambientTimer ??= setInterval(() => {
    void runAmbientJob();
  }, AMBIENT_INTERVAL_MS);
}

export function stopCrowd(): void {
  const crowd = getCrowd();
  if (crowd.publishTimer) clearInterval(crowd.publishTimer);
  if (crowd.ambientTimer) clearInterval(crowd.ambientTimer);
  crowd.publishTimer = null;
  crowd.ambientTimer = null;
}

/** Test-only: forget the timers and the job count. */
export function resetCrowd(): void {
  stopCrowd();
  globalForCrowd.gameCrowd = undefined;
}
