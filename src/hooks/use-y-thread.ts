"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { TweetPayload } from "~/lib/events/types";
import type { Suggestion } from "~/lib/feed/suggestions";
import { buildThread, type FeedPost } from "~/lib/feed/thread";

export type YPost = FeedPost;

/**
 * The Y thread: the opening post with the player's own posts under it.
 *
 * The player's posts are local and optimistic, so a post appears the moment it is
 * picked rather than after a round trip. Only the suggestion's id goes to the
 * server, which resolves the body and the mood from the same pool this renders
 * from — the row the player reads and the price move it causes come from one
 * authored line.
 *
 * `publish` is passed in rather than reached for, so the hook holds neither a
 * context nor a transport of its own. That is what lets the posting path be
 * tested without standing up a provider and a tRPC client around it.
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

  // Counted outside the updater below, which React may run more than once per
  // call — ids have to come from somewhere that is not re-entered.
  const nextId = useRef(0);

  const post = useCallback(
    (suggestion: Suggestion, at: number) => {
      const id = `mine-${nextId.current++}`;

      setMine((previous) => [
        ...previous,
        { id, author, handle, body: suggestion.body, at, mine: true },
      ]);

      publish({ username: author, suggestionId: suggestion.id });
    },
    [author, handle, publish],
  );

  const posts = useMemo(() => buildThread(mine), [mine]);

  return { posts, post };
}
