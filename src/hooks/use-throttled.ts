"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The latest value, but handed on no more often than `intervalMs`.
 *
 * For readers whose cost is out of proportion to how fast their input changes.
 * The price ticks four times a second; a chart that redraws a hundred marks
 * every one of them is doing four times the work its own candles justify, since
 * a candle only closes every five seconds.
 *
 * Values in between are dropped rather than queued — the newest price is the
 * only one worth drawing, and anything older is already wrong.
 */
export function useThrottled<T>(value: T, intervalMs: number): T {
  const [shown, setShown] = useState(value);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(() => {
    const timer = setInterval(() => {
      // React drops a set to the value already held, so the ticks where nothing
      // arrived cost nothing.
      setShown(latest.current);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return shown;
}
