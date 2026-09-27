"use client";

import { useEffect, useRef, useState } from "react";

import type { TipPayload } from "~/lib/events/types";
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
}: {
  tips: TipPayload[];
  band: Band;
  /** The session clock, so a fabrication is stamped like a real message. */
  at: number;
}): TipPayload[] {
  const [merged, setMerged] = useState<TipPayload[]>(tips);
  const [seenReal, setSeenReal] = useState(tips.length);

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
  const latest = useRef({ at, lastReal: tips.at(-1) });
  useEffect(() => {
    latest.current = { at, lastReal: tips.at(-1) };
  }, [at, tips]);

  /** Lines already invented this round, so one is not used twice. */
  const usedLines = useRef<string[]>([]);

  // A stable reference per band, because it is read straight off the constant.
  const gap = FABRICATION_GAP_MS[band.id];

  useEffect(() => {
    if (gap === undefined) return;

    let timer: ReturnType<typeof setTimeout>;

    const arm = () => {
      timer = setTimeout(
        () => {
          const { at: now, lastReal } = latest.current;

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
              exclude: usedLines.current,
            });

            usedLines.current.push(lineId);
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
