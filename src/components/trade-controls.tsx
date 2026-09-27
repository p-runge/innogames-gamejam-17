"use client";

import type { TradeSide } from "~/hooks/use-portfolio";
import { cn } from "~/lib/cn";
import { euro } from "~/lib/money";

const SIDES: TradeSide[] = ["buy", "sell"];

/** Every order is one share. The ticket has no size to choose any more. */
const TRADE_SIZE = 1;

/**
 * The order ticket under the chart: buy one, or sell one.
 *
 * The switch and the three size buttons it fed are both gone. They asked for two
 * decisions — a direction and an amount — where the game only ever wanted the
 * first, and the amount was the one being made with the least thought while the
 * price was moving. Each button now is the whole order.
 *
 * A position is built by pressing one of them repeatedly, which is also what makes
 * the cost of a position something the player feels rather than types.
 */
export default function TradeControls({
  symbol,
  price,
  cash,
  shares,
  onTrade,
  className,
}: {
  symbol: string;
  /** The latest close. Undefined before the first candle exists. */
  price: number | undefined;
  cash: number;
  shares: number;
  onTrade: (side: TradeSide, quantity: number) => void;
  className?: string;
}) {
  const canTrade = (side: TradeSide) =>
    price !== undefined &&
    (side === "buy" ? TRADE_SIZE * price <= cash : TRADE_SIZE <= shares);

  return (
    <div
      className={cn(
        "@container flex items-center gap-[2.5cqw] bg-terminal px-[2.5cqw] py-[2cqw] font-mono",
        className,
      )}
    >
      {/*
        shrink-0, and it is load-bearing. A flex child may shrink below its
        content width by default, and the readout sharing this row grows and
        shrinks four times a second as the price ticks — every time its euro
        string changes length, the space left for these two changes with it, and
        the buttons were being squeezed a hair narrower and let back out again.

        It looks like a hover effect because the cursor is sitting on them when it
        happens. It is not one, and nothing here transforms: the row is simply
        being re-divided under them.
      */}
      <div
        role="group"
        aria-label="Order"
        className="flex shrink-0 gap-[1.6cqw]"
      >
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            disabled={!canTrade(side)}
            /*
              The visible label is only the verb, so the accessible name carries
              the size and the symbol the verb is about.
            */
            aria-label={`${side === "buy" ? "Buy" : "Sell"} ${TRADE_SIZE} ${symbol}`}
            onClick={() => onTrade(side, TRADE_SIZE)}
            className={cn(
              // shrink-0 again on each button, for the same reason as the group
              // around them: whatever width the row hands this pair, the two of
              // them keep the width their own padding and label ask for.
              "shrink-0 rounded-[0.8cqw] px-[4cqw] py-[1cqw] text-[2.4cqw] text-white uppercase",
              // Green for buy and red for sell is the same direction language the
              // candles and the ledger use; the word says which it is, so the
              // color is never the only thing carrying it.
              //
              // Worn permanently now rather than only while selected. These are
              // two actions, not two settings — there is no longer a state where
              // one of them is the chosen one and the other is waiting.
              /*
                Hover darkens the fill and does nothing else.

                Two earlier attempts at it both read as the button changing size,
                for different reasons. A brightness filter promotes the button to
                its own compositing layer, and at the fractional pixel positions
                these cqw paddings land on, re-rasterising there can hand an edge
                back a pixel wider or narrower than it was. An inset ring keeps
                the geometry but paints a white rim inside the border box, which
                takes a bite out of the colored area and reads as a shrink.

                Background alpha does neither. It changes one paint value on a
                layer that already exists, and the colored rectangle stays exactly
                where it was.
              */
              side === "buy"
                ? "bg-up enabled:hover:bg-up/80"
                : "bg-down enabled:hover:bg-down/80",
              "disabled:opacity-30",
            )}
          >
            {side}
          </button>
        ))}
      </div>

      {/*
        whitespace-nowrap, because this string changes length four times a second
        as the price ticks and it is the only thing in the row long enough to
        wrap. A wrap adds a second line, the bar gets taller, and the chart above
        gives up the height — the whole ticket appears to resize on its own.
      */}
      <div className="ml-auto text-right text-[2.2cqw] whitespace-nowrap text-terminal-muted">
        Position{" "}
        <span className="tabular-nums text-white">
          {shares}
          {price !== undefined && ` · ${euro(shares * price)}`}
        </span>
      </div>
    </div>
  );
}
