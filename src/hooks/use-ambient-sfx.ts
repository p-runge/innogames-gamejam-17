"use client";

import { useEffect, useRef } from "react";

import { useSound } from "~/components/sound-provider";
import type { SoundId } from "~/lib/audio/catalogue";
import { readPriceMove } from "~/lib/audio/price-mood";
import type { Candle } from "~/lib/market/types";

/**
 * The two sounds nobody triggers on purpose: the market moving hard enough to
 * get a reaction, and the trader getting bored of his own job. Both live here
 * rather than in the scene, which has enough to do holding two browser windows.
 */

/**
 * React out loud when the price makes a move worth reacting to.
 *
 * The candles change four times a second, so this effect runs that often. Which
 * is fine — the reading is O(1) and the repeat is held off by the long cooldowns
 * on these two sounds rather than by anything here.
 */
export function useMarketSfx(candles: readonly Candle[]): void {
  const { play } = useSound();

  useEffect(() => {
    const move = readPriceMove(candles);
    if (move === "rally") play("price-rally");
    if (move === "crash") play("price-crash");
  }, [candles, play]);
}

/**
 * Clear a throat in the messages dock when the informant drops something off.
 *
 * `ready` is the same distinction the dock itself has to make: the provider
 * renders before its snapshot resolves, so a reload mid-round looks like an empty
 * list followed by eight tips at once — the same shape one tip arriving has.
 * Without it, every reload would announce the whole round out loud.
 */
export function useTipSfx({
  count,
  ready,
}: {
  count: number;
  ready: boolean;
}): void {
  const { play } = useSound();

  /** null until the history has been seen, so it is never mistaken for news. */
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (!ready) return;

    const previous = seen.current;
    seen.current = count;

    if (previous !== null && count > previous) play("dm-tip");
  }, [count, ready, play]);
}

/** Alternated, so the same yawn is not the sound of every quiet stretch. */
const IDLE_CLIPS: SoundId[] = ["idle-yawn", "idle-cough"];

/** How long nothing has to happen before the boredom shows. */
export const IDLE_MS = 45_000;

/**
 * Yawn or cough when the player has not touched anything for a while.
 *
 * Listens on the window rather than on a scene element: the trading screen is
 * two nested browser frames and a chart that swallows its own events, and idle
 * means nobody touched anything anywhere.
 */
export function useIdleSfx({ idleMs = IDLE_MS }: { idleMs?: number } = {}): void {
  const { play } = useSound();

  useEffect(() => {
    let timer = 0;
    let next = 0;

    function arm() {
      timer = window.setTimeout(fire, idleMs);
    }

    function fire() {
      play(IDLE_CLIPS[next++ % IDLE_CLIPS.length]);
      // Re-armed rather than one-shot: a player who walks away should hear the
      // room they left, not one yawn and then silence.
      arm();
    }

    function reset() {
      window.clearTimeout(timer);
      arm();
    }

    arm();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [idleMs, play]);
}
