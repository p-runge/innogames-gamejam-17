"use client";

import { useCallback, useRef, useState } from "react";

export type YPost = {
  id: string;
  author: string;
  /** Including the leading @. */
  handle: string;
  body: string;
  /** The in-game clock, in minutes since midnight — same scale as a candle's t. */
  at: number;
  /** Posted by the player. */
  mine?: boolean;
  /** Engagement counts. Decoration — nothing in the game reads them. */
  replies?: number;
  reposts?: number;
  likes?: number;
};

/*
  The opening post and the replies it drew. All invented: none of these handles
  belongs to a real account, and the tip is the game's fiction, not a claim about
  anything tradable.
*/
const THREAD: YPost[] = [
  {
    id: "root",
    author: "Market Whisper",
    handle: "@whisper",
    body: "Something is happening at INNO today. Watch the open. Not financial advice.",
    at: 9 * 60,
    replies: 412,
    reposts: 1203,
    likes: 8941,
  },
  {
    id: "reply-1",
    author: "Kleinanleger",
    handle: "@dieptkauf",
    body: "you post this every single morning",
    at: 9 * 60 + 2,
    replies: 7,
    reposts: 2,
    likes: 340,
  },
  {
    id: "reply-2",
    author: "Chart Crimes",
    handle: "@chartcrimes",
    body: "textbook cup and handle on the 5m. I am so ready.",
    at: 9 * 60 + 4,
    replies: 31,
    reposts: 14,
    likes: 96,
  },
  {
    id: "reply-3",
    author: "Exit Liquidity",
    handle: "@exitliq",
    body: "last time I listened to this account I sold my bike",
    at: 9 * 60 + 7,
    replies: 2,
    reposts: 0,
    likes: 1502,
  },
];

/**
 * The Y thread: a seeded conversation the player can post into. Replies from the
 * crowd are static for now — have the game append to this list if you want them
 * to react to the index as the day runs.
 */
export function useYThread({
  author = "You",
  handle = "@you",
}: { author?: string; handle?: string } = {}) {
  const [posts, setPosts] = useState<YPost[]>(THREAD);
  const nextId = useRef(0);

  const post = useCallback(
    (body: string, at: number) => {
      const trimmed = body.trim();
      if (!trimmed) return;

      // Counted outside the updater, which React may run more than once.
      const id = `mine-${nextId.current++}`;

      setPosts((previous) => [
        ...previous,
        { id, author, handle, body: trimmed, at, mine: true },
      ]);
    },
    [author, handle],
  );

  return { posts, post };
}
