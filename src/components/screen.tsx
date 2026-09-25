"use client";

import CandleChart from "~/components/candle-chart";
import { useMarketFeed } from "~/hooks/use-market-feed";
import { cn } from "~/lib/cn";

export default function Screen({ className }: { className: string }) {
  const candles = useMarketFeed();

  return (
    <div className={cn("relative h-full w-full bg-terminal", className)}>
      {/*
        Placed in percentages of the screen rather than of the viewport, so the
        panel keeps its corner and its proportions as the photo scales. The
        offsets are equal in both axes as a share of the screen's width, which
        is why the top one is the larger number — the screen is 16:9.
      */}
      <CandleChart
        symbol="INNO"
        candles={candles}
        className="absolute top-[5.33%] right-[3%] h-[44%] w-[44%] overflow-hidden rounded-[0.4cqw] border border-terminal-grid"
      />
    </div>
  );
}
