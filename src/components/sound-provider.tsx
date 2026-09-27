"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { MUSIC, SOUNDS, type SoundId } from "~/lib/audio/catalogue";
import { createPlayGate } from "~/lib/audio/gate";
import {
  getMuted,
  getServerMuted,
  setMuted,
  subscribeToMuted,
} from "~/lib/audio/mute-store";

type SoundMachine = {
  /** Play one effect, subject to mute and to the gate. */
  play: (id: SoundId) => void;
  /**
   * Start the background loop.
   *
   * Must be reached from a click: browsers refuse audio until the page has been
   * interacted with, and a loop started on page load would be silently killed
   * on most of them. The Start Game button is that click.
   */
  startMusic: () => void;
  muted: boolean;
  toggleMuted: () => void;
};

const SoundContext = createContext<SoundMachine | null>(null);

/**
 * The game's sound machine: one background loop and a set of one-shot effects.
 *
 * It owns every `HTMLAudioElement` on the page. Components ask for a sound by
 * name and never touch an element, which is what lets mute be a single switch
 * rather than a prop threaded through the scene.
 */
export default function SoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const muted = useSyncExternalStore(
    subscribeToMuted,
    getMuted,
    getServerMuted,
  );

  const gate = useMemo(() => createPlayGate(), []);

  /**
   * One preloaded element per effect, cloned at play time.
   *
   * Preloaded because the first buy must not be the moment the file starts
   * downloading, and cloned because restarting a single element cuts off the
   * copy already playing — two coins landing a moment apart should overlap.
   */
  const templates = useRef(new Map<SoundId, HTMLAudioElement>());

  /** Timers that cut long clips short; cleared on unmount so none outlive the page. */
  const trims = useRef(new Set<number>());

  const music = useRef<HTMLAudioElement | null>(null);
  /** Whether the round has started. Mute pauses the loop; this says to resume it. */
  const musicWanted = useRef(false);

  useEffect(() => {
    const loaded = templates.current;

    for (const [id, sound] of Object.entries(SOUNDS)) {
      const audio = new Audio(sound.src);
      audio.preload = "auto";
      loaded.set(id as SoundId, audio);
    }

    const timers = trims.current;

    return () => {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      loaded.clear();
      music.current?.pause();
    };
  }, []);

  const play = useCallback(
    (id: SoundId) => {
      // Read through the store rather than closing over `muted`, so this
      // callback keeps its identity when the switch is flipped — the hooks that
      // fire ambient sounds depend on it, and a new identity would restart their
      // timers on every toggle.
      if (getMuted()) return;

      const sound = SOUNDS[id];
      if (!gate.allows(id, sound.cooldownMs, Date.now())) return;

      const template = templates.current.get(id);
      const node =
        (template?.cloneNode() as HTMLAudioElement | undefined) ??
        new Audio(sound.src);
      node.volume = sound.volume;

      // Rejects when the browser has not seen a gesture yet, which is a sound
      // that was never going to be heard rather than a fault to report.
      void node.play().catch(() => {});

      if (sound.maxMs !== undefined) {
        const timer = window.setTimeout(() => {
          node.pause();
          trims.current.delete(timer);
        }, sound.maxMs);
        trims.current.add(timer);
      }
    },
    [gate],
  );

  const startMusic = useCallback(() => {
    musicWanted.current = true;

    music.current ??= Object.assign(new Audio(MUSIC.src), {
      loop: true,
      volume: MUSIC.volume,
    });

    if (getMuted()) return;
    void music.current.play().catch(() => {});
  }, []);

  // The loop is the one sound that survives being muted — it is paused and
  // resumed rather than stopped, so unmuting mid-round does not restart the day.
  useEffect(() => {
    const audio = music.current;
    if (!audio) return;

    if (muted) audio.pause();
    else if (musicWanted.current) void audio.play().catch(() => {});
  }, [muted]);

  const toggleMuted = useCallback(() => setMuted(!getMuted()), []);

  const value = useMemo(
    () => ({ play, startMusic, muted, toggleMuted }),
    [play, startMusic, muted, toggleMuted],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundMachine {
  const machine = useContext(SoundContext);
  if (machine === null) {
    throw new Error("useSound must be used inside SoundProvider");
  }
  return machine;
}
