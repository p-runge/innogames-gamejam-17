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
   * Must be reached from a click: browsers hold a new audio context suspended
   * until the page has been interacted with, and a loop started on page load
   * would be silently killed on most of them. The Start Game button is that
   * click.
   */
  startMusic: () => void;
  muted: boolean;
  toggleMuted: () => void;
};

const SoundContext = createContext<SoundMachine | null>(null);

/** Everything the machine needs once the browser has let it make sound. */
type Engine = {
  context: AudioContext;
  /** Everything audible passes through here, so mute is one gain. */
  master: GainNode;
  buffers: Map<SoundId, AudioBuffer>;
  music: AudioBuffer | null;
};

/** Where the running loop is kept, so it is started and stopped exactly once. */
type SourceHolder = { current: AudioBufferSourceNode | null };

/**
 * Put the loop on, unless it is already running or its file has not arrived.
 *
 * Outside the component because both the mount effect and the start button call
 * it, and a function redefined per render would either have to be a dependency
 * of an effect that must run once or be left out of one that lints for it.
 */
function startLoop(state: Engine, running: SourceHolder): void {
  if (!state.music || running.current) return;

  const source = state.context.createBufferSource();
  source.buffer = state.music;
  source.loop = true;

  const level = state.context.createGain();
  level.gain.value = MUSIC.volume;

  source.connect(level);
  level.connect(state.master);
  source.start();
  running.current = source;
}

/**
 * The game's sound machine: one background loop and a set of one-shot effects.
 *
 * Built on Web Audio rather than on `Audio` elements. An element decodes its
 * file every time it is played, so the previous version created a decoder per
 * coin — audible as crackle once a few of them overlapped — and could not loop
 * an mp3 without a gap at the seam, because the format carries encoder padding
 * the element plays through. Here every file is decoded once into a buffer;
 * playing it is then a node reading memory, and a looping buffer repeats
 * sample-exactly with nothing in between.
 *
 * It owns the audio graph. Components ask for a sound by name and never touch a
 * node, which is what lets mute be a single gain rather than a prop threaded
 * through the scene.
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
  const engine = useRef<Engine | null>(null);
  /** Whether the round has started, so mute can put the loop back afterwards. */
  const musicWanted = useRef(false);
  const musicSource = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Constructed here rather than on the first click: decoding may take a
    // moment and a suspended context decodes just as well as a running one, so
    // the work is done by the time anything asks for a sound.
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = getMuted() ? 0 : 1;
    master.connect(context.destination);

    const state: Engine = { context, master, buffers: new Map(), music: null };
    engine.current = state;

    let dropped = false;

    const load = async (src: string) => {
      const response = await fetch(src);
      return context.decodeAudioData(await response.arrayBuffer());
    };

    void (async () => {
      const decoded = await Promise.all(
        Object.entries(SOUNDS).map(async ([id, sound]) => {
          try {
            return [id as SoundId, await load(sound.src)] as const;
          } catch (error) {
            // One unreadable file should cost its own sound and nothing else.
            // Silent once the context is gone: closing it mid-decode rejects
            // every request in flight, and `next dev` mounts twice on purpose.
            if (!dropped) console.error("could not decode", sound.src, error);
            return null;
          }
        }),
      );
      if (dropped) return;
      for (const entry of decoded) {
        if (entry) state.buffers.set(entry[0], entry[1]);
      }

      try {
        const music = await load(MUSIC.src);
        if (dropped) return;
        state.music = music;
        // The round can begin before a 40-second file has arrived, so the loop
        // starts itself if it was already asked for.
        if (musicWanted.current) startLoop(state, musicSource);
      } catch (error) {
        if (!dropped) console.error("could not decode", MUSIC.src, error);
      }
    })();

    return () => {
      dropped = true;
      musicSource.current?.stop();
      musicSource.current = null;
      engine.current = null;
      void context.close();
    };
  }, []);

  const play = useCallback(
    (id: SoundId) => {
      // Read through the store rather than closing over `muted`, so this
      // callback keeps its identity when the switch is flipped — the hooks that
      // fire ambient sounds depend on it, and a new identity would restart their
      // timers on every toggle.
      if (getMuted()) return;

      const state = engine.current;
      const sound = SOUNDS[id];
      const buffer = state?.buffers.get(id);
      // Missing only in the seconds before the file has been decoded.
      if (!state || !buffer) return;

      if (!gate.allows(id, sound.cooldownMs, Date.now())) return;

      const source = state.context.createBufferSource();
      source.buffer = buffer;

      // Its own gain, so one sound's place in the mix cannot be heard on the
      // next one — a shared node would have to be re-set on every play and
      // would ride over whatever is still sounding.
      const level = state.context.createGain();
      level.gain.value = sound.volume;

      source.connect(level);
      level.connect(state.master);
      // Nothing holds a reference afterwards: a source node is single-use and
      // disconnects itself when it ends.
      source.onended = () => level.disconnect();
      source.start();
    },
    [gate],
  );

  const startMusic = useCallback(() => {
    musicWanted.current = true;

    const state = engine.current;
    if (!state) return;

    // The click that got here is the gesture the context was waiting for.
    void state.context.resume();
    startLoop(state, musicSource);
  }, []);

  // Mute is one gain on the master, and the loop keeps running behind it. It is
  // a long piece of music: stopping it would mean starting the day over on every
  // toggle, and a buffer source cannot be paused and picked back up.
  useEffect(() => {
    const state = engine.current;
    if (!state) return;

    // Ramped rather than set: an instant jump between two levels is a step in
    // the waveform, which is exactly the click this rewrite is removing.
    const { gain } = state.master;
    const now = state.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.03);
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
