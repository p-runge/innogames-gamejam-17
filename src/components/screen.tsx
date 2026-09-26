"use client";

import BankAccount from "~/components/bank-account";
import CandleChart from "~/components/candle-chart";
import TradeControls from "~/components/trade-controls";
import YFeed from "~/components/y-feed";
import { useMarketFeed } from "~/hooks/use-market-feed";
import { usePortfolio } from "~/hooks/use-portfolio";
import { useYThread } from "~/hooks/use-y-thread";
import { cn } from "~/lib/cn";
import { TRADING_SESSION } from "~/lib/trading-session";

const SYMBOL = "INNO";

/*
  Invented, and not meant to pass for real: the bank does not exist and the IBAN
  is not a valid one.
*/
const BANK = "ASCENDIA BANK";
const IBAN = "DE89 •••• •••• •••• 4412";

/** Ledger rows the account panel has room for. */
const LEDGER_SHOWN = 3;

export default function Screen({ className }: { className: string }) {
  const candles = useMarketFeed();
  const { cash, shares, transactions, trade } = usePortfolio({
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
        Every panel is placed in percentages of the screen rather than of the
        viewport, so they keep their corners and their proportions as the photo
        scales. One gutter runs throughout: 3% of the screen's width, which is
        5.33% of its height because the screen is 16:9. That holds the outer
        margins, the gap between the two stacked panels on the right, and the
        column split — Y takes 47% and ends at 50%, the right column starts at
        53%, so the two are the same 3% apart as everything else.
      */}
      <YFeed
        posts={posts}
        onPost={(body) => post(body, now)}
        className="absolute top-[5.33%] bottom-[5.33%] left-[3%] w-[47%] overflow-hidden rounded-[0.4cqw] border border-terminal-grid"
      />
      <section className="absolute top-[5.33%] right-[3%] flex h-[44%] w-[44%] flex-col overflow-hidden rounded-[0.4cqw] border border-terminal-grid">
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
      </section>
      <BankAccount
        bank={BANK}
        iban={IBAN}
        balance={cash}
        transactions={transactions.slice(0, LEDGER_SHOWN)}
        className="absolute right-[3%] bottom-[5.33%] h-[40%] w-[44%] overflow-hidden rounded-[0.4cqw] border border-terminal-grid"
      />
    </div>
  );
}
