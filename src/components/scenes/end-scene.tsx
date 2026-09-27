"use client";

import Image from "next/image";
import { useState } from "react";

import MenuButton from "~/components/menu-button";
import { INSANITY_MAX } from "~/lib/insanity";
import { euro } from "~/lib/money";
import type { Outcome } from "~/lib/round-outcome";
import { formatClock } from "~/lib/trading-session";

/**
 * The headline, the line under it, and the artwork it sits on.
 *
 * `game over.png` covers both losses. There is no artwork for a win yet, so it
 * borrows the title logo under a headline of its own until there is.
 */
const ENDINGS: Record<
  Outcome,
  { headline: string; note: string; art: string; alt: string }
> = {
  won: {
    headline: "You got out",
    note: "A million in the account and nothing left in the position. Somebody else is holding it now.",
    art: "/logo.png",
    alt: "Rise and Fall",
  },
  insane: {
    headline: "You lost your mind",
    note: "The meter filled before the account did. Whatever the position is worth now, it is not worth it to you.",
    art: "/game over.png",
    alt: "Game over",
  },
  bell: {
    headline: "The bell got you first",
    note: "Half past five. The day is over, the position is still open, and there is no tomorrow in this game.",
    art: "/game over.png",
    alt: "Game over",
  },
};

/**
 * How the round ended, and what it ended with.
 *
 * Its own scene rather than an overlay on the trading screen, because the
 * composer going away is what stops a post from being charged to a meter that has
 * already decided the round.
 */
export default function EndScene({
  outcome,
  cash,
  shares,
  insanity,
  at,
  onBackToMenu,
}: {
  outcome: Outcome;
  cash: number;
  shares: number;
  insanity: number;
  /** The session clock the round ended on. */
  at: number;
  onBackToMenu: () => void;
}) {
  /*
    Captured on the first render and never again. The market goes on ticking under
    this scene until the player leaves for the menu, and a tally that followed it
    would show a clock still moving after the day had ended.
  */
  const [tally] = useState(() => ({ cash, shares, insanity, at }));

  const ending = ENDINGS[outcome];

  const rows = [
    { label: "Cash", value: euro(tally.cash) },
    { label: "Still holding", value: `${tally.shares} INNO` },
    {
      label: "Insane-O-Meter",
      value: `${Math.round(tally.insanity)} / ${INSANITY_MAX}`,
    },
    { label: "Clocked out", value: formatClock(tally.at) },
  ];

  return (
    /*
      One font size in cqw carries the whole scene, the way the start menu's does,
      so the ending keeps its proportions at any size of the photo it sits inside.
    */
    <div className="flex h-full w-full flex-col items-center justify-center gap-[1.2em] text-[2cqw]">
      <Image
        src={ending.art}
        alt={ending.alt}
        width={2172}
        height={724}
        priority
        sizes="60vw"
        className="h-auto w-[44%]"
      />
      <h2 className="font-pixel text-[1.4em] tracking-[0.08em] text-brand-gold uppercase">
        {ending.headline}
      </h2>
      <p className="max-w-[62%] text-center text-[0.9em] leading-relaxed text-terminal-muted">
        {ending.note}
      </p>
      <dl className="grid w-[52%] gap-y-[0.4em] text-[0.95em]">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-[1em]">
            <dt className="text-terminal-muted">{row.label}</dt>
            <dd className="font-bold text-brand-gold tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <MenuButton onClick={onBackToMenu}>Back to menu</MenuButton>
    </div>
  );
}
