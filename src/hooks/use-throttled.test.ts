// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useThrottled } from "./use-throttled";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useThrottled", () => {
  it("shows the first value straight away", () => {
    const { result } = renderHook(() => useThrottled("a", 500));

    expect(result.current).toBe("a");
  });

  it("holds a new value back until the interval comes round", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottled(value, 500),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("b");
  });

  it("skips the values in between", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottled(value, 500),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    rerender({ value: "c" });
    rerender({ value: "d" });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("d");
  });

  it("keeps up with a value that stops changing", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useThrottled(value, 500),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(result.current).toBe("b");
  });

  it("stops its timer when it goes away", () => {
    const { unmount } = renderHook(() => useThrottled("a", 500));
    const pending = vi.getTimerCount();

    unmount();

    expect(vi.getTimerCount()).toBeLessThan(pending);
  });
});
