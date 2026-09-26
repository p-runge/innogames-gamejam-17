import { z } from "zod";

/**
 * At least one real word.
 *
 * Length alone does not make a field usable: a real round produced the bio
 * ",,,,,,,,," and the tic "...", both of which validate and then render in the
 * feed as a broken account. Requiring three consecutive letters rejects those
 * while leaving copy that merely starts with punctuation, which is how these
 * accounts often write.
 */
const HAS_A_WORD = /[A-Za-z]{3}/;

/*
  The maxima below are safety nets for the layout, not the way length is
  controlled. Constrained decoding enforces `maxLength` by cutting the string
  the moment it is reached, so a tight bound does not produce a short bio, it
  produces one that stops mid-word: at 120 the model returned "...I'm suing C"
  and "...exit liquidity I'm about to s". The prompts ask for the length that is
  wanted and these leave room to finish the sentence.
*/

export const personaSchema = z.object({
  /**
   * The account's standing bias, declared before the prose for the same reason
   * `mood` leads the reply: the model commits to it first and then writes a bio
   * that fits. Asked after the bio it defaulted to "bull" for four personas in a
   * row, including the one seeded as "lost money and blames the CEO", which
   * leaves a crowd that cheers through a crash.
   *
   * An enum on the profile rather than something inferred per reply, because the
   * market needs a dependable value and a 4B model should not re-invent it.
   */
  stance: z.enum(["bull", "bear", "chaos"]),
  name: z.string().min(1).max(40),
  /** Without the leading @, lowercase, so it can be rendered either way. */
  handle: z.string().regex(/^[a-z0-9_]{3,15}$/),
  /** The personality. This is the prompt context every reply is written from. */
  bio: z.string().min(1).max(200).regex(HAS_A_WORD),
  /**
   * One concrete verbal habit: a pet phrase, a fixed enemy, a tic. Small models
   * repeat the same arguments across personas, and this is the cheapest lever
   * against ten accounts that sound like one.
   */
  tic: z.string().min(1).max(70).regex(HAS_A_WORD),
});

export const replySchema = z.object({
  /**
   * Declared before `body`, and that order matters. Constrained decoding follows
   * the schema's field order, so the model commits to a mood and then writes a
   * reply that fits it. The other way round it writes the reply first and picks
   * a label as an afterthought: measured on qwen3.5:4b, that produced "bullish"
   * for "textbook trap setup, they dump" and for "your cash vaporize into
   * someone else's empire". Since the mood is what moves the price, a mislabel
   * is not cosmetic — it makes a furious post drive the index up.
   *
   * Five labels rather than a number from -1 to 1: small models return 0.8 and
   * 0.75 for the same feeling but pick one of five labels reliably. The mapping
   * to a price impulse lives in `src/lib/market/series.ts`.
   */
  mood: z.enum(["dump", "bearish", "neutral", "bullish", "moon"]),
  body: z.string().min(1).max(320),
});

/**
 * Which way one post argues the price is going.
 *
 * Two labels and no "unclear": a third option is the one a small model reaches
 * for whenever a post is not a slogan, and it would mean the crowd ignores most
 * of what the player writes. A vague post lands on whichever side the model
 * reads into it, which is a fair outcome for a vague post.
 *
 * One field on purpose. The direction is the only thing wanted here, and the
 * whole request stays short enough to answer in a couple of tokens.
 */
export const leanSchema = z.object({
  lean: z.enum(["up", "down"]),
});

export type Lean = z.infer<typeof leanSchema>["lean"];

/**
 * One leaked message from the informant.
 *
 * A single field, and deliberately not the direction: the news desk drew that
 * before the request went out, and asking a 4B model to restate a label it was
 * given is how the label gets lost.
 *
 * The 200 is a layout bound, not how length is controlled; the prompt asks for
 * the length that is wanted and this leaves room to finish the sentence.
 */
export const tipSchema = z.object({
  body: z.string().min(1).max(200).regex(HAS_A_WORD),
});

export type Tip = z.infer<typeof tipSchema>;

/**
 * What the model is actually asked for. `stance` is left out because the model
 * picks it badly: asked for it alongside the prose it defaulted to "bull" for
 * four personas in a row. A caller supplies the stance and combines the two.
 */
export const personaDraftSchema = personaSchema.omit({ stance: true });

export type Persona = z.infer<typeof personaSchema>;
export type PersonaDraft = z.infer<typeof personaDraftSchema>;
export type PersonaStance = Persona["stance"];
export type Reply = z.infer<typeof replySchema>;
