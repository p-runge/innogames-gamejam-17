"use client";

import BrowserFrame from "~/components/browser-frame";
import CandleChart from "~/components/candle-chart";
import Portfolio from "~/components/portfolio";
import TradeControls from "~/components/trade-controls";
import YFeed from "~/components/y-feed";
import { useMarketFeed } from "~/hooks/use-market-feed";
import { usePortfolio } from "~/hooks/use-portfolio";
import { useYThread } from "~/hooks/use-y-thread";
import { cn } from "~/lib/cn";
import { TRADING_SESSION } from "~/lib/trading-session";

const SYMBOL = "INNO";

/** Invented, and not meant to pass for real. */
const ACCOUNT = "•••• 4412";

/*
  Ledger rows the portfolio has room for. Its height is fixed, so this only
  decides how much of the space is used — passing more than fits clips instead of
  pushing the chart around.
*/
const LEDGER_SHOWN = 6;

/*
  One tab per window. The favicon colors are picked to stay clear of the up/down
  green and red, which mean a direction everywhere else on this screen.
*/
const SITES = {
  y: {
    url: "y.com/whisper/status/1840022",
    tabTitle: "Market Whisper on Y: “Something is happening…”",
    favicon: { label: "Y", color: "#1d9bf0" },
  },
  terminal: {
    url: `terminal.inno-exchange.de/${SYMBOL}`,
    tabTitle: `${SYMBOL} · Live index`,
    favicon: { label: "I", color: "#2c2c2a" },
  },
} as const;

export default function Screen({ className }: { className: string }) {
  const candles = useMarketFeed();
  const { cash, shares, transactions, startingCash, trade } = usePortfolio({
    symbol: SYMBOL,
  });
  const { posts, post } = useYThread();

  const latest = candles.at(-1);
  // Orders fill at the forming candle's close, which is the live price.
  const price = latest?.close;
  // Posts are stamped with the session clock, so they sit on the same timeline
  // as the candles rather than on the player's wall clock.
  const now = latest?.t ?? TRADING_SESSION.openMinutes;

  return (
    <div className={cn("relative h-full w-full bg-terminal", className)}>
      {/*
        Two windows tile the display, half and half, each running edge to edge:
        no margins, no rounded corners, no desktop showing through. The only
        seam is the hairline where they meet.

        The right window is one page — chart, order ticket and portfolio stacked
        down it — so the chart takes what the other two leave rather than being
        given a share of the height.
      */}
      <BrowserFrame
        {...SITES.y}
        className="absolute inset-y-0 left-0 w-1/2 overflow-hidden border-r border-terminal-grid"
      >
        <YFeed
          posts={posts}
          onPost={(body) => post(body, now)}
          className="h-full w-full"
        />
      </BrowserFrame>
      <BrowserFrame
        {...SITES.terminal}
        className="absolute inset-y-0 right-0 w-1/2 overflow-hidden"
      >
        <div className="flex h-full w-full flex-col">
          {/*
            The chart and its ticket share the top half; the portfolio holds the
            bottom half at a fixed h-1/2. Sizing the portfolio to its content was
            what made the chart jump on every order — the ledger grows from one
            row to several, and the chart gave up the difference.
          */}
          <div className="flex min-h-0 flex-1 flex-col">
            <CandleChart
              symbol={SYMBOL}
              candles={candles}
              className="min-h-0 flex-1"
            />
            <TradeControls
              symbol={SYMBOL}
              price={price}
              cash={cash}
              shares={shares}
              onTrade={(side, quantity) => {
                if (price !== undefined) trade(side, quantity, price);
              }}
              className="border-t border-terminal-grid"
            />
          </div>
          <Portfolio
            symbol={SYMBOL}
            account={ACCOUNT}
            cash={cash}
            shares={shares}
            price={price}
            startingCash={startingCash}
            activity={transactions.slice(0, LEDGER_SHOWN)}
            className="h-1/2 shrink-0 border-t border-terminal-grid"
          />
        </div>
      </BrowserFrame>
    </div>
  );
}
