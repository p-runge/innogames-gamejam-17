import "server-only";

import { generate } from "~/lib/llm/client";
import { postLineSchema } from "~/lib/llm/schemas";
import type { Mood } from "~/lib/market/types";
import { POST_SYSTEM, postPrompt } from "./post-prompts";
import { pickForMood, type Suggestion } from "./suggestions";

/**
 * Model-written lines, drafted ahead of the click that posts them.
 *
 * The client asks for a line per button while the cooldown runs, so by the time a
 * button can be pressed again its line is already written. Nothing is generated
 * on the click itself — that was the whole point, since one generation is seconds
 * on a CPU-bound model and the post has to appear at once.
 *
 * They are kept here and handed out by id rather than returned as loose text,
 * because `sendTweet` has to resolve the mood itself: the mood is what moves the
 * price, and a body-and-mood pair off the wire would let a client post anything
 * it liked with "moon" attached.
 */

/**
 * How many recent lines the prompt is told to stay off.
 *
 * Ten rather than a handful: a round is long enough to come back round to the same
 * button several times, and the prompt is the cheap half of not repeating. The
 * expensive half is the check below, which does not depend on the model complying.
 */
const RECENT_MEMORY = 10;

/**
 * One retry when a line comes back as something already posted.
 *
 * Only one. A 4B model that has just reworded itself usually rewords itself again,
 * so the second miss is better spent on an authored line than on a third request
 * inside a cooldown that has to end on time.
 */
const RETRIES = 1;

type DraftState = {
  byId: Map<string, Suggestion>;
  /** Bodies already used this round, oldest first, for the prompt. */
  recent: string[];
  /** Every body used this round, normalized, for the duplicate check. */
  seen: Set<string>;
  /** Authored ids already used, so the fallback does not repeat either. */
  usedPoolIds: string[];
  nextId: number;
};

// Pinned to globalThis for the same reason the market and the bus are: `next dev`
// re-evaluates modules on every edit, and a line handed to the client has to stay
// resolvable when it comes back as a post.
const globalForDrafts = globalThis as typeof globalThis & {
  gameDrafts?: DraftState;
};

function getDrafts(): DraftState {
  globalForDrafts.gameDrafts ??= {
    byId: new Map(),
    recent: [],
    seen: new Set(),
    usedPoolIds: [],
    nextId: 0,
  };
  return globalForDrafts.gameDrafts;
}

/**
 * A body reduced to what makes it the same line.
 *
 * Case, punctuation and spacing all vary between two generations of the same
 * sentence, and "it's over" against "its over." is exactly the repeat a player
 * notices. Comparing the raw strings would miss every one of those.
 */
function normalize(body: string): string {
  return body
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The drafted line behind an id, or undefined when it was not one of ours. */
export function getDraft(id: string): Suggestion | undefined {
  return getDrafts().byId.get(id);
}

/** Records a line as used, so nothing draws it or rewords it again this round. */
function remember(drafts: DraftState, body: string): void {
  drafts.seen.add(normalize(body));
  drafts.recent.push(body);
  while (drafts.recent.length > RECENT_MEMORY) drafts.recent.shift();
}

/**
 * Draft one line for each mood, falling back to the authored pool per mood.
 *
 * The moods run concurrently: three is what the old crowd capped itself at on
 * four cores, and sequentially these would take three times as long as the
 * cooldown they are meant to fit inside.
 *
 * A failed or disabled model is not an error here. `generate` returns null for
 * everything from a dead container to a schema miss, and an authored line is a
 * complete answer — the player cannot tell which they got, and the price impulse
 * is identical either way.
 */
export async function draftForMoods(moods: Mood[]): Promise<Suggestion[]> {
  const drafts = getDrafts();
  // Read once, before any generation resolves, so the moods in one hand are told
  // about the same history rather than about each other's in-flight results.
  const avoid = [...drafts.recent];

  return Promise.all(
    moods.map(async (mood) => {
      for (let attempt = 0; attempt <= RETRIES; attempt++) {
        const generated = await generate({
          system: POST_SYSTEM,
          prompt: postPrompt(mood, avoid),
          schema: postLineSchema,
          // Short by design: 12 words. The ceiling is well above that so a line
          // that runs long still ends on a finished thought rather than mid-word.
          maxTokens: 60,
        });

        const body = generated?.body.trim();
        if (body === undefined || body.length === 0) break;

        // The line the model was told not to write, written anyway. Nothing about
        // this is exceptional at 4B, which is why the check is here and not only
        // in the prompt.
        if (drafts.seen.has(normalize(body))) continue;

        const suggestion: Suggestion = {
          id: `draft-${drafts.nextId++}`,
          body,
          mood,
        };

        drafts.byId.set(suggestion.id, suggestion);
        remember(drafts, body);

        return suggestion;
      }

      // Nothing usable from the model. The authored line still avoids everything
      // this round has already shown.
      const fallback = pickForMood(mood, drafts.usedPoolIds);
      drafts.usedPoolIds.push(fallback.id);
      remember(drafts, fallback.body);

      return fallback;
    }),
  );
}

/**
 * Drop everything this round drafted.
 *
 * Called when the round ends. Without it the store grows for the life of the
 * process, and the next round's prompts argue against lines nobody playing it has
 * seen.
 */
export function resetDrafts(): void {
  globalForDrafts.gameDrafts = undefined;
}
