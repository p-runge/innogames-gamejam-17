"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { TweetPayload } from "~/lib/events/types";
import {
  pickReplies,
  REPLIES_PER_POST,
  REPLY_DELAY_MS,
} from "~/lib/feed/replies";
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
  cooldownMs = POST_COOLDOWN_MS,
  replies = REPLIES_PER_POST,
}: {
  /** Hands the post to the server, which applies its mood to the price. */
  publish: (payload: TweetPayload) => void;
  author?: string;
  handle?: string;
  /**
   * How long the buttons stay dead. A parameter rather than the constant,
   * because a manic poster fires faster: the bands in `~/lib/insanity` own the
   * number and this hook only obeys it.
   */
  cooldownMs?: number;
  /**
   * How many replies one post draws. Also a band's business — the feed closing
   * in is one of the things going insane feels like.
   */
  replies?: number;
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

  /** The same, for the reply lines — a separate pool, so a separate tally. */
  const usedReplies = useRef<string[]>([]);

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

      /*
        One reply to what was just posted, a couple of seconds behind it. It carries
        the post's own clock time rather than a later one: the feed sorts by it and
        the sort is stable, so an equal stamp keeps arrival order — the reply lands
        directly above the post it answers, once the list is reversed for display.

        The timer is not tracked for cancellation. `dropped` already stops the state
        update, and a two-second timeout outliving the round costs nothing — which is
        not true of the cooldown, whose timer this mirrors.
      */
      pickReplies(mood, replies, usedReplies.current).forEach(
        (reply, index) => {
          usedReplies.current.push(reply.lineId);

          const replyId = `reply-${id}-${index}`;

          window.setTimeout(() => {
            if (dropped.current) return;

            setMine((previous) => [
              ...previous,
              {
                id: replyId,
                author: reply.author,
                handle: reply.handle,
                body: reply.body,
                at,
              },
            ]);
          }, REPLY_DELAY_MS);
        },
      );

      setCooling(true);
      window.setTimeout(() => {
        if (!dropped.current) setCooling(false);
      }, cooldownMs);
    },
    [author, cooling, cooldownMs, handle, publish, replies],
  );

  const posts = useMemo(() => buildThread(mine), [mine]);

  return { posts, cooling, post };
}
