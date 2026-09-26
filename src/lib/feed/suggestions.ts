import type { Mood } from "~/lib/market/types";

/**
 * One thing the player can post, with the market reading already attached.
 *
 * The mood is authored here rather than worked out from the text at runtime.
 * That is the whole reason this shape exists: the price move a post causes is
 * decided by whoever wrote the line, so it is predictable in playtesting and
 * needs no model, no lexicon and no round trip to score.
 */
export type Suggestion = {
  id: string;
  body: string;
  mood: Mood;
};

/**
 * The pool the composer offers from.
 *
 * Deliberately interleaved by mood: the feed shows a few consecutive entries at
 * a time, so a run of three has to offer a real choice rather than three ways to
 * say the same thing. Keep that alternating when adding lines.
 *
 * Invented, like every account in this game: none of these is advice and none of
 * them is about anything tradable.
 */
export const SUGGESTIONS: readonly Suggestion[] = [
  { id: "every-time", body: "every single time. every time.", mood: "dump" },
  {
    id: "accumulation",
    body: "this is what accumulation looks like",
    mood: "bullish",
  },
  { id: "anyone-here", body: "is anyone actually here", mood: "neutral" },
  {
    id: "before-the-part",
    body: "this is the part before the part nobody likes",
    mood: "bearish",
  },
  {
    id: "never-selling",
    body: "INNO to the moon, i am never selling",
    mood: "moon",
  },
  {
    id: "flat-morning",
    body: "flat all morning and somehow still down on the year",
    mood: "neutral",
  },
  { id: "who-is-buying", body: "who is buying this. actually who", mood: "dump" },
  {
    id: "loading-the-boat",
    body: "loading the boat before the rest wake up",
    mood: "bullish",
  },
  {
    id: "not-you",
    body: "someone is getting out right now and it is not you",
    mood: "bearish",
  },
  {
    id: "generational-bottom",
    body: "generational bottom, mark this post",
    mood: "moon",
  },
  {
    id: "something-has-to",
    body: "at some point something has to happen. right?",
    mood: "neutral",
  },
  {
    id: "ride-down",
    body: "hope everyone enjoyed the ride down",
    mood: "dump",
  },
  {
    id: "mortgaging",
    body: "mortgaging the flat for more of this",
    mood: "moon",
  },
  {
    id: "called-it",
    body: "called it, nobody listened, nobody ever does",
    mood: "bearish",
  },
  {
    id: "admit-it",
    body: "fine. i admit it. this is going up",
    mood: "bullish",
  },
];

/**
 * How many the feed offers at once.
 *
 * Three fits the composer's row at the screen's width and is few enough to read
 * at a glance while the price is moving.
 */
export const SUGGESTIONS_SHOWN = 3;

/**
 * The suggestion behind an id, or undefined when nothing matches.
 *
 * The server resolves the post from this rather than trusting a body and a mood
 * off the wire, which is what stops a client from posting a line of its own with
 * "moon" attached to it.
 */
export function getSuggestion(id: string): Suggestion | undefined {
  return SUGGESTIONS.find((suggestion) => suggestion.id === id);
}

/**
 * `SUGGESTIONS_SHOWN` entries starting at `offset`, wrapping round the pool.
 *
 * An offset rather than a random sample, because the feed renders on the server
 * too and `Math.random()` during a render is a hydration mismatch. Advancing the
 * offset after each post is what rotates the choices.
 */
export function suggestionsAt(offset: number): Suggestion[] {
  return Array.from({ length: SUGGESTIONS_SHOWN }, (_, index) => {
    return SUGGESTIONS[(offset + index) % SUGGESTIONS.length];
  });
}
