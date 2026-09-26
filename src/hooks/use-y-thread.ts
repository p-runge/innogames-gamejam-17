"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { useGameState } from "~/components/game-state-provider";
import { buildThread, type FeedPost } from "~/lib/feed/thread";

export type YPost = FeedPost;

/**
 * The Y thread: the crowd's replies as they arrive from the server, with the
 * player's own posts merged in.
 *
 * The two sources are kept apart on purpose. Crowd replies come over the event
 * bus and are the same for every browser; the player's posts are local and
 * optimistic, so a post appears the moment it is typed rather than after a
 * round trip. `mergePosts` puts both in clock order for rendering.
 */
export function useYThread({
  author = "You",
  handle = "@you",
}: { author?: string; handle?: string } = {}) {
  const { replies } = useGameState();
  const [mine, setMine] = useState<YPost[]>([]);

  // Counted outside the updater below, which React may run more than once per
  // call — ids have to come from somewhere that is not re-entered.
  const nextId = useRef(0);

  const post = useCallback(
    (body: string, at: number) => {
      const trimmed = body.trim();
      if (!trimmed) return;

      const id = `mine-${nextId.current++}`;

      setMine((previous) => [
        ...previous,
        { id, author, handle, body: trimmed, at, mine: true },
      ]);
    },
    [author, handle],
  );

  const posts = useMemo(() => buildThread(replies, mine), [replies, mine]);

  return { posts, post };
}
