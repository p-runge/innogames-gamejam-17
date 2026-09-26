"use client";

import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "~/lib/cn";
import type { Candle } from "~/lib/market/types";
import { formatClock, sessionSlots } from "~/lib/trading-session";

// Re-exported so the panels keep importing Candle from the component they hand
// it to, while the shape itself lives with the market code that produces it.
export type { Candle };

/*
  ECharts paints into SVG with its own style objects, so the marks cannot wear
  utility classes. These mirror the --color-terminal-* / --color-up / --color-down
  tokens in globals.css, which stay the source of truth for everything that is
  real DOM (the header below, and anything else placed on the screen).
*/
const COLOR = {
  up: "#0ca30c",
  down: "#d03b3b",
  ink: "#ffffff",
  muted: "#898781",
  grid: "#2c2c2a",
} as const;

const MONO = "var(--font-geist-mono), ui-monospace, monospace";

/*
  ECharts sizes its text in px, but this chart lives on a screen that is scaled
  to the viewport, so a fixed label would be oversized on a small window and
  unreadable on a large one. Every size below is authored against this panel
  width and multiplied by the measured one, which keeps the chart's type in
  proportion to the cqw-based type in the header.
*/
const DESIGN_WIDTH = 520;

/*
  Larger than a flat page would want. The panel sits at the top of a screen that
  is rotated away from the camera, so the perspective shrinks it most exactly
  where these labels are.
*/
const LABEL_PT = 8;

const formatPrice = (value: number) => value.toFixed(2);

