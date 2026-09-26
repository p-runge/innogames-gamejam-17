import type { LedgerEntry } from "~/hooks/use-portfolio";
import { cn } from "~/lib/cn";
import { euro, signedEuro } from "~/lib/money";

function Stat({ label, children }: { label: string; children: string }) {
  return (
    <div>
      <dt className="text-[2cqw] tracking-[0.12em] text-terminal-muted">
        {label}
      </dt>
      <dd className="mt-[0.4cqw] text-[2.6cqw] tabular-nums text-white">
        {children}
      </dd>
    </div>
  );
}

/**
 * The trading account, below the chart it trades. Cash, position and what the
 * two are worth together — plus the day measured against where the account
 * opened, which is the only number here that says whether any of it worked.
 */
export default function Portfolio({
  symbol,
  account,
  cash,
  shares,
  price,
  startingCash,
  activity,
  className,
}: {
  symbol: string;
  /** Already masked. This component does not shorten it. */
  account: string;
  cash: number;
  shares: number;
  /** The latest close. Undefined before the first candle exists. */
  price: number | undefined;
  startingCash: number;
  activity: LedgerEntry[];
  className?: string;
}) {
  const positionValue = shares * (price ?? 0);
  const accountValue = cash + positionValue;

  /*
    Against the opening cash rather than against a cost basis: the account has
    no record of what any individual lot was bought at, so this is the day's
    result for the whole account, not per-position P&L.
  */
  const change = accountValue - startingCash;
  const changePercent = startingCash === 0 ? 0 : (change / startingCash) * 100;
  const rising = change >= 0;

  return (
    <section
      className={cn(
        "@container flex flex-col gap-[2cqw] bg-terminal px-[2.5cqw] py-[2.2cqw] font-mono",
        className,
      )}
    >
      <header className="flex items-baseline justify-between text-[2.2cqw] text-terminal-muted">
        <h2 className="tracking-[0.2em]">PORTFOLIO</h2>
        <span className="tabular-nums">{account}</span>
      </header>

      <div className="flex items-end justify-between gap-[3cqw]">
        <div>
          <div className="text-[2cqw] tracking-[0.12em] text-terminal-muted">
            Account value
          </div>
          {/*
            A quantity, so it wears plain ink — the direction lives in the delta
            beside it, where green and red mean what they mean everywhere else.
          */}
          <div className="text-[5cqw] tabular-nums text-white">
            {euro(accountValue)}
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 text-[2.4cqw] tabular-nums",
            rising ? "text-up" : "text-down",
          )}
        >
          {rising ? "▲" : "▼"} {signedEuro(change)} ({rising ? "+" : "−"}
          {Math.abs(changePercent).toFixed(2)}%)
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-[2cqw] border-t border-terminal-grid pt-[2cqw]">
        {/* The player's word for it, and still the right one: this is the cash leg. */}
        <Stat label="Saldo">{euro(cash)}</Stat>
        <Stat label="Position">{`${shares} ${symbol}`}</Stat>
        <Stat label="Market value">{euro(positionValue)}</Stat>
      </dl>

      {/*
        The list takes whatever is left and clips rather than growing, so a
        filling ledger can never change the height of the section around it —
        the chart above must not move every time an order goes through.
      */}
      <ul className="flex min-h-0 flex-1 flex-col gap-[1.2cqw] overflow-hidden border-t border-terminal-grid pt-[2cqw] text-[2.2cqw]">
        {activity.map((entry) => (
          <li key={entry.id} className="flex shrink-0 items-baseline gap-[3cqw]">
            <span className="truncate text-terminal-muted">{entry.label}</span>
            {/*
              The sign carries the direction as well as the color does, so the
              ledger reads the same for a red/green-colorblind player.
            */}
            <span
              className={cn(
                "ml-auto shrink-0 tabular-nums",
                entry.amount < 0 ? "text-down" : "text-up",
              )}
            >
              {signedEuro(entry.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
