"use client";

import { useCallback, useRef, useState } from "react";

import { euro } from "~/lib/money";

export type TradeSide = "buy" | "sell";

export type LedgerEntry = {
  id: string;
  label: string;
  /** Signed. Negative is money leaving the account. */
  amount: number;
};

type PortfolioOptions = {
  symbol: string;
  startingCash?: number;
  /** Ledger rows kept in memory. The account panel shows the newest few. */
  ledgerLength?: number;
};

/**
 * The player's cash, position and ledger — the one place the trade controls and
 * the bank account agree on. Cash and shares move together in a single update,
 * so the two panels can never disagree about a trade.
 */
export function usePortfolio({
  symbol,
  startingCash = 18_450.72,
  ledgerLength = 12,
}: PortfolioOptions) {
  const [portfolio, setPortfolio] = useState(() => ({
    cash: startingCash,
    shares: 0,
    // Seeded so the account opens with a statement rather than a blank list.
    transactions: [
      { id: "opening", label: "Opening balance", amount: startingCash },
    ] as LedgerEntry[],
  }));

  // Counted outside the updater below, which React may run more than once per
  // call — ids have to come from somewhere that is not re-entered.
  const nextId = useRef(0);

  const trade = useCallback(
    (side: TradeSide, quantity: number, price: number) => {
      const id = `trade-${nextId.current++}`;

      setPortfolio((previous) => {
        const value = quantity * price;

        // The guard lives here rather than only on the buttons: the price moves
        // four times a second, so an order can stop being affordable between
        // the render that enabled the button and the click that fires it.
        if (side === "buy" && value > previous.cash) return previous;
        if (side === "sell" && quantity > previous.shares) return previous;

        const buying = side === "buy";
        const transaction: LedgerEntry = {
          id,
          label: `${buying ? "Buy" : "Sell"} ${quantity} · ${symbol} @ ${euro(price)}`,
          amount: buying ? -value : value,
        };

        return {
          cash: buying ? previous.cash - value : previous.cash + value,
          shares: buying ? previous.shares + quantity : previous.shares - quantity,
          transactions: [transaction, ...previous.transactions].slice(
            0,
            ledgerLength,
          ),
        };
      });
    },
    [ledgerLength, symbol],
  );

  // startingCash comes back out so the portfolio can measure the day against it
  // — it is the only record of where the account opened.
  return { ...portfolio, startingCash, trade };
}