export default function CandleChart({
  symbol,
  candles,
  className,
}: {
  symbol: string;
  candles: Candle[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ resize: () => void } | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / DESIGN_WIDTH);
      // ReactECharts only listens for window resizes, which misses the case
      // where this box changes size without the viewport doing so.
      chartRef.current?.resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const first = candles.at(0);
  const last = candles.at(-1);
  const change = first && last ? last.close - first.open : 0;
  const changePercent =
    first && first.open !== 0 ? (change / first.open) * 100 : 0;
  const rising = change >= 0;

  const option = useMemo<EChartsOption>(() => {
    const size = (value: number) => Math.round(value * scale);
    const latest = candles.at(-1);
    const latestRising = latest ? latest.close >= latest.open : true;

    // The axis carries every slot in the trading day from the first frame, and
    // slots the session has not reached yet hold ECharts' empty value. That is
    // what keeps the chart still: candles fill it in left to right rather than
    // the window scrolling under them.
    const slots = sessionSlots();
    const bySlot = new Map(candles.map((candle) => [candle.t, candle]));

    return {
      // The feed replaces the option several times a second, and animating each
      // replacement makes the candles slide around instead of tick.
      animation: false,
      backgroundColor: "transparent",
      // The right and bottom gutters hold the price and clock labels, so they
      // track LABEL_PT rather than being fixed.
      grid: {
        left: size(10),
        right: size(LABEL_PT * 5.2),
        top: size(10),
        bottom: size(LABEL_PT * 2.2),
      },
      xAxis: {
        type: "category",
        data: slots,
        // Candles straddle their tick, so the axis needs the half-slot of
        // padding at each end that boundaryGap adds.
        boundaryGap: true,
        axisLine: { lineStyle: { color: COLOR.grid } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: COLOR.muted,
          fontSize: size(LABEL_PT),
          fontFamily: MONO,
          // A label per five-minute slot would be a smear, so the axis is
          // marked on the hour — whatever the slot size happens to be.
          interval: (_: number, value: string) => Number(value) % 60 === 0,
          formatter: (value: string) => formatClock(Number(value)),
        },
        axisPointer: {
          label: {
            backgroundColor: COLOR.grid,
            color: COLOR.ink,
            fontSize: size(LABEL_PT),
            fontFamily: MONO,
            formatter: ({ value }) => formatClock(Number(value)),
          },
        },
      },
      yAxis: {
        // The index never approaches zero, so the axis tracks the data's own
        // range — a zero baseline would flatten every move into a straight line.
        scale: true,
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: COLOR.grid, width: 1 } },
        axisLabel: {
          color: COLOR.muted,
          fontSize: size(LABEL_PT),
          fontFamily: MONO,
          formatter: formatPrice,
        },
        axisPointer: {
          label: {
            backgroundColor: COLOR.grid,
            color: COLOR.ink,
            fontSize: size(LABEL_PT),
            fontFamily: MONO,
            formatter: ({ value }) => formatPrice(Number(value)),
          },
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", lineStyle: { color: COLOR.muted } },
        backgroundColor: "rgba(16,16,19,0.92)",
        borderColor: COLOR.grid,
        borderWidth: 1,
        padding: [size(8), size(10)],
        textStyle: {
          color: COLOR.ink,
          fontSize: size(LABEL_PT),
          fontFamily: MONO,
        },
        formatter: (params) => {
          const point = Array.isArray(params) ? params[0] : params;
          // Read the candle back off our own array rather than out of
          // params.value, whose element order differs from the series data's.
          // Slots the session has not reached yet have none, and show nothing.
          const candle = bySlot.get(slots[point.dataIndex]);
          if (!candle) return "";

          const row = (label: string, value: number) =>
            `<div style="display:flex;justify-content:space-between;gap:${size(16)}px">` +
            `<span style="color:${COLOR.muted}">${label}</span>` +
            `<span style="font-variant-numeric:tabular-nums">${formatPrice(value)}</span>` +
            `</div>`;

          return (
            `<div style="color:${COLOR.muted};margin-bottom:${size(4)}px">${formatClock(candle.t)}</div>` +
            row("O", candle.open) +
            row("H", candle.high) +
            row("L", candle.low) +
            row("C", candle.close)
          );
        },
      },
      series: [
        {
          type: "candlestick",
          data: slots.map((slot) => {
            const candle = bySlot.get(slot);

            // '-' is ECharts' empty value: the slot holds its place on the axis
            // and stays out of the price range, so the y axis doesn't react to
            // a day that hasn't happened yet. Its types only admit the numeric
            // form, hence the cast.
            if (!candle) return "-" as unknown as number[];

            // ECharts reads a candle in this order, which is not OHLC.
            return [candle.open, candle.close, candle.low, candle.high];
          }),
          barMaxWidth: size(14),
          // Hollow up, solid down: the fill carries the direction as well as
          // the hue does, so the chart survives a red/green-colorblind player
          // and the washed-out screen in the photo.
          itemStyle: {
            color: "transparent",
            color0: COLOR.down,
            borderColor: COLOR.up,
            borderColor0: COLOR.down,
            borderWidth: Math.max(1, size(1.5)),
          },
          markLine: {
            symbol: "none",
            animation: false,
            silent: true,
            lineStyle: {
              color: latestRising ? COLOR.up : COLOR.down,
              type: [size(5), size(5)],
              width: 1,
            },
            label: {
              position: "end",
              backgroundColor: latestRising ? COLOR.up : COLOR.down,
              color: COLOR.ink,
              fontSize: size(LABEL_PT),
              fontFamily: MONO,
              padding: [size(3), size(5)],
              borderRadius: size(3),
              formatter: ({ value }) => formatPrice(Number(value)),
            },
            data: latest ? [{ yAxis: latest.close }] : [],
          },
        },
      ],
    };
  }, [candles, scale]);

  return (
    <div
      ref={containerRef}
      /*
        @container makes the header's type scale with the panel rather than with
        whatever the panel is sitting on, so the chart carries its own
        proportions to any corner of the screen it gets placed in.
      */
      className={cn("@container flex flex-col bg-terminal font-mono", className)}
    >
      <header className="flex items-baseline gap-[3cqw] px-[2.5cqw] pt-[2cqw]">
        <span className="text-[2.6cqw] tracking-[0.2em] text-terminal-muted">
          {symbol}
        </span>
        <span className="text-[5cqw] tabular-nums text-white">
          {last ? formatPrice(last.close) : "—"}
        </span>
        {/*
          The arrow and the sign repeat what the color says, so the direction is
          never carried by hue alone.
        */}
        <span
          className={cn(
            "text-[2.6cqw] tabular-nums",
            rising ? "text-up" : "text-down",
          )}
        >
          {rising ? "▲" : "▼"} {rising ? "+" : "−"}
          {formatPrice(Math.abs(change))} ({rising ? "+" : "−"}
          {Math.abs(changePercent).toFixed(2)}%)
        </span>
      </header>
      <ReactECharts
        // SVG rather than canvas: the screen is scaled and rotated in 3D by its
        // parent, and the browser re-rasterizes vector output at the transformed
        // size instead of stretching a bitmap.
        opts={{ renderer: "svg" }}
        option={option}
        lazyUpdate
        onChartReady={(chart: { resize: () => void }) => {
          chartRef.current = chart;
        }}
        className="min-h-0 flex-1"
        // ReactECharts always writes an inline height of 300px, which no
        // utility class can outrank — so this one rule has to be inline.
        style={{ height: "100%", width: "100%" }}
      />
    </div>
  );
}
