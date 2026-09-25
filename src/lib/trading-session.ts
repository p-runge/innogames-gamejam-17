/**
 * The in-game trading day. The x axis is fixed to this whole span from the
 * first frame, so candles fill the chart left to right instead of scrolling.
 *
 * Two clocks run at once: a candle closes every `realSecondsPerCandle` seconds
 * of wall time but covers `minutesPerCandle` minutes of the in-game clock, so
 * the session below plays out in `slotCount * realSecondsPerCandle` seconds —
 * 8.5 minutes at these numbers. Stretch the round by raising minutesPerCandle
 * (fewer, coarser candles) or realSecondsPerCandle (the same candles, slower).
 */
export const TRADING_SESSION = {
  /** 09:00, in minutes since midnight. */
  openMinutes: 9 * 60,
  /** 17:30, in minutes since midnight. */
  closeMinutes: 17 * 60 + 30,
  minutesPerCandle: 5,
  realSecondsPerCandle: 5,
} as const;

/** Every candle slot in the session, as in-game minutes since midnight. */
export function sessionSlots() {
  const { openMinutes, closeMinutes, minutesPerCandle } = TRADING_SESSION;
  const count = Math.floor((closeMinutes - openMinutes) / minutesPerCandle);

  return Array.from(
    { length: count },
    (_, index) => openMinutes + index * minutesPerCandle,
  );
}

/** Minutes since midnight as a wall clock reading, e.g. 555 -> "9:15". */
export function formatClock(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.floor(minutes % 60);

  return `${hours}:${String(rest).padStart(2, "0")}`;
}
