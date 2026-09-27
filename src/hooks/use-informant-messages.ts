"use client";

import { useEffect, useRef, useState } from "react";

import type { TipPayload } from "~/lib/news/types";
import { drawFabrication, FABRICATION_GAP_MS } from "~/lib/feed/fabrications";
import type { Band } from "~/lib/insanity";

/**
 * Everything the phone has been sent this round, real and invented, in the order
 * it arrived.
 *
 * One list rather than two, because the phone announces whatever is last: kept
 * apart, an older lie would swallow a real tip that came in after it.
 *
 * The fabrication schedule lives here rather than in the phone, so `PhoneOnDesk`
 * stays a component that is handed its messages, and its test stays a test of a
 * phone rather than of a player's mental state.
 */
export function useInformantMessages({
  tips,
  band,
  at,
  round,
}: {
  tips: TipPayload[];
  band: Band;
  /** The session clock, so a fabrication is stamped like a real message. */
  at: number;
  /**
   * Which round this is. The phone is mounted on the desk and never unmounts, so
   * this is what tells it a day has ended — otherwise the next one opens showing
   * the last one's messages, and the last one's lies, which by then have nothing
   * behind them at all.
   */
  round: number;
}): TipPayload[] {
  const [merged, setMerged] = useState<TipPayload[]>(tips);
  const [seenReal, setSeenReal] = useState(tips.length);
  const [shownRound, setShownRound] = useState(round);

  /*
    Lines already invented, and which round invented them. Cleared inside the
    schedule below rather than here: writing a ref during render is the shape
    this project's lint rules refuse, and the pool only matters at the moment one
    is drawn.
  */
  const usedLines = useRef<{ round: number; lines: string[] }>({
    round,
    lines: [],
  });

  // Adjusted during render rather than from an effect, like the counter below:
  // a round that began has to be empty on its first frame, not one frame later.
  if (round !== shownRound) {
    setShownRound(round);
    setMerged(tips);
    setSeenReal(tips.length);
  }

  /*
    Adjusting state during render rather than from an effect, the same shape the
    phone itself already uses: an effect that appended would render the old list
    first and the new message a frame later.

    Compared against a count, not a ref, because the provider rerenders four times
    a second on price ticks and only a change in length is news.
  */
  if (tips.length > seenReal) {
    setMerged((previous) => [...previous, ...tips.slice(seenReal)]);
    setSeenReal(tips.length);
  }

  /*
    The clock and the account to impersonate, kept current for the schedule below
    without being among its dependencies. Both change four times a second; in the
    dependency array they would tear the schedule down and re-arm it before it
    could ever fire, and nothing would be invented at all.
  */
  const latest = useRef({ at, lastReal: tips.at(-1), round });
  useEffect(() => {
    latest.current = { at, lastReal: tips.at(-1), round };
  }, [at, tips, round]);

  // A stable reference per band, because it is read straight off the constant.
  const gap = FABRICATION_GAP_MS[band.id];

  useEffect(() => {
    if (gap === undefined) return;

    let timer: ReturnType<typeof setTimeout>;

    const arm = () => {
      timer = setTimeout(
        () => {
          const { at: now, lastReal, round: current } = latest.current;

          // A new day has not heard any of the last one's lines.
          if (usedLines.current.round !== current) {
            usedLines.current = { round: current, lines: [] };
          }

          /*
            Nobody has written yet, so there is no account to wear. Re-arm and wait
            rather than inventing a name: a message from a stranger would be the
            one the player could discount immediately.
          */
          if (lastReal !== undefined) {
            const { tip, lineId } = drawFabrication({
              at: now,
              sender: lastReal.sender,
              handle: lastReal.handle,
              exclude: usedLines.current.lines,
            });

            usedLines.current.lines.push(lineId);
            setMerged((previous) => [...previous, tip]);
          }

          arm();
        },
        gap.min + Math.random() * (gap.max - gap.min),
      );
    };

    arm();

    return () => clearTimeout(timer);
  }, [gap]);

  return merged;
}
