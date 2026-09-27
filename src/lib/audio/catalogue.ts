/**
 * Every sound the game can make, and where it sits in the mix.
 *
 * The files are built by `tools/sounds/build.sh` from the wav recordings that
 * ship in `public/sounds/`: cut to the moment they are used for, levelled to one
 * loudness, and encoded. That build is what makes the numbers below a mix rather
 * than damage control — the recordings differ by 24 LUFS as delivered, so before
 * it every volume here was compensating for its own file and none of them could
 * be compared to each other.
 *
 * Because they are levelled, a volume now means what it says: the player's own
 * actions sit at the front, the market's reactions a step behind them, the
 * trader's idling further back, and the music under all of it.
 *
 * Every effect is the same man — the one whose hands are on the laptop. He is
 * never commentary on the market; he is a person in a chair reacting to his own
 * money, which is why the set is a voice and a keyboard rather than a synth.
 */

/** The loop under the whole game. */
export const MUSIC = {
  src: "/sounds/background-music.mp3",
  /**
   * Far under every effect. The music is the room, and a voice that had to
   * compete with it would have to be mixed loud enough to startle.
   */
  volume: 0.18,
} as const;

export type Sound = {
  src: string;
  /** Against the levelled file, so these compare directly with each other. */
  volume: number;
  /** Shortest pause before this same sound may play again. */
  cooldownMs: number;
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
  | "idle-cough"
  | "round-won"
  | "round-lost";

/** What the player did. Loudest, because it is the answer to a click. */
const ACTION = 0.7;
/** What the market or the informant did. A step back: nobody asked for it. */
const EVENT = 0.55;
/** What the room does when nothing is happening. Furthest back. */
const AMBIENCE = 0.35;

/**
 * The cooldowns are as short as the clip allows for anything the player does on
 * purpose — a trade that made no sound reads as a trade that did not happen —
 * and long for the two reactions nobody asked for, which wear out fast.
 */
export const SOUNDS: Record<SoundId, Sound> = {
  /** He sits down and stretches; the day is starting. */
  "day-start": { src: "/sounds/stretch.mp3", volume: EVENT, cooldownMs: 0 },

  /** Money leaving the account, which is what buying is. */
  "trade-buy": { src: "/sounds/coins.mp3", volume: ACTION, cooldownMs: 400 },

  /** Sold above his own entry: the one unambiguous win the game offers. */
  "sell-profit": { src: "/sounds/victory.mp3", volume: ACTION, cooldownMs: 400 },

  /** Sold below it. A short noise of pain, not a scene. */
  "sell-loss": { src: "/sounds/pain.mp3", volume: ACTION, cooldownMs: 400 },

  /**
   * Him typing the post. Quieter than the other three: it is a texture under an
   * action rather than the sound of the action landing, and the build has to
   * squeeze it through a limiter to get it up to the others at all.
   */
  "feed-post": { src: "/sounds/typing.mp3", volume: 0.5, cooldownMs: 1_200 },

  /** Somebody clearing their throat in the messages dock: psst. */
  "dm-tip": { src: "/sounds/throat-clear.mp3", volume: EVENT, cooldownMs: 1_000 },

  /**
   * The bottom falling out. Long cooldowns on both of these: a move big enough
   * to earn one usually keeps going for a few seconds, and the reaction belongs
   * to the move rather than to each candle inside it.
   */
  "price-crash": { src: "/sounds/scream.mp3", volume: EVENT, cooldownMs: 20_000 },

  /** The room, somewhere, cheering. */
  "price-rally": { src: "/sounds/ovation.mp3", volume: EVENT, cooldownMs: 20_000 },

  /** Nothing has happened for a while and he is bored of his own job. */
  /*
    The two endings, at the front with the player's own actions rather than back
    with the market's: this is the round's verdict on them, it plays once, and
    there is nothing after it to crowd — hence no cooldown either.
  */

  /** He got out with the money. The only unqualified good news in the game. */
  "round-won": { src: "/sounds/ovation.mp3", volume: ACTION, cooldownMs: 0 },

  /** The meter filled, or the bell went while he was still holding. */
  "round-lost": { src: "/sounds/scream.mp3", volume: ACTION, cooldownMs: 0 },

  "idle-yawn": { src: "/sounds/yawn.mp3", volume: AMBIENCE, cooldownMs: 30_000 },
  "idle-cough": { src: "/sounds/cough.mp3", volume: AMBIENCE, cooldownMs: 30_000 },
} as const;
