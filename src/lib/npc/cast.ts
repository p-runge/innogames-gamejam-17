import "server-only";

import { generate } from "~/lib/llm/client";
import { personaDraftSchema, type Persona } from "~/lib/llm/schemas";
import { FALLBACK_PERSONAS } from "./fallback";
import { PERSONA_SYSTEM, personaPrompt, personaStance } from "./prompts";

/** Accounts in a round's crowd. */
export const CAST_SIZE = 10;

// Pinned to globalThis for the same reason the bus and the market are: `next
// dev` re-evaluates modules on every edit, and the crowd has to survive that.
const globalForCast = globalThis as typeof globalThis & {
  gameCast?: Persona[];
  /** The build in progress, so concurrent callers await one cast, not one each. */
  gameCastBuilding?: Promise<Persona[]>;
};

export function getCast(): Persona[] {
  return globalForCast.gameCast ?? [];
}

/** Test-only, and the hook a future round reset would use. */
export function resetCast(): void {
  globalForCast.gameCast = undefined;
  globalForCast.gameCastBuilding = undefined;
}

/**
 * Trims the underscores the model puts on the ends.
 *
 * The prompt asks it not to and it does anyway: qwen3.5:4b returned
 * "_markuskillsit_" and "_grimy_84_" with the rule stated explicitly. Those pass
 * the schema, so nothing rejects them, but they read as two handles stuck
 * together rather than as an account. Underscores inside the handle are left
 * alone — those are how handles actually look.
 *
 * Returns null when nothing usable is left, so the caller tops up from the
 * curated list rather than inventing something.
 */
function normalizeHandle(handle: string): string | null {
  const trimmed = handle.replace(/^_+/, "").replace(/_+$/, "");
  return trimmed.length >= 3 ? trimmed : null;
}

/** Appends a suffix until the handle is free, staying inside the schema's 15. */
function uniqueHandle(handle: string, taken: Set<string>): string {
  if (!taken.has(handle)) return handle;
  for (let n = 2; n < 100; n++) {
    const suffix = String(n);
    const candidate = handle.slice(0, 15 - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
  // A hundred collisions on one handle means the model is stuck repeating
  // itself; the curated top-up below takes over from here.
  return handle;
}

/**
 * The round's crowd. One request per persona rather than one for all of them: a
 * 4B model does not return a clean array of ten objects, it returns eight good
 * ones and two broken ones. Requests run sequentially behind a fixed system
 * prompt so Ollama's KV cache keeps the shared prefix instead of recomputing it.
 *
 * Cached for the round. Failed generations, refusals and duplicate handles are
 * topped up from the curated list, so the result always holds CAST_SIZE distinct
 * accounts and the caller never has to handle a short cast.
 */
export async function generateCast(): Promise<Persona[]> {
  const cached = globalForCast.gameCast;
  if (cached !== undefined) return cached;

  // Every browser tab starts a round from an effect and reactToTweet asks too,
  // so several callers arrive before the first one has written its result.
  // Without this each of them runs its own ten sequential generations, which on
  // four capped cores slows all of them down, pushes some past the timeout, and
  // lets the last writer overwrite a good cast with one built from fallbacks.
  globalForCast.gameCastBuilding ??= buildCast();
  return globalForCast.gameCastBuilding;
}

async function buildCast(): Promise<Persona[]> {
  const cast: Persona[] = [];
  const taken = new Set<string>();

  for (let index = 0; index < CAST_SIZE; index++) {
    const generated = await generate({
      system: PERSONA_SYSTEM,
      prompt: personaPrompt(index),
      schema: personaDraftSchema,
    });

    if (generated === null) continue;

    const normalized = normalizeHandle(generated.handle);
    if (normalized === null) continue;

    const handle = uniqueHandle(normalized, taken);
    if (taken.has(handle)) continue;

    taken.add(handle);
    // The model wrote the voice; the archetype decides the bias. Combining them
    // here is what keeps the crowd's composition deterministic.
    cast.push({ ...generated, handle, stance: personaStance(index) });
  }

  for (const persona of FALLBACK_PERSONAS) {
    if (cast.length >= CAST_SIZE) break;
    if (taken.has(persona.handle)) continue;
    taken.add(persona.handle);
    cast.push(persona);
  }

  globalForCast.gameCast = cast;
  return cast;
}
