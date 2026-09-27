/**
 * Every sound the game can make, and how loud.
 *
 * The files are mp3 rather than the wav originals they were cut from: the
 * background loop alone is 7.5 MB as wav and 0.6 MB encoded, and all of this is
 * fetched before it is first needed so a trigger is never late. The wavs stay in
 * `public/sounds/` as the source material.
 *
 * Every effect is the same man — the one whose hands are on the laptop. He is
 * never commentary on the market; he is a person in a chair reacting to his own
 * money, which is why the set is a voice and a keyboard rather than a synth.
 */

/** The loop under the whole game. */
export const MUSIC = {
  src: "/sounds/background-music.mp3",
  /**
   * Well under every effect. The music is the room, and a voice that had to
   * compete with it would have to be mixed loud enough to startle.
   */
  volume: 0.22,
} as const;

export type Sound = {
  src: string;
  volume: number;
  /** Shortest pause before this same sound may play again. */
  cooldownMs: number;
  /**
   * Cut the clip off after this long. Some of the source recordings run far past
   * the moment they are being used for — the typing goes on for eleven seconds,
   * which is a man writing an essay rather than firing off a post.
   */
  maxMs?: number;
};

export type SoundId =
  | "day-start"
  | "trade-buy"
  | "sell-profit"
  | "sell-loss"
  | "feed-post"
  | "dm-tip"
  | "price-crash"
  | "price-rally"
  | "idle-yawn"
  | "idle-cough";

/**
 * The cooldowns are as short as the clip allows for anything the player does on
 * purpose — a trade that made no sound reads as a trade that did not happen —
 * and long for the two reactions nobody asked for, which are atmosphere and wear
 * out fast.
 */
export const SOUNDS: Record<SoundId, Sound> = {
  /** He sits down and stretches; the day is starting. */
  "day-start": { src: "/sounds/stretch.mp3", volume: 0.45, cooldownMs: 0 },

  /** Money leaving the account, which is what buying is. */
  "trade-buy": { src: "/sounds/coins.mp3", volume: 0.55, cooldownMs: 400 },

  /** Sold above his own entry: the one unambiguous win the game offers. */
  "sell-profit": { src: "/sounds/victory.mp3", volume: 0.5, cooldownMs: 400 },

  /** Sold below it. A short noise of pain, not a scene. */
  "sell-loss": { src: "/sounds/pain.mp3", volume: 0.5, cooldownMs: 400 },

  /** Him typing the post, cut to about the length of one line. */
  "feed-post": {
    src: "/sounds/typing.mp3",
    volume: 0.35,
    cooldownMs: 1_200,
    maxMs: 1_200,
  },

  /** Somebody clearing their throat in the messages dock: psst. */
  "dm-tip": { src: "/sounds/throat-clear.mp3", volume: 0.45, cooldownMs: 1_000 },

  /**
   * The bottom falling out. Long cooldowns on both of these: a move big enough
   * to earn one usually keeps going for a few seconds, and the reaction belongs
   * to the move rather than to each candle inside it.
   */
  "price-crash": { src: "/sounds/scream.mp3", volume: 0.4, cooldownMs: 20_000 },

  /** The room, somewhere, cheering. Trimmed before the applause thins out. */
  "price-rally": {
    src: "/sounds/ovation.mp3",
    volume: 0.4,
    cooldownMs: 20_000,
    maxMs: 3_000,
  },

  /** Nothing has happened for a while and he is bored of his own job. */
  "idle-yawn": { src: "/sounds/yawn.mp3", volume: 0.38, cooldownMs: 30_000 },
  "idle-cough": { src: "/sounds/cough.mp3", volume: 0.38, cooldownMs: 30_000 },
} as const;
