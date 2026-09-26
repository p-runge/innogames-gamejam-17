import "server-only";

import { randomUUID } from "node:crypto";

import { publish } from "~/lib/events/bus";
import type { TipPayload } from "~/lib/events/types";
import { generate } from "~/lib/llm/client";
import { tipSchema } from "~/lib/llm/schemas";
import { applyImpulse, getMarketState } from "~/lib/market/engine";
import { TRADING_SESSION } from "~/lib/trading-session";
import { pickInformant, type Informant } from "./informant";
import { drawEvent, impulseFor } from "./outcome";
import { TIP_SYSTEM, tipPrompt } from "./prompts";
import { templatedTip } from "./templates";
import { TOPIC_SEEDS } from "./types";

/** How long a round runs before the first tip, so it misses the loading screen. */
export const FIRST_TIP_MS = 20_000;

/** The gap between tips, jittered per interval. Roughly eight tips a round. */
export const MIN_GAP_MS = 50_000;
export const MAX_GAP_MS = 70_000;

type DeskState = {
  timer: ReturnType<typeof setTimeout> | null;
  /** Impulses promised to the player and not yet delivered. */
  payouts: Set<ReturnType<typeof setTimeout>>;
  informant: Informant | null;
  /** Position in TOPIC_SEEDS, so consecutive tips are about different things. */
  seedIndex: number;
  /** One generation in flight at a time. */
  generating: boolean;
  /**
   * Bumped by every `stopDesk`. A generation reads it before awaiting and
   * checks it after, which is the only thing that can reach a `runTip` already
   * in flight when the round ends — it holds its own reference to this object,
   * so clearing the timers does not touch it and nulling the global leaves it
   * writing into an orphan.
   */
  epoch: number;
  /** What the player has been sent, for a client that joins or reloads. */
  history: TipPayload[];
};

// Pinned to globalThis for the same reason the bus and the market are: `next
// dev` re-evaluates modules on every edit, and a module-level schedule would
// leave a round with two desks and an orphaned set of payout timers.
const globalForDesk = globalThis as typeof globalThis & {
  gameNewsDesk?: DeskState;
};

function getDesk(): DeskState {
  globalForDesk.gameNewsDesk ??= {
    timer: null,
    payouts: new Set(),
    informant: null,
    seedIndex: 0,
    generating: false,
    epoch: 0,
    history: [],
  };
  return globalForDesk.gameNewsDesk;
}

/** Every tip this round has sent, oldest first. */
export function tipHistory(): TipPayload[] {
  return getDesk().history;
}

/** Test-only: impulses promised and not yet delivered. */
export function pendingPayoutCount(): number {
  return getDesk().payouts.size;
}

function nextGap(): number {
  return MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
}

function arm(delayMs: number): void {
  const desk = getDesk();
  desk.timer = setTimeout(() => {
    // Re-armed before the generation runs, so the gap is between tips rather
    // than between one tip finishing and the next starting. On a CPU-bound
    // model that difference is ten seconds of every interval.
    arm(nextGap());
    void runTip().catch((error) => {
      console.error("news desk failed", error);
    });
  }, delayMs);
}

/**
 * Start the informant.
 *
 * Idempotent on purpose, like every other round-scoped starter here: React
 * double-mounts in development and a second browser calls this too, and a
 * second schedule would double the tips without reporting anything wrong.
 */
export function startDesk(): void {
  const desk = getDesk();
  if (desk.timer !== null) return;
  desk.informant ??= pickInformant(Math.random);
  arm(FIRST_TIP_MS);
}

/**
 * Stop the schedule and drop every promised impulse.
 *
 * The payouts matter more than the timer: a tip published two seconds before
 * the bell has a payout armed for ten seconds after it, and left running it
 * would either move a market nobody is watching or hold the process open.
 * `applyImpulse` ignores calls outside a running round, so this is the first
 * net rather than the only one.
 */
export function stopDesk(): void {
  const desk = getDesk();
  if (desk.timer) clearTimeout(desk.timer);
  desk.timer = null;
  for (const payout of desk.payouts) clearTimeout(payout);
  desk.payouts.clear();
  // Anything mid-generation belongs to the round that just ended.
  desk.epoch++;
}

/**
 * Draw one event, write it, send it, and promise its impulse.
 *
 * Exported for tests, which drive it directly rather than waiting out the
 * schedule.
 */
export async function runTip(): Promise<void> {
  const desk = getDesk();

  // One at a time. A tip generated while another is in flight arrives late,
  // about a price that has already moved, and two arriving together are two
  // the player cannot act on separately.
  if (desk.generating) return;

  const informant = (desk.informant ??= pickInformant(Math.random));
  const seed = TOPIC_SEEDS[desk.seedIndex % TOPIC_SEEDS.length];
  desk.seedIndex++;

  const event = drawEvent(Math.random, seed);

  const epoch = desk.epoch;
  desk.generating = true;
  let body: string;
  try {
    const generated = await generate({
      system: TIP_SYSTEM,
      prompt: tipPrompt(informant, event),
      schema: tipSchema,
    });

    // A template rather than silence. A skipped tip is not a quiet round, it is
    // a price that jumps with no explanation — worse than a plain message.
    // `generating` above is the only concurrency guard this needs: the desk is
    // the one thing in the game that talks to the model.
    body = generated?.body.trim() || templatedTip(event);
  } finally {
    desk.generating = false;
  }

  // The round ended while the model was writing. Publishing now would put a DM
  // into a finished round and arm a payout in a set nothing will ever clear,
  // which lands on the next round's price about twenty seconds later.
  if (desk.epoch !== epoch) return;

  const { candles } = getMarketState();
  const at = candles[candles.length - 1]?.t ?? TRADING_SESSION.openMinutes;

  const payload: TipPayload = {
    id: randomUUID(),
    sender: informant.name,
    handle: informant.handle,
    body,
    at,
  };

  desk.history.push(payload);
  publish({ type: "tip", payload });

  // A rumour that was drawn false is published exactly like a true one and
  // then does nothing. That silence is the risk the player took.
  if (!event.pays) return;

  const { mood, scale } = impulseFor(event);

  // The clock starts here, at publication, and not when the timer fired. On a
  // CPU-bound model a generation takes six to twelve seconds, so measured from
  // the timer a tip could pay out before the player had read it — and the one
  // thing this feature promises is that the message comes first.
  const payout = setTimeout(() => {
    desk.payouts.delete(payout);
    applyImpulse(mood, scale);
  }, event.delayMs);

  desk.payouts.add(payout);
}

/** Test-only, and the hook the round reset uses: forget the whole round. */
export function resetDesk(): void {
  stopDesk();
  globalForDesk.gameNewsDesk = undefined;
}
