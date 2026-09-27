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
 * The feed the player is posting into: their own posts, in clock order.
 *
 * A flat feed and not a thread. There is no subject post at the top any more —
 * every row is the same kind of thing, and the space it used to hold goes to the
 * posts instead.
 *
 * The posts are held locally and optimistically, so one appears the moment it is
 * pressed rather than after a server round trip. Sorted on a copy, because the
 * caller keeps the array this is built from.
 */
export function buildThread(mine: FeedPost[]): FeedPost[] {
  return [...mine].sort((a, b) => a.at - b.at);
}
