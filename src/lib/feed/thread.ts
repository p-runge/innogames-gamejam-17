import { OPENING_POST } from "~/lib/feed/opening-post";

export type FeedPost = {
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

/**
 * The whole thread the feed renders: the opening post, then the player's own
 * posts in clock order.
 *
 * The player's posts are held locally and optimistically, so they appear the
 * moment they are typed rather than after a server round trip. The opening post
 * is prepended rather than sorted in, because it must hold `posts[0]` — y-feed
 * renders that slot as the thread's subject, and a post stamped at the session
 * open would otherwise take it.
 */
export function buildThread(mine: FeedPost[]): FeedPost[] {
  return [OPENING_POST, ...[...mine].sort((a, b) => a.at - b.at)];
}
