"use client";

import BankAccount from "~/components/bank-account";
import CandleChart from "~/components/candle-chart";
import TradeControls from "~/components/trade-controls";
import { useMarketFeed } from "~/hooks/use-market-feed";
import { usePortfolio } from "~/hooks/use-portfolio";
import { cn } from "~/lib/cn";

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

  // Orders fill at the forming candle's close, which is the live price.
  const price = candles.at(-1)?.close;

  return (
    <div className={cn("relative h-full w-full bg-terminal", className)}>
      {/*
        Both panels are placed in percentages of the screen rather than of the
        viewport, so they keep their corners and their proportions as the photo
        scales. Every gutter is the same 3% of the screen's width — which is
        5.33% of its height, the screen being 16:9 — so the margin above the
        chart, the gap between the panels and the margin below the account all
        measure the same on the glass.
      */}
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
