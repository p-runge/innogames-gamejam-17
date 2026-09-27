"use client";

import { useEffect, useRef, useState } from "react";

import type { TipPayload } from "~/lib/news/types";
import type { Mood } from "~/lib/market/types";
import { pickInformant } from "~/lib/news/informant";
import { drawEvent, impulseFor } from "~/lib/news/outcome";
import { drawTip } from "~/lib/news/templates";
import { TOPIC_SEEDS } from "~/lib/news/types";

/** How long a round runs before the first tip, so it misses the loading screen. */
export const FIRST_TIP_MS = 20_000;

/** The gap between tips, jittered per interval. Roughly eight tips a round. */
export const MIN_GAP_MS = 50_000;
export const MAX_GAP_MS = 70_000;

/**
 * The informant, leaking on a schedule.
 *
 * What the server version needed and this does not: a `globalThis` pin, an epoch
 * counter to disown a generation already in flight, a set of payout timers to
 * clear by hand, and a history to hand a client that joined late. Nothing is in
 * flight because the text is authored rather than generated, and the round ending
 * tears down the effect, whose cleanup clears everything it armed.
 *
 * Two rules survive from that version because they are about the game rather than
 * about where it runs. The gap is measured between tips, not between one
 * finishing and the next starting. And the payout clock starts at publication, so
 * the message always reaches the player before the price does.
 *
 * `at` and `applyImpulse` are read through a ref rather than taken as
 * dependencies: the session clock changes four times a second, and a schedule
 * that re-armed on each of them would never reach its own gap.
 */
export function useInformantDesk({
  running,
  at,
  applyImpulse,
}: {
  /** Whether a round is open. Going false ends the schedule and its payouts. */
  running: boolean;
  /** The session clock, so a tip sits on the same timeline as the candles. */
  at: number;
  applyImpulse: (mood: Mood, scale: number) => void;
}): TipPayload[] {
  const [tips, setTips] = useState<TipPayload[]>([]);
  const [shownRunning, setShownRunning] = useState(running);

  /*
    Adjusted during render rather than from the effect below, which is the
    `react-hooks/set-state-in-effect` shape this project's lint rules refuse — and
    rightly: a round that has begun has to be empty on its first frame, not one
    frame later, or the phone announces the last day's messages as it opens.
  */
  if (running !== shownRunning) {
    setShownRunning(running);
    setTips([]);
  }

  const latest = useRef({ at, applyImpulse });
  useEffect(() => {
    latest.current = { at, applyImpulse };
  }, [at, applyImpulse]);

  useEffect(() => {
    if (!running) return;

    const informant = pickInformant(Math.random);
    const usedFacts: string[] = [];
    const payouts = new Set<ReturnType<typeof setTimeout>>();
    /* Walked in turn, so consecutive tips are about different things. */
    let seedIndex = 0;
    let schedule: ReturnType<typeof setTimeout>;

    const leak = () => {
      const seed = TOPIC_SEEDS[seedIndex % TOPIC_SEEDS.length];
      seedIndex++;

      const event = drawEvent(Math.random, seed);
      const { body, factId } = drawTip(event, usedFacts);
      usedFacts.push(factId);

      setTips((previous) => [
        ...previous,
        {
          id: `tip-${crypto.randomUUID()}`,
          sender: informant.name,
          handle: informant.handle,
          body,
          at: latest.current.at,
        },
      ]);

      // A rumour drawn false is published exactly like a true one and then does
      // nothing. That silence is the risk the player took.
      if (event.pays) {
        const { mood, scale } = impulseFor(event);
        const payout = setTimeout(() => {
          payouts.delete(payout);
          latest.current.applyImpulse(mood, scale);
        }, event.delayMs);
        payouts.add(payout);
      }

      // Re-armed here rather than after the work, so the gap is between tips.
      schedule = setTimeout(
        leak,
        MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS),
      );
    };

    schedule = setTimeout(leak, FIRST_TIP_MS);

    return () => {
      clearTimeout(schedule);
      /*
        The payouts matter more than the schedule. A tip published a second before
        the bell has an impulse armed for up to fifteen seconds after it, and left
        running it would either move a market nobody is watching or land on the
        next round's price.
      */
      for (const payout of payouts) clearTimeout(payout);
      payouts.clear();
    };
  }, [running]);

  return tips;
}
