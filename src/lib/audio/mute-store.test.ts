// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getMuted,
  getServerMuted,
  resetMuted,
  setMuted,
  subscribeToMuted,
} from "./mute-store";

afterEach(() => {
  window.localStorage.clear();
  resetMuted();
  vi.restoreAllMocks();
});

describe("the mute store", () => {
  it("starts unmuted when nothing was stored", () => {
    expect(getMuted()).toBe(false);
  });

  it("remembers a choice across a reload", () => {
    setMuted(true);
    // What a fresh page would do: a new module instance with the same storage.
    resetMuted();

    expect(getMuted()).toBe(true);
  });

  it("tells its subscribers when the choice changes", () => {
    const listener = vi.fn();
    subscribeToMuted(listener);

    setMuted(true);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("stops telling a subscriber that unsubscribed", () => {
    const listener = vi.fn();
    subscribeToMuted(listener)();

    setMuted(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it("renders unmuted on the server, which has nothing to read", () => {
    expect(getServerMuted()).toBe(false);
  });

  it("still answers when storage is blocked", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(getMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
    expect(getMuted()).toBe(true);
  });
});
