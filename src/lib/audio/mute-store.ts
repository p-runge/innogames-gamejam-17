/**
 * Whether the game is muted, kept outside React.
 *
 * A store rather than component state, because the answer lives in
 * `localStorage` and has to survive a reload: someone who turned the sound off
 * once should not have to do it again on every page load.
 *
 * Read through `useSyncExternalStore`, which is what keeps the first client
 * render from disagreeing with the server's. The server has no storage to read,
 * so it renders the unmuted icon and React swaps in the stored answer during
 * hydration — reading storage in an initialiser instead would make that a
 * hydration mismatch, and reading it in an effect would be the
 * `set-state-in-effect` shape this project's lint rules refuse.
 */

const KEY = "rise-and-fall:muted";

const listeners = new Set<() => void>();

/**
 * The last known answer. Cached because `getSnapshot` is called on every render
 * and must not touch storage that often — and because storage may be
 * unavailable, in which case the choice still holds for this page's lifetime.
 */
let current: boolean | null = null;

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "true";
  } catch {
    // Private mode, or storage blocked outright. Not being able to remember the
    // choice is no reason to refuse to make one.
    return false;
  }
}

export function getMuted(): boolean {
  current ??= read();
  return current;
}

/** What the server renders. It has nothing to read, so: sound on. */
export function getServerMuted(): boolean {
  return false;
}

export function setMuted(muted: boolean): void {
  current = muted;
  try {
    window.localStorage.setItem(KEY, String(muted));
  } catch {
    // See `read`.
  }
  for (const listener of listeners) listener();
}

export function subscribeToMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: forget the cached answer so each test reads storage afresh. */
export function resetMuted(): void {
  current = null;
}
