"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TweetPayload } from "~/lib/events/types";
import { pickForMood } from "~/lib/feed/suggestions";
import { buildThread, type FeedPost } from "~/lib/feed/thread";
import type { Mood } from "~/lib/market/types";

export type YPost = FeedPost;

/**
 * How long the buttons stay dead after a post.
 *
 * A pacing rule: without it the price is whatever the player can click, and a post
 * is worth about as much as the mouse button. Three seconds is roughly how long an
 * impulse takes to spend most of itself, so the chart has visibly answered the last
 * post before the next one can be sent.
 *
 * It is deliberately short now that nothing is generated between posts — it used to
 * also be the window a model wrote the next line in, and that is what made a longer
 * one worth having.
 */
export const POST_COOLDOWN_MS = 3_000;

/**
 * The Y thread and the posting rule behind it.
 *
 * All five moods are always available: the choice is which direction to push, not
 * which directions are on offer. Pressing one draws a line of that mood at random
 * from the authored pool, posts it, and starts the cooldown.
 *
 * `publish` is passed in rather than reached for, so the hook holds neither a
 * context nor a transport of its own. That is what lets the posting path be tested
 * without standing up a provider and a tRPC client around it.
 */
export function useYThread({
  publish,
  author = "You",
  handle = "@you",
}: {
  /** Hands the post to the server, which applies its mood to the price. */
  publish: (payload: TweetPayload) => void;
  author?: string;
  handle?: string;
}) {
  const [mine, setMine] = useState<YPost[]>([]);
  const [cooling, setCooling] = useState(false);

  // Counted outside the updater below, which React may run more than once per
  // call — ids have to come from somewhere that is not re-entered.
  const nextId = useRef(0);

  /*
    Every line used this round, so a mood that comes round again does not repeat
    one. A ref and not state: nothing renders it, and as state every post would
    re-render the feed to no visible effect.
  */
  const used = useRef<string[]>([]);

  /** True once unmounted, so the cooldown's timer cannot set state afterwards. */
  const dropped = useRef(false);
  useEffect(() => {
    dropped.current = false;
    return () => {
      dropped.current = true;
    };
  }, []);

  const post = useCallback(
    (mood: Mood, at: number) => {
      if (cooling) return;

      const suggestion = pickForMood(mood, used.current);
      used.current.push(suggestion.id);

      const id = `mine-${nextId.current++}`;

      setMine((previous) => [
        ...previous,
        { id, author, handle, body: suggestion.body, at, mine: true },
      ]);

      // Only the id goes over the wire: the server resolves the body and the mood
      // from the same pool this drew from, so the row the player reads and the
      // price move it causes come from one authored line.
      publish({ username: author, suggestionId: suggestion.id });

      setCooling(true);
      window.setTimeout(() => {
        if (!dropped.current) setCooling(false);
      }, POST_COOLDOWN_MS);
    },
    [author, cooling, handle, publish],
  );

  const posts = useMemo(() => buildThread(mine), [mine]);

  return { posts, cooling, post };
}
