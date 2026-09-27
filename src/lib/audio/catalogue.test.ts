import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MUSIC, SOUNDS, type SoundId } from "./catalogue";

/** Where a `/sounds/...` src actually sits on disk. */
function asset(src: string): string {
  return fileURLToPath(new URL(`../../../public${src}`, import.meta.url));
}

const entries = Object.entries(SOUNDS) as [SoundId, (typeof SOUNDS)[SoundId]][];

describe("the sound catalogue", () => {
  it("names the music file that is actually there", () => {
    expect(existsSync(asset(MUSIC.src))).toBe(true);
  });

  it.each(entries)("ships the file %s points at", (_id, sound) => {
    expect(existsSync(asset(sound.src))).toBe(true);
  });

  it.each(entries)("keeps %s at an audible volume", (_id, sound) => {
    expect(sound.volume).toBeGreaterThan(0);
    expect(sound.volume).toBeLessThanOrEqual(1);
  });

  it("holds the music under the effects, so a voice is never buried", () => {
    const quietest = Math.min(...entries.map(([, sound]) => sound.volume));

    expect(MUSIC.volume).toBeLessThan(quietest);
  });
});
