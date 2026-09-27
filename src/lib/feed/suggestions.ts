import type { Mood } from "~/lib/market/types";

/**
 * One thing the player can post, with the market reading already attached.
 *
 * The mood is authored with the line rather than worked out from the text at
 * runtime. That is the whole reason this shape exists: the price move a post
 * causes is decided by whoever wrote it, so it is predictable in playtesting and
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
 * The player picks a direction, not a sentence — one word is readable at a glance
 * while the price is moving, where a full line was not. These are how the feeling
 * sounds rather than what the market calls it: the mood names themselves
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
 * What each word can post: twenty lines a mood, one drawn at random per press.
 *
 * Twenty is enough that a whole round can be played on one button without coming
 * back round to the same line, which is what the model could not manage — asked
 * twenty times for a panic post it returns twenty rewordings of the same panic
 * post, and the repetition was more noticeable than the flavour was worth.
 *
 * The voice is one trader whose money is all in INNO — the rent, the savings,
 * money they had no business putting in. Not a commentator: every line is spoken
 * from inside the position. All lowercase, fragments, no closing full stop, the
 * feed's own vocabulary, and never a number, a price or a target, because a line
 * with a number in it reads as advice.
 *
 * Invented, like every account in this game: none of it is advice and none of it
 * is about anything tradable.
 */
const BODIES: Record<Mood, readonly string[]> = {
  dump: [
    "every single time. every time.",
    "who is buying this. actually who",
    "get out. get out now",
    "hope everyone enjoyed the ride down",
    "i am so tired of funding other people's yachts",
    "that was the rent. that was actually the rent",
    "bags so heavy i can feel them in my spine",
    "rugged again and i keep coming back for it",
    "margin call incoming, tell my mum i tried",
    "this is what they meant by long term value",
    "liquidated in my own bed, incredible",
    "exit liquidity, party of one",
    "down bad does not even cover it anymore",
    "i have made and lost this much walking to the shop",
    "cooked. properly cooked this time",
    "sold the bike for this. the actual bike",
    "my portfolio is a crime scene",
    "paper hands would have been the smart play",
    "cannot look. looking anyway. worse than i thought",
    "it is over. say it with me. over",
  ],
  bearish: [
    "this is the part before the part nobody likes",
    "someone is getting out right now and it is not you",
    "called it, nobody listened, nobody ever does",
    "textbook trap setup and you are all walking in",
    "enjoy it while the fund lets you",
    "oh now everyone is a genius",
    "buying this is how they get you, again",
    "cannot wait to read the posts at the close",
    "every green candle here is bait",
    "the volume is lying to you",
    "i have seen this exact chart ruin better men",
    "they are distributing and you are celebrating",
    "still holding, which is the embarrassing part",
    "pump it, i will be here when it comes back",
    "dead cat, lovely bounce, same cat",
    "the smart money left before you woke up",
    "nobody rings a bell at the top, apparently",
    "this ends the way it always ends",
    "hopium is not a strategy but here we are",
    "i will be the one saying i told you so",
  ],
  neutral: [
    "is anyone actually here",
    "flat all morning and somehow still down on the year",
    "at some point something has to happen. right?",
    "no idea. genuinely no idea",
    "watching paint would pay better",
    "nothing. absolutely nothing. thrilling",
    "chart has a pulse, barely",
    "my money is stuck in a screensaver",
    "refreshing this like it owes me something",
    "flat is a direction, apparently",
    "bored of holding, too scared to sell",
    "wake me when the candles have opinions",
    "nobody is trading this, we are all just watching",
    "sideways forever, rent due monthly",
    "this is what purgatory charges for",
    "no signal. none. just vibes and silence",
    "i could be outside. i am not, but i could be",
    "the most boring way to lose money",
    "still here. still nothing. still holding",
    "someone please do something, anything",
  ],
  bullish: [
    "this is what accumulation looks like",
    "loading the boat before the rest wake up",
    "fine. i admit it. this is going up",
    "quietly buying while everyone argues",
    "up and to the right, say what you like",
    "green. actual green. i had forgotten",
    "adding here and telling nobody",
    "the doubters are going quiet, i notice",
    "bought the fear, now watch",
    "this is the boring part of getting rich",
    "my bags feel lighter today",
    "rent money working for once",
    "slowly, then all at once. we are at slowly",
    "no notes. just buying",
    "diamond hands were not a joke after all",
    "the chart agrees with me for once",
    "topping up before it gets loud",
    "i was early, not wrong. big difference",
    "let them sell it to me",
    "this is the one i do not sell",
  ],
  moon: [
    "yeah and now all buy, best thing ever",
    "INNO to the moon, i am never selling",
    "generational bottom, mark this post",
    "mortgaging the flat for more of this",
    "this is the one. this is actually the one",
    "we are so back. so unbelievably back",
    "never selling. not one share. ever",
    "i am going to be insufferable about this",
    "rent money? no. moon money",
    "hands of pure diamond, ask anyone",
    "quitting my job in my head right now",
    "this does not stop until i say so",
    "screenshotting this for my grandchildren",
    "everyone who sold is about to be sick",
    "i have never been more right about anything",
    "up only. i do not accept other outcomes",
    "telling my mum it was a good idea after all",
    "remortgaging emotionally as well as financially",
    "this is not financial advice it is prophecy",
    "buy. buy now. thank me at the close",
  ],
};

/**
 * Every line, flattened, with an id derived from its mood and position.
 *
 * Derived rather than hand-written: a hundred literal ids is a hundred chances of
 * a duplicate, and a duplicate would silently resolve to the wrong line's mood on
 * the server and move the price the wrong way.
 *
 * The id is therefore positional — reordering a mood's array renumbers it. That is
 * safe because nothing stores an id beyond the round it was posted in: the client
 * reads them from the same build the server resolves them against.
 */
export const SUGGESTIONS: readonly Suggestion[] = MOOD_ORDER.flatMap((mood) =>
  BODIES[mood].map((body, index) => ({ id: `${mood}-${index}`, body, mood })),
);

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
 * `exclude` is the ids already used this round, dropped from the draw rather than
 * retried: pressing Panic twice and getting the same sentence reads as the click
 * not having registered. With twenty a mood, a round runs out of session before it
 * runs out of lines. Exclusions are ignored once they would leave nothing to pick,
 * because a repeat beats a blank post.
 *
 * Random at click time, never during a render — the buttons are rendered on the
 * server too, where `Math.random()` is a hydration mismatch.
 */
export function pickForMood(
  mood: Mood,
  exclude: readonly string[] = [],
): Suggestion {
  const lines = SUGGESTIONS.filter((suggestion) => suggestion.mood === mood);
  const fresh = lines.filter((line) => !exclude.includes(line.id));
  const pool = fresh.length > 0 ? fresh : lines;

  return pool[Math.floor(Math.random() * pool.length)];
}
