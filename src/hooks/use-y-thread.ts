"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TweetPayload } from "~/lib/events/types";
import {
  MOOD_ORDER,
  pickForMood,
  type Suggestion,
} from "~/lib/feed/suggestions";
import { buildThread, type FeedPost } from "~/lib/feed/thread";
import type { Mood } from "~/lib/market/types";

export type YPost = FeedPost;

/**
 * How long the buttons stay dead after a post.
 *
 * It is a pacing rule first — without it the price is whatever the player can
 * click — and the drafting window second: the replacement line is requested the
 * moment this starts, so by the time the buttons come back its text is already
 * written and the click itself never waits on the model.
 *
 * Seven seconds rather than three, which is a game decision and not a budget for
 * the model. An impulse decays to about a hundredth of itself over this long
 * (`IMPULSE_DECAY` per quarter-second tick), so a post's whole effect on the price
 * lands and settles before the next one can be sent: each post reads as a
 * distinct kick instead of blurring into the last. It also clears the 5s candle,
 * so one post shows up as its own bar, and it leaves room for the trade the post
 * was for — buy, post, watch it run, sell into it.
 */
export const POST_COOLDOWN_MS = 7_000;

/**
 * The Y thread, and the line waiting behind each of the five moods.
 *
 * All five are always available — the choice is which direction to push, not which
 * directions are on offer. Each holds one written line; pressing a button posts its
 * line, starts the cooldown, and asks for a replacement for that button alone. The
 * other four keep the lines already written for them, so nothing is generated that
 * nobody uses.
 *
 * A line that has not arrived by the time the buttons are live again falls back to
 * the authored pool, so a slow, disabled or broken model costs flavour and never
 * playability.
 *
 * `publish` and `draft` are passed in rather than reached for, so the hook holds
 * neither a context nor a transport of its own.
 */
export function useYThread({
  publish,
  draft,
  author = "You",
  handle = "@you",
}: {
  /** Hands the post to the server, which applies its mood to the price. */
  publish: (payload: TweetPayload) => void;
  /** Asks the server to write a line per mood. Rejections are non-fatal. */
  draft: (moods: Mood[]) => Promise<Suggestion[]>;
  author?: string;
  handle?: string;
}) {
  const [mine, setMine] = useState<YPost[]>([]);

  /** Lines already written and waiting, by mood. */
  const [ready, setReady] = useState<Partial<Record<Mood, Suggestion>>>({});

  const [cooling, setCooling] = useState(false);

  // Counted outside the updater below, which React may run more than once per
  // call — ids have to come from somewhere that is not re-entered.
  const nextId = useRef(0);

  /*
    Every authored line this client has fallen back to, so a mood that comes round
    again does not repeat one. Only the pool needs this — a drafted line is checked
    against the whole round on the server. A ref and not state: nothing renders it,
    and as state every post would re-render to no visible effect.
  */
  const usedPoolIds = useRef<string[]>([]);

  /** True once unmounted, so a draft landing late cannot set state. */
  const dropped = useRef(false);
  useEffect(() => {
    dropped.current = false;
    return () => {
      dropped.current = true;
    };
  }, []);

  const request = useCallback(
    (moods: Mood[]) => {
      draft(moods)
        .then((lines) => {
          if (dropped.current) return;

          // Merged rather than replaced: a request now covers only the button that
          // was just pressed, and the other four are still holding lines that were
          // written for them and have not been used.
          setReady((previous) => {
            const next = { ...previous };
            for (const line of lines) next[line.mood] = line;
            return next;
          });
        })
        .catch((error: unknown) => {
          // Not surfaced: the pool answers every button anyway, and an error over
          // the chart is worse than a line the player cannot tell apart.
          console.error("drafting posts failed", error);
        });
    },
    [draft],
  );

  // The first lines have had no cooldown to be drafted in, so all five are asked
  // for on mount. Until they land the buttons run on the authored pool. This is
  // the only request that covers more than one mood.
  useEffect(() => {
    request([...MOOD_ORDER]);
  }, [request]);

  const post = useCallback(
    (mood: Mood, at: number) => {
      if (cooling) return;

      // What was drafted for this button, or an authored line when nothing
      // arrived in time.
      const drafted = ready[mood];
      const suggestion = drafted ?? pickForMood(mood, usedPoolIds.current);
      if (drafted === undefined) usedPoolIds.current.push(suggestion.id);

      const id = `mine-${nextId.current++}`;

      setMine((previous) => [
        ...previous,
        { id, author, handle, body: suggestion.body, at, mine: true },
      ]);

      publish({ username: author, suggestionId: suggestion.id });

      /*
        Only the button that was just pressed needs a new line — the other four are
        still holding lines nobody has used. Cleared before the request so the line
        that was just posted cannot go out a second time if the replacement takes
        longer than the cooldown; the pool covers that gap.
      */
      setReady((previous) => ({ ...previous, [mood]: undefined }));
      setCooling(true);
      request([mood]);

      window.setTimeout(() => {
        if (!dropped.current) setCooling(false);
      }, POST_COOLDOWN_MS);
    },
    [author, cooling, handle, publish, ready, request],
  );

  const posts = useMemo(() => buildThread(mine), [mine]);

  return { posts, cooling, post };
}
