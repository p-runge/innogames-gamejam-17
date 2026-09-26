"use client";

import BankAccount, { type BankTransaction } from "~/components/bank-account";
import CandleChart from "~/components/candle-chart";
import { useMarketFeed } from "~/hooks/use-market-feed";
import { cn } from "~/lib/cn";

/*
  Placeholders until the game owns the player's money. Everything here is
  invented — the bank does not exist and the IBAN is not a valid one.
*/
const BANK = "ASCENDIA BANK";
const IBAN = "DE89 •••• •••• •••• 4412";
const BALANCE = 18_450.72;
const TRANSACTIONS: BankTransaction[] = [
  { id: "1", label: "Order · INNO", amount: -4_200 },
  { id: "2", label: "Dividend", amount: 312.5 },
  { id: "3", label: "Brokerage fee", amount: -19.9 },
];

export default function Screen({ className }: { className: string }) {
  const candles = useMarketFeed();

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
      <CandleChart
        symbol="INNO"
        candles={candles}
        className="absolute top-[5.33%] right-[3%] h-[44%] w-[44%] overflow-hidden rounded-[0.4cqw] border border-terminal-grid"
      />
      <BankAccount
        bank={BANK}
        iban={IBAN}
        balance={BALANCE}
        transactions={TRANSACTIONS}
        className="absolute right-[3%] bottom-[5.33%] h-[40%] w-[44%] overflow-hidden rounded-[0.4cqw] border border-terminal-grid"
      />
    </div>
  );
}
