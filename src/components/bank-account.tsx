import { cn } from "~/lib/cn";

export type BankTransaction = {
  id: string;
  label: string;
  /** Signed. Negative is money leaving the account. */
  amount: number;
};

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/*
  U+2212 rather than a hyphen, to match the delta in the chart's header and
  because a hyphen sits too high and too short next to tabular figures.
*/
const signedEuro = (amount: number) =>
  `${amount < 0 ? "−" : "+"}${euro.format(Math.abs(amount))}`;

/**
 * The player's account, as their bank would show it. Presentational only — the
 * balance and the ledger come from the game.
 */
export default function BankAccount({
  bank,
  iban,
  balance,
  transactions,
  className,
}: {
  bank: string;
  /** Already masked. This component does not shorten it. */
  iban: string;
  balance: number;
  transactions: BankTransaction[];
  className?: string;
}) {
  return (
    <div
      /*
        @container, like the chart panel: the type scales with this box rather
        than with the screen behind it, so the two panels stay in proportion to
        each other wherever they are placed.
      */
      className={cn(
        "@container flex flex-col gap-[3cqw] bg-terminal p-[3cqw] font-mono",
        className,
      )}
    >
      <header className="flex items-baseline justify-between text-[2.4cqw] text-terminal-muted">
        <span className="tracking-[0.2em]">{bank}</span>
        <span className="tabular-nums">{iban}</span>
      </header>

      <div>
        <div className="text-[2.2cqw] tracking-[0.15em] text-terminal-muted">
          Saldo
        </div>
        {/*
          The balance is a quantity, not a direction, so it wears the plain ink
          token — up/down green and red stay reserved for the movement in the
          ledger below and in the chart above.
        */}
        <div className="text-[6cqw] tabular-nums text-white">
          {euro.format(balance)}
        </div>
      </div>

      <ul className="flex flex-col gap-[1.6cqw] border-t border-terminal-grid pt-[2.4cqw] text-[2.4cqw]">
        {transactions.map((transaction) => (
          <li key={transaction.id} className="flex items-baseline gap-[3cqw]">
            <span className="truncate text-terminal-muted">
              {transaction.label}
            </span>
            {/*
              The sign carries the direction as well as the color does, so a
              red/green-colorblind player reads the ledger the same way.
            */}
            <span
              className={cn(
                "ml-auto shrink-0 tabular-nums",
                transaction.amount < 0 ? "text-down" : "text-up",
              )}
            >
              {signedEuro(transaction.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
