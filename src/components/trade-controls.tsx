"use client";

import { useState } from "react";

import type { TradeSide } from "~/hooks/use-portfolio";
import { cn } from "~/lib/cn";
import { euro } from "~/lib/money";

const SIDES: TradeSide[] = ["buy", "sell"];

/**
 * The order ticket under the chart: a buy/sell switch that decides what the
 * three size buttons do. Holding the side in a switch rather than doubling the
 * buttons keeps one row of controls and makes the current mode unmistakable —
 * which matters when the thing being clicked spends the player's money.
 */
export default function TradeControls({
  symbol,
  price,
  cash,
  shares,
  quantities = [1, 5, 25],
  onTrade,
  className,
}: {
  symbol: string;
  /** The latest close. Undefined before the first candle exists. */
  price: number | undefined;
  cash: number;
  shares: number;
  quantities?: number[];
  onTrade: (side: TradeSide, quantity: number) => void;
  className?: string;
}) {
  const [side, setSide] = useState<TradeSide>("buy");

  const buying = side === "buy";
  const canTrade = (quantity: number) =>
    price !== undefined &&
    (buying ? quantity * price <= cash : quantity <= shares);

  return (
    <div
      className={cn(
        "@container flex items-center gap-[2.5cqw] bg-terminal px-[2.5cqw] py-[2cqw] font-mono",
        className,
      )}
    >
      <div
        role="group"
        aria-label="Order side"
        className="flex overflow-hidden rounded-[0.8cqw] border border-terminal-grid text-[2.4cqw]"
      >
        {SIDES.map((option) => {
          const selected = option === side;

          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setSide(option)}
              className={cn(
                "px-[3cqw] py-[1cqw] tracking-[0.15em] uppercase",
                !selected && "text-terminal-muted hover:text-white",
                // Green for buy and red for sell is the same direction language
                // the candles and the ledger use; the label says which it is,
                // so the color is never the only thing carrying it.
                selected && (option === "buy" ? "bg-up" : "bg-down"),
                selected && "text-white",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="flex gap-[1.6cqw]">
        {quantities.map((quantity) => (
          <button
            key={quantity}
            type="button"
            disabled={!canTrade(quantity)}
            /*
              The visible label is only a number, so the accessible name has to
              carry the verb — and it changes with the switch.
            */
            aria-label={`${buying ? "Buy" : "Sell"} ${quantity} ${symbol}`}
            onClick={() => onTrade(side, quantity)}
            className={cn(
              "rounded-[0.8cqw] border border-terminal-grid px-[3cqw] py-[1cqw] text-[2.4cqw] tabular-nums text-white",
              "enabled:hover:border-white disabled:opacity-30",
            )}
          >
            {quantity}
          </button>
        ))}
      </div>

      <div className="ml-auto text-right text-[2.2cqw] text-terminal-muted">
        Position{" "}
        <span className="tabular-nums text-white">
          {shares}
          {price !== undefined && ` · ${euro(shares * price)}`}
        </span>
      </div>
    </div>
  );
}
