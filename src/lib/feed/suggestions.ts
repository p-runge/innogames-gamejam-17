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
 * The word on the button.
 *
 * The player picks a direction, not a sentence — one word is readable at a
 * glance while the price is moving, where a full line was not. These are how the
 * feeling sounds rather than what the market calls it: the mood names themselves
 * ("bearish", "moon") read as jargon on a button.
 */
export const MOOD_WORD: Record<Mood, string> = {
  dump: "Panic",
  bearish: "Doubt",
  neutral: "Shrug",
  bullish: "Buy",
  moon: "Hype",
};

/**
 * Button order, hardest sell to hardest buy, so the row reads as one dial rather
 * than five unrelated choices.
 */
export const MOOD_ORDER: readonly Mood[] = [
  "dump",
  "bearish",
  "neutral",
  "bullish",
  "moon",
];

/**
 * How many of the five are on offer at once.
 *
 * Three rather than all five is the mechanic: the player works with the hand they
 * are dealt, so pushing the price the way they want is not always available and a
 * round has to be played rather than solved.
 */
export const MOODS_OFFERED = 3;

/**
 * The hand the panel opens with.
 *
 * Authored rather than drawn, because this renders on the server as well and a
 * random opening hand would not survive hydration. It spans the dial — a hard
 * sell, a shrug and a hard buy — so the first click is still a real choice, and
 * every hand after it is drawn.
 */
export const OPENING_MOODS: readonly Mood[] = ["dump", "neutral", "moon"];

/**
 * A fresh hand of `MOODS_OFFERED` distinct moods.
 *
 * A real shuffle, not `sort(() => Math.random() - 0.5)`: that comparator is
 * inconsistent and leaves the result measurably biased toward the original order,
 * which here would mean the same two or three words most of the round.
 *
 * Returned in `MOOD_ORDER` rather than in the order drawn, so the row keeps
 * running sell to buy and the arrows stay in a sane left-to-right progression.
 * Called on click, never during a render.
 */
export function pickMoods(count = MOODS_OFFERED): Mood[] {
  const pool = [...MOOD_ORDER];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const drawn = new Set(pool.slice(0, count));
  return MOOD_ORDER.filter((mood) => drawn.has(mood));
}

/**
 * What each word actually posts.
 *
 * Five lines a mood, so a player leaning on one button does not read their own
 * last sentence back. The voice is deliberately unpolished — this is somebody
 * shouting into a feed from their phone, not copy.
 *
 * Invented, like every account in this game: none of these is advice and none of
 * them is about anything tradable.
 */
export const SUGGESTIONS: readonly Suggestion[] = [
  // Panic
  { id: "every-time", body: "every single time. every time.", mood: "dump" },
  {
    id: "who-is-buying",
    body: "who is buying this. actually who",
    mood: "dump",
  },
  { id: "get-out-now", body: "get out. get out now", mood: "dump" },
  { id: "ride-down", body: "hope everyone enjoyed the ride down", mood: "dump" },
  {
    id: "other-peoples-yachts",
    body: "i am so tired of funding other people's yachts",
    mood: "dump",
  },

  // Doubt
  {
    id: "before-the-part",
    body: "this is the part before the part nobody likes",
    mood: "bearish",
  },
  {
    id: "not-you",
    body: "someone is getting out right now and it is not you",
    mood: "bearish",
  },
  {
    id: "called-it",
    body: "called it, nobody listened, nobody ever does",
    mood: "bearish",
  },
  {
    id: "trap-setup",
    body: "textbook trap setup and you are all walking in",
    mood: "bearish",
  },
  {
    id: "while-the-fund",
    body: "enjoy it while the fund lets you",
    mood: "bearish",
  },

  // Shrug
  { id: "anyone-here", body: "is anyone actually here", mood: "neutral" },
  {
    id: "flat-morning",
    body: "flat all morning and somehow still down on the year",
    mood: "neutral",
  },
  {
    id: "something-has-to",
    body: "at some point something has to happen. right?",
    mood: "neutral",
  },
  { id: "no-idea", body: "no idea. genuinely no idea", mood: "neutral" },
  {
    id: "watching-paint",
    body: "watching paint would pay better",
    mood: "neutral",
  },

  // Buy
  {
    id: "accumulation",
    body: "this is what accumulation looks like",
    mood: "bullish",
  },
  {
    id: "loading-the-boat",
    body: "loading the boat before the rest wake up",
    mood: "bullish",
  },
  {
    id: "admit-it",
    body: "fine. i admit it. this is going up",
    mood: "bullish",
  },
  {
    id: "quietly-buying",
    body: "quietly buying while everyone argues",
    mood: "bullish",
  },
  {
    id: "up-and-right",
    body: "up and to the right, say what you like",
    mood: "bullish",
  },

  // Hype
  {
    id: "all-buy",
    body: "yeah and now all buy, best thing ever",
    mood: "moon",
  },
  {
    id: "never-selling",
    body: "INNO to the moon, i am never selling",
    mood: "moon",
  },
  {
    id: "generational-bottom",
    body: "generational bottom, mark this post",
    mood: "moon",
  },
  {
    id: "mortgaging",
    body: "mortgaging the flat for more of this",
    mood: "moon",
  },
  {
    id: "actually-the-one",
    body: "this is the one. this is actually the one",
    mood: "moon",
  },
];

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
 * A line for the word the player pressed.
 *
 * `exclude` is the id this button posted last time, and it is dropped from the
 * draw rather than retried: pressing Panic twice and getting the same sentence
 * reads as the click not having registered. Only dropped while something else is
 * left to pick, so a single-line mood still works.
 *
 * Random at click time, never during a render — this pool is rendered on the
 * server too, where `Math.random()` is a hydration mismatch.
 */
export function pickForMood(mood: Mood, exclude?: string): Suggestion {
  const lines = SUGGESTIONS.filter((suggestion) => suggestion.mood === mood);
  const pool =
    lines.length > 1
      ? lines.filter((suggestion) => suggestion.id !== exclude)
      : lines;

  return pool[Math.floor(Math.random() * pool.length)];
}
