"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { ReplyPayload, TweetPayload } from "~/lib/events/types";
import { buildThread, type FeedPost } from "~/lib/feed/thread";
import { toTweetPayload } from "~/lib/feed/tweet";

export type YPost = FeedPost;

/**
 * The Y thread: the crowd's replies as they arrive from the server, with the
 * player's own posts merged in.
 *
 * The two sources are kept apart on purpose. Crowd replies come over the event
 * bus and are the same for every browser; the player's posts are local and
 * optimistic, so a post appears the moment it is typed rather than after a
 * round trip. `mergePosts` puts both in clock order for rendering.
 *
 * `replies` and `publish` are passed in rather than reached for, so the hook
 * holds neither a context nor a transport of its own. That is what lets the
 * posting path be tested without standing up a provider and a tRPC client
 * around it — the local row and the call to the server are one step here, and
 * nothing else guarantees they stay that way.
 */
export function useYThread({
  replies,
  publish,
  author = "You",
  handle = "@you",
}: {
  replies: ReplyPayload[];
  /** Hands the post to the server, where the crowd picks it up. */
  publish: (payload: TweetPayload) => void;
  author?: string;
  handle?: string;
}) {
  const [mine, setMine] = useState<YPost[]>([]);

  // Counted outside the updater below, which React may run more than once per
  // call — ids have to come from somewhere that is not re-entered.
  const nextId = useRef(0);

  const post = useCallback(
    (body: string, at: number) => {
      // One payload feeds both the thread and the server, so the row the player
      // reads is the text the crowd was given — a body over the length bound
      // would otherwise render in full and reach the model clipped.
      const payload = toTweetPayload(author, body);
      if (payload === null) return;

      const id = `mine-${nextId.current++}`;

      setMine((previous) => [
        ...previous,
        { id, author, handle, body: payload.message, at, mine: true },
      ]);

      publish(payload);
    },
    [author, handle, publish],
  );

  const posts = useMemo(() => buildThread(replies, mine), [replies, mine]);

  return { posts, post };
}
