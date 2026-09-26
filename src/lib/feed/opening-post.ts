import type { FeedPost } from "~/lib/feed/thread";
import { TRADING_SESSION } from "~/lib/trading-session";

/**
 * The thread's opening post.
 *
 * The feed renders `posts[0]` as the subject of the thread, in its own styling.
 * With nothing seeded, whatever arrives first takes that slot — which is the
 * player's own first sentence, promoted to the thread's subject and attributed
 * to them for the rest of the round.
 *
 * Invented, like every account here: the handle belongs to nobody, and the tip
 * is the game's fiction rather than a claim about anything tradable.
 */
export const OPENING_POST: FeedPost = {
  id: "opening",
  author: "Market Whisper",
  handle: "@whisper",
  body: "Something is happening at INNO today. Watch the open. Not financial advice.",
  at: TRADING_SESSION.openMinutes,
  replies: 412,
  reposts: 1203,
  likes: 8941,
};
