import { describe, expect, it } from "vitest";
import { joinSeries, mergeCandle } from "./merge";
import type { Candle } from "./types";

function candle(t: number, close: number): Candle {
  return { t, open: close, high: close, low: close, close };
}

describe("mergeCandle", () => {
  it("starts the series from an empty one", () => {
    expect(mergeCandle([], candle(540, 1240))).toEqual([candle(540, 1240)]);
  });

  it("replaces the candle in the same slot", () => {
    const merged = mergeCandle([candle(540, 1240)], candle(540, 1250));
    expect(merged).toHaveLength(1);
    expect(merged[0].close).toBe(1250);
  });

  it("appends a candle in a later slot", () => {
    const merged = mergeCandle([candle(540, 1240)], candle(545, 1250));
    expect(merged.map((c) => c.t)).toEqual([540, 545]);
  });

  it("ignores a candle from a slot already behind the newest", () => {
    // Out-of-order arrivals would otherwise rewrite history behind the newest
    // candle, which the chart reads as the series jumping backwards.
    const series = [candle(540, 1240), candle(545, 1250)];
    expect(mergeCandle(series, candle(540, 9999))).toBe(series);
  });

  it("does not mutate the series it is given", () => {
    const series = [candle(540, 1240)];
    mergeCandle(series, candle(545, 1250));
    expect(series).toHaveLength(1);
  });
});

describe("joinSeries", () => {
  it("returns the live series when there is no snapshot", () => {
    const live = [candle(545, 1250)];
    expect(joinSeries(undefined, live)).toBe(live);
  });

  it("returns the snapshot while no live candle has arrived", () => {
    const history = [candle(540, 1240)];
    expect(joinSeries(history, [])).toBe(history);
  });

  it("keeps the snapshot's history in front of the live stream", () => {
    const history = [candle(540, 1240), candle(545, 1250), candle(550, 1260)];
    const live = [candle(550, 1299), candle(555, 1310)];
    expect(joinSeries(history, live).map((c) => c.t)).toEqual([
      540, 545, 550, 555,
    ]);
  });

  it("lets the live candle win where the two overlap", () => {
    // The snapshot is a moment older than the stream, so in a shared slot the
    // live value is the current one.
    const history = [candle(540, 1240), candle(545, 1250)];
    const live = [candle(545, 1299)];
    const joined = joinSeries(history, live);
    expect(joined).toHaveLength(2);
    expect(joined[1].close).toBe(1299);
  });

  it("drops no history when the live stream starts a fresh slot", () => {
    const history = [candle(540, 1240)];
    const live = [candle(545, 1250)];
    expect(joinSeries(history, live).map((c) => c.t)).toEqual([540, 545]);
  });

  it("returns an empty series when neither side has anything", () => {
    expect(joinSeries(undefined, [])).toEqual([]);
  });

  it("heals a hole once a newer snapshot carries the missing slots", () => {
    // The stream attached late, so its first candle is 550 while the snapshot
    // fetched at connect time only reached 540. Slot 545 exists nowhere yet.
    const live = [candle(550, 1260), candle(555, 1270)];
    expect(joinSeries([candle(540, 1240)], live).map((c) => c.t)).toEqual([
      540, 550, 555,
    ]);

    // A refetch brings a snapshot that does have 545. The hole must close, or a
    // single slow connection leaves a blank column for the whole round.
    const fresh = [
      candle(540, 1240),
      candle(545, 1250),
      candle(550, 1259),
      candle(555, 1269),
    ];
    expect(joinSeries(fresh, live).map((c) => c.t)).toEqual([540, 545, 550, 555]);
  });

  it("fills a gap the live stream itself skipped over", () => {
    // An SSE reconnect past the 100-event bus buffer: the backlog resumes at 630
    // and slots 605 to 625 never arrive on the stream.
    const live = [candle(600, 1300), candle(630, 1280)];
    const snapshot = [
      candle(600, 1300),
      candle(605, 1298),
      candle(610, 1295),
      candle(630, 1280),
    ];
    expect(joinSeries(snapshot, live).map((c) => c.t)).toEqual([
      600, 605, 610, 630,
    ]);
  });

  it("follows the snapshot past a live stream that stopped", () => {
    // The subscription died at 700 but the query still refetches. Showing a
    // price 58 candles stale is the opposite of a shared world.
    const live = [candle(700, 1300)];
    const snapshot = [candle(700, 1300), candle(705, 1310), candle(710, 1320)];
    expect(joinSeries(snapshot, live).map((c) => c.t)).toEqual([700, 705, 710]);
  });

  it("still lets the live candle win in a slot both sides carry", () => {
    // Healing must not cost the live stream its authority: it is newer than any
    // snapshot in a slot they share.
    const live = [candle(545, 1299)];
    const snapshot = [candle(540, 1240), candle(545, 1250)];
    const joined = joinSeries(snapshot, live);
    expect(joined.map((c) => c.t)).toEqual([540, 545]);
    expect(joined[1].close).toBe(1299);
  });
});
