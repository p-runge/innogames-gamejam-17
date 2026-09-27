"use client";

import { useMutation } from "@tanstack/react-query";

import BrowserFrame from "~/components/browser-frame";
import CandleChart from "~/components/candle-chart";
import Distortion from "~/components/distortion";
import { useGameState } from "~/components/game-state-provider";
import { useInsanity } from "~/components/insanity-provider";
import Portfolio from "~/components/portfolio";
import { useSound } from "~/components/sound-provider";
import TradeControls from "~/components/trade-controls";
import YFeed from "~/components/y-feed";
import {
  useIdleSfx,
  useMarketSfx,
  useTipSfx,
} from "~/hooks/use-ambient-sfx";
import { useMarketFeed } from "~/hooks/use-market-feed";
import { usePortfolio } from "~/hooks/use-portfolio";
import { useYThread } from "~/hooks/use-y-thread";
import { TRADING_SESSION } from "~/lib/trading-session";
import { useTRPC } from "~/lib/trpc/client";

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
    // A search rather than a status: there is no subject post to be looking at
    // any more, just the INNO feed.
    url: `y.com/search?q=%24${SYMBOL}`,
    tabTitle: `$${SYMBOL} on Y`,
    favicon: { label: "Y", color: "#1d9bf0" },
  },
  terminal: {
    url: `terminal.inno-exchange.de/${SYMBOL}`,
    tabTitle: `${SYMBOL} · Live index`,
    favicon: { label: "I", color: "#2c2c2a" },
  },
} as const;

/**
 * The game itself: the two windows the player trades in. Mounted by Screen once
 * the round has been started, never before — every hook below attaches to a
 * running session.
 */
export default function GameScene() {
  const trpc = useTRPC();
  const candles = useMarketFeed();
  const { tips, ready } = useGameState();
  const { play } = useSound();
  const { insanity, band, cost } = useInsanity();
  const { cash, shares, transactions, startingCash, avgCost, trade } =
    usePortfolio({ symbol: SYMBOL });

  // The three things that make a sound without anyone pressing for it: the
  // market moving hard, a tip landing, and nothing happening at all.
  useMarketSfx(candles);
  useTipSfx({ count: tips.length, ready });
  useIdleSfx();

  // The post is rendered optimistically, so a failure here costs the broadcast
  // and nothing else. Logged rather than surfaced: a game jam round is more
  // playable with a quiet thread than with an error over the chart.
  const sendTweet = useMutation(
    trpc.tweets.sendTweet.mutationOptions({
      onError: (error) => {
        console.error("sending the tweet failed", error);
      },
    }),
  );

  const { posts, cooling, post } = useYThread({
    /*
      Wrapped rather than handed `sendTweet.mutate` directly, because this is
      where the meter gets charged: `useYThread` swallows a press during the
      cooldown, and charging from the button would bill the player for a post
      that never left.
    */
    publish: (payload) => sendTweet.mutate(payload),
    cooldownMs: band.cooldownMs,
    replies: band.replies,
  });

  const latest = candles.at(-1);
  // Orders fill at the forming candle's close, which is the live price.
  const price = latest?.close;
  // Posts are stamped with the session clock, so they sit on the same timeline
  // as the candles rather than on the player's wall clock.
  const now = latest?.t ?? TRADING_SESSION.openMinutes;

  return (
    <div className="relative h-full w-full">
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
          cooling={cooling}
          insanity={insanity}
          band={band}
          costFor={cost}
          onPost={(mood) => {
            post(mood, now);
            play("feed-post");
          }}
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
                if (price === undefined) return;
                trade(side, quantity, price);
                // Buying is money leaving; selling is the moment he finds out
                // whether the position was worth holding.
                play(
                  side === "buy"
                    ? "trade-buy"
                    : price >= avgCost
                      ? "sell-profit"
                      : "sell-loss",
                );
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
      <Distortion band={band} />
    </div>
  );
}
