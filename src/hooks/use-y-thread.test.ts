// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TRADING_SESSION } from "~/lib/trading-session";
import { useYThread } from "./use-y-thread";

const AT = TRADING_SESSION.openMinutes + 15;

describe("useYThread", () => {
  it("sends the player's post to the server", () => {
    const publish = vi.fn();
    const { result } = renderHook(() => useYThread({ replies: [], publish }));

    act(() => result.current.post("inno is done", AT));

    expect(publish).toHaveBeenCalledWith({
      username: "You",
      message: "inno is done",
    });
  });

  it("sends the display name, not the handle", () => {
    const publish = vi.fn();
    const { result } = renderHook(() =>
      useYThread({
        replies: [],
        publish,
        author: "Chartbreaker",
        handle: "@chartbreaker",
      }),
    );

    act(() => result.current.post("still holding", AT));

    expect(publish.mock.calls[0][0].username).toBe("Chartbreaker");
  });

  it("does not send a post with nothing in it", () => {
    const publish = vi.fn();
    const { result } = renderHook(() => useYThread({ replies: [], publish }));

    act(() => result.current.post("   ", AT));

    expect(publish).not.toHaveBeenCalled();
  });

  it("still shows the post in the thread without waiting for the server", () => {
    const { result } = renderHook(() =>
      useYThread({ replies: [], publish: vi.fn() }),
    );

    act(() => result.current.post("inno is done", AT));

    expect(result.current.posts.map((post) => post.body)).toContain(
      "inno is done",
    );
  });
})
