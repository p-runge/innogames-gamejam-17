import type { Mood } from "~/lib/market/types";

/**
 * What the feed shouts back after the player posts.
 *
 * Keyed by the mood the player just posted in, because these are reactions to that
 * post and nothing else — the crowd is not commenting on the price, it is
 * commenting on you. Nobody here is kind, nobody has a point, and nobody learns
 * anything: the joke is always at the poster's expense, which is the only register
 * this feed has.
 *
 * Cosmetic. Replies never touch the market — the player's own post already carries
 * the impulse, and a reply that moved the price again would double every click.
 *
 * Invented, like every account in this game.
 */

/**
 * How many replies land after one post.
 *
 * One. Two filled the thread faster than the player could read it, and the second
 * mostly scrolled the first out of the way — the joke only lands if it is the only
 * thing that arrived.
 */
export const REPLIES_PER_POST = 1;

/**
 * Gap between the post and its reply.
 *
 * Two seconds: long enough to read as somebody answering rather than as part of the
 * same submit, and still inside the cooldown, so the feed has spoken before the
 * player can post again.
 */
export const REPLY_DELAY_MS = 2_000;

/** The accounts these come from. One is drawn per reply. */
const ACCOUNTS: readonly { name: string; handle: string }[] = [
  { name: "Exit Liquidity", handle: "exitliq" },
  { name: "chart crimes", handle: "chartcrimes" },
  { name: "bagholder", handle: "bags_only" },
  { name: "Margin Mike", handle: "mrgn_mike" },
  { name: "Tanja", handle: "tanja_sells" },
  { name: "not the fund", handle: "notthefund" },
  { name: "paperhands pete", handle: "paper_pete" },
  { name: "Doris", handle: "doris_hodl" },
  { name: "green candle enjoyer", handle: "candle_enjoy" },
  { name: "rug survivor", handle: "rugsurvivor" },
  { name: "Kev", handle: "kev_liquidated" },
  { name: "stop loss enjoyer", handle: "stoploss_fan" },
];

/** Twenty reactions to each kind of post. */
const BODIES: Record<Mood, readonly string[]> = {
  dump: [
    "imagine posting this and still holding",
    "he is cooked and he knows it",
    "screenshotted for the bagholder museum",
    "funniest thing i have read all day",
    "sir this is a trading app",
    "paper hands speedrun, world record",
    "sell then. we are all waiting",
    "condolences to your mum's savings",
    "he panic sold the exact bottom, watch",
    "another one for the liquidation highlight reel",
    "i can hear the margin call through the screen",
    "first time?",
    "typing with one hand, crying with the other",
    "you will be back tomorrow. you always are",
    "this post smells like instant noodles",
    "down bad and posting about it, respect honestly",
    "the chart barely moved, calm down",
    "buying everything he just sold, cheers",
    "he found out what risk means, live",
    "someone check on him. actually do not",
  ],
  bearish: [
    "bear posting again, must be a tuesday",
    "you have said that at every price",
    "cope harder, it is going up",
    "shorted the bottom and posting through it",
    "nobody got rich being this smug",
    "ok doomer",
    "right once and he will not shut up",
    "bookmarking this to laugh at later",
    "your stop loss is showing",
    "sir your bags are showing too",
    "reads like a man who sold too early",
    "keep talking, i am still buying",
    "the trap is you posting instead of trading",
    "every bear was a bull who got scared",
    "you sound like my dad at christmas",
    "cannot wait to screenshot this at the close",
    "wrong, but confidently, which is worse",
    "he is not even in the trade, he just posts",
    "doubt is free. so is being broke",
    "and yet. it goes up",
  ],
  neutral: [
    "riveting content, thank you for this",
    "logged on to post nothing, icon",
    "this is what a flat chart does to a man",
    "same, but i am calling it a strategy",
    "bro is live posting a screensaver",
    "nothing happening is also a position",
    "most honest post on this app",
    "go outside. no? ok",
    "i respect the commitment to boredom",
    "he is not wrong, that is the tragedy",
    "waiting is the trade, apparently",
    "this app when nothing moves: crickets",
    "somebody wake the market up",
    "i have watched paint with more volatility",
    "flat is just up in disguise. right? right",
    "posted this and went straight back to refreshing",
    "stop looking at it then",
    "peak trading. truly",
    "the chart is on life support and so is he",
    "shrugging is underrated honestly",
  ],
  bullish: [
    "he bought. it is over for us",
    "top signal detected",
    "buying because a stranger posted this, thanks",
    "smug already? bold",
    "every bull is one candle from silence",
    "ok but what if it goes down",
    "this aged badly in advance",
    "in you go. good luck soldier",
    "he is early. he is always early",
    "adding too, do not tell anyone",
    "based, possibly broke, but based",
    "the confidence of a man who has not checked",
    "we are all going to make it, probably not",
    "screenshotting this for when it rugs",
    "if he is buying i am buying, no thoughts",
    "finally someone with a spine",
    "the bears are quiet. suspiciously quiet",
    "this is the part where it dumps",
    "he said accumulation like a professional",
    "buying his exit liquidity, cheers",
  ],
  moon: [
    "he has fully lost it and i am here for it",
    "this is the top. this exact post",
    "somebody take his phone",
    "never selling until rent is due",
    "the euphoria stage, live",
    "screenshotted. see you at the bottom",
    "mortgage posting, my favourite genre",
    "one candle away from a life update",
    "selling into whatever he is buying",
    "this is not investing it is a religion",
    "he is going to be so quiet in an hour",
    "diamond hands, wooden brain",
    "up only until it is not",
    "call his mum",
    "the confidence is unearned and i love it",
    "he will tell this story forever, one way or the other",
    "clown market, clown post, clown me for agreeing",
    "this post is the sell signal",
    "he quit his job in his head again",
    "insane. unhinged. buying",
  ],
};

/** One reply, before it is stamped with a clock and an id. */
export type ReplyDraw = {
  /** Stable per line, so the caller can keep one from being drawn twice. */
  lineId: string;
  body: string;
  author: string;
  handle: string;
};

/**
 * A real shuffle, not `sort(() => Math.random() - 0.5)`: that comparator is
 * inconsistent and leaves the result measurably biased toward the original order,
 * which here would mean the same few accounts and lines most of the round.
 */
function shuffled<T>(items: readonly T[]): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * Replies to a post of this mood — distinct lines, from distinct accounts.
 *
 * `exclude` is the lines already used this round, dropped from the draw so the
 * feed does not answer two posts with the same joke. Ignored once it would leave
 * too few to fill the request, because a repeat beats a missing reply.
 *
 * Takes a count even though the game asks for one, so the pool stays the thing that
 * decides what a reply is and the caller stays the thing that decides how many.
 *
 * Random at call time, never during a render.
 */
export function pickReplies(
  mood: Mood,
  count = REPLIES_PER_POST,
  exclude: readonly string[] = [],
): ReplyDraw[] {
  const lines = BODIES[mood].map((body, index) => ({
    lineId: `${mood}-r${index}`,
    body,
  }));

  const fresh = lines.filter((line) => !exclude.includes(line.lineId));
  const pool = fresh.length >= count ? fresh : lines;

  // Accounts drawn together, so asking for more than one never returns the same
  // person talking to themselves.
  const accounts = shuffled(ACCOUNTS).slice(0, count);

  return shuffled(pool)
    .slice(0, count)
    .map((line, index) => ({
      ...line,
      author: accounts[index].name,
      handle: `@${accounts[index].handle}`,
    }));
}
