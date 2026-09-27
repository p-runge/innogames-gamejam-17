import type { TipPayload } from "~/lib/news/types";
import type { BandId } from "~/lib/insanity";

/**
 * Messages the player's own head writes.
 *
 * They arrive on the same phone as the informant's, from the same account, in the
 * same register, and nothing ever comes of them. This is the only mechanical lie
 * the Insane-O-Meter tells: the real tips and the impulses armed behind them are
 * untouched, and because the client is never told which real tip pays out, these
 * genuinely cannot be told apart from the ones that do.
 *
 * They obey the informant's own rule, the one `news/prompts.ts` states and
 * `news/templates.ts` keeps to: report the thing you saw, never what it does to
 * the price. A line that named a direction would be the one message a player
 * could discount on sight, and then the whole effect is a party trick.
 *
 * So the tell is not the writing. The tell is that the chart never answers. What
 * makes them feel wrong on a second reading is only that they are about nobody in
 * particular, and that there are suddenly so many of them.
 *
 * Invented, like every account in this game.
 */
const BODIES: readonly string[] = [
  "there were two cars in the yard at four this morning that nobody signed in",
  "somebody from the tenth floor has been down in the plant all week",
  "the friday numbers went out twice, the second time quietly",
  "they changed the locks on the east office over the weekend",
  "the meeting that was in the calendar is not in the calendar any more",
  "same shape as last time. i am telling you, same shape",
  "i saw those three cars again. do not ask me whose they are",
  "the shift supervisor took a call and left in the middle of his shift",
  "nobody has been near line two since tuesday and nobody will say why",
  "there is a courier in reception who will not hand the envelope to anyone but her",
  "you did not hear any of this from me, obviously",
  "forget what i sent before. this is the one that matters",
  "the room went quiet when i walked past it, and it stayed quiet",
  "somebody ordered lunch for twelve into a room booked for four",
  "the cleaners were told to skip the fourth floor tonight",
  "i have heard it twice now, from two people who do not talk to each other",
  "she was in the building on a sunday. in a suit",
  "the second set of books is not a rumour any more",
];

/**
 * How long between invented messages, per band.
 *
 * Absent for the two clear-headed bands, which fabricate nothing. The real
 * informant keeps its own fifty to seventy second schedule throughout, so what
 * shifts is the ratio rather than the amount of truth.
 *
 * Jittered per interval by the caller, the way `MIN_GAP_MS` and `MAX_GAP_MS`
 * already are in the news desk.
 */
export const FABRICATION_GAP_MS: Partial<
  Record<BandId, { min: number; max: number }>
> = {
  feral: { min: 12_000, max: 20_000 },
  gone: { min: 6_000, max: 10_000 },
};

export type Fabrication = {
  /** Shaped exactly like a real tip, because the phone must not be able to tell. */
  tip: TipPayload;
  /**
   * Which line of the pool this was, so a caller can avoid repeating it. Separate
   * from `tip.id`, which is unique per message.
   */
  lineId: string;
};

/**
 * Draw one invented message.
 *
 * `sender` and `handle` are passed in rather than picked here: a fabrication wears
 * the account of the last real tip, so the lie always impersonates somebody the
 * player has already heard from. Before the first real tip there is nobody to
 * impersonate, and the caller fabricates nothing at all.
 *
 * `random` is a parameter so tests can pick a line instead of hoping for one.
 */
export function drawFabrication({
  at,
  sender,
  handle,
  exclude = [],
  random = Math.random,
}: {
  /** The session clock, so it is stamped like a real message. */
  at: number;
  sender: string;
  handle: string;
  /** Line ids already used this round. */
  exclude?: readonly string[];
  random?: () => number;
}): Fabrication {
  const lines = BODIES.map((body, index) => ({
    lineId: `fab-${index}`,
    body,
  }));

  // Falling back to the whole pool rather than going silent: a round long enough
  // to exhaust eighteen lines is one the player is losing badly, and a phone that
  // stopped inventing would read as the distortion having lifted.
  const fresh = lines.filter((line) => !exclude.includes(line.lineId));
  const pool = fresh.length > 0 ? fresh : lines;

  // Clamped, because `random` is injectable and a stub that hands back 1 would
  // otherwise index one past the end.
  const line = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];

  return {
    lineId: line.lineId,
    tip: {
      // `crypto.randomUUID` rather than a counter: this runs in the browser, and
      // two messages sharing an id would collapse into one on the phone.
      id: `fake-${crypto.randomUUID()}`,
      sender,
      handle,
      body: line.body,
      at,
    },
  };
}
