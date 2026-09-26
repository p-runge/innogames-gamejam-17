import type { ReplyPayload } from "~/lib/events/types";
import { OPENING_POST } from "~/lib/npc/templates";

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
 * Drops a handle the model wrote at the very start of its own reply.
 *
 * The prompt forbids it and small models do it anyway, usually with the handle
 * they were told they are — which renders as an account replying to itself.
 * Only the leading mention goes: a handle further in is someone addressing
 * another account, which is ordinary on a feed. A reply that is nothing but a
 * handle is left intact, because a blank row is worse than a strange one.
 */
function stripLeadingMention(body: string): string {
  const withoutMention = body.replace(/^\s*@[a-z0-9_]+[,:\s]+/i, "");
  return withoutMention.trim().length > 0 ? withoutMention.trim() : body;
}

/**
 * A crowd reply as the feed renders it.
 *
 * `index` is the reply's position in the stream so far, and it is in the id
 * because one account posts more than once per round: without it two replies
 * from the same handle share a React key and the second silently replaces the
 * first in the list.
 */
export function toFeedPost(reply: ReplyPayload, index: number): FeedPost {
  return {
    id: `reply-${reply.handle}-${index}`,
    author: reply.author,
    handle: `@${reply.handle}`,
    body: stripLeadingMention(reply.body),
    at: reply.at,
    mine: false,
  };
}

/**
 * The whole thread the feed renders: the opening post, then the crowd and the
 * player in clock order.
 *
 * `replies` is the server's history plus whatever the live stream has added, so
 * the same reply can appear twice after a reload; it is deduplicated on author,
 * body and timestamp. The opening post is prepended rather than sorted in,
 * because it must hold `posts[0]` — y-feed renders that slot as the thread's
 * subject, and a reply stamped at the session open would otherwise take it.
 */
export function buildThread(
  replies: ReplyPayload[],
  mine: FeedPost[],
): FeedPost[] {
  const seen = new Set<string>();
  const crowd: FeedPost[] = [];

  for (const reply of replies) {
    const key = `${reply.handle}|${reply.at}|${reply.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    crowd.push(toFeedPost(reply, crowd.length));
  }

  return [OPENING_POST, ...mergePosts(crowd, mine)];
}

/**
 * The thread as one list: what the crowd said and what the player posted, in
 * clock order.
 *
 * The player's own posts are held separately and optimistically, so they appear
 * the moment they are typed rather than after a server round trip. At an equal
 * timestamp the player's post sorts first, because a reply stamped the same
 * in-game minute is answering it — the other order reads as the crowd replying
 * before anyone spoke.
 */
export function mergePosts(crowd: FeedPost[], mine: FeedPost[]): FeedPost[] {
  return [...mine, ...crowd].sort((a, b) => a.at - b.at);
}
