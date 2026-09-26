/**
 * Whoever is leaking to the player.
 *
 * `voice` is the prompt context every tip is written from, the job
 * `Persona.bio` does for the crowd. The register is deliberately the opposite
 * of the crowd's: these people are careful, clipped, and do not want to be
 * quoted. That contrast is most of what makes a direct message read as a
 * different kind of message from a public reply.
 */
export type Informant = {
  name: string;
  /** Without the leading @, lowercase, so it can be rendered either way. */
  handle: string;
  voice: string;
};

/**
 * Curated, not generated. Round start already pays for ten sequential persona
 * generations before the player sees anything, and an eleventh would lengthen
 * the loading screen for variation nobody notices — one informant speaks for a
 * whole round.
 */
export const INFORMANTS: readonly Informant[] = [
  {
    name: "nachtschicht",
    handle: "nachtschicht",
    voice:
      "works the night shift on the line, types in lowercase and half-sentences, always in a hurry, never explains context",
  },
  {
    name: "K.",
    handle: "k_from_legal",
    voice:
      "sits in legal, is precise to the point of coldness, uses no word more than needed and never an exclamation",
  },
  {
    name: "after hours",
    handle: "afterhours_j",
    voice:
      "cleans the executive floor at night and simply repeats what was left on the whiteboard, without understanding it",
  },
  {
    name: "not a reuters",
    handle: "notareuters",
    voice:
      "claims a relative on a newsdesk, is smug about being early, and cannot resist implying how well connected they are",
  },
  {
    name: "formerly IR",
    handle: "formerly_ir",
    voice:
      "used to write the investor updates, was let go, and is quietly bitter about everyone still inside",
  },
];

export function pickInformant(random: () => number): Informant {
  return INFORMANTS[Math.floor(random() * INFORMANTS.length)];
}
