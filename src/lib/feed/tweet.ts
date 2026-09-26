import type { TweetPayload } from "~/lib/events/types";

/**
 * The composer's ceiling, matching `tweetPayloadSchema`'s bound on `message`.
 *
 * Enforced here rather than left to the schema, because the player's post is
 * rendered locally and sent separately: a body over the bound renders in the
 * thread and then fails validation on the way to the server, so the crowd never
 * answers the one post the player put the most into.
 */
export const MAX_TWEET_LENGTH = 280;

/**
 * The player's post as the server wants it, or null when there is nothing to
 * send.
 *
 * `username` is a display name, not a handle — it reaches the model as "Someone
 * called ${username} just posted", where a leading @ makes the reply open with
 * a mention of the player.
 */
export function toTweetPayload(
  username: string,
  body: string,
): TweetPayload | null {
  const message = body.trim().slice(0, MAX_TWEET_LENGTH);
  if (message.length === 0) return null;

  return { username, message };
}
