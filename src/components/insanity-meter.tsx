"use client";

import { cn } from "~/lib/cn";
import { INSANITY_MAX, type Band, type BandId } from "~/lib/insanity";

/**
 * A ramp from the feed's own muted grey to its alert red.
 *
 * Keyed by band id rather than carried on the band itself, so the rules module
 * stays free of presentation. The colours are the feed's, not the terminal's:
 * this sits inside the Y window, where red and green do not already mean a
 * direction.
 */
const BAND_COLOR: Record<BandId, string> = {
  lucid: "#71767b",
  twitchy: "#e8b53e",
  feral: "#e0723c",
  gone: "#f4212e",
};

/**
 * The amount on a mood button.
 *
 * Rounded to the two decimals the price list can produce and printed without
 * trailing zeros, because the button is small and `+2` reads faster than
 * `+2.00`. A true minus sign rather than a hyphen: beside a plus, a hyphen sits
 * too high and too short to read as its opposite.
 */
export function formatCost(cost: number): string {
  const rounded = Math.round(cost * 100) / 100;
  if (rounded === 0) return "0";

  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)}`;
}

/**
 * The Insane-O-Meter, over the buttons that fill it.
 *
 * Placed where the price is paid rather than somewhere on the terminal, so the
 * bar and the amounts that move it are read in one glance.
 */
export default function InsanityMeter({
  insanity,
  band,
  className,
}: {
  insanity: number;
  band: Band;
  className?: string;
}) {
  const reading = Math.round(insanity);
  const color = BAND_COLOR[band.id];

  return (
    <div className={cn("flex items-center gap-[1.6cqw]", className)}>
      <span className="shrink-0 text-[2cqw] font-bold tracking-[0.08em] text-feed-muted uppercase">
        Insane-O-Meter
      </span>
      <div
        role="meter"
        aria-label="Insane-O-Meter"
        aria-valuemin={0}
        aria-valuemax={INSANITY_MAX}
        aria-valuenow={reading}
        aria-valuetext={`${reading} of ${INSANITY_MAX}, ${band.name}`}
        className="relative h-[1.2cqw] min-w-0 flex-1 overflow-hidden rounded-full bg-feed-line"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-200"
          style={{
            width: `${(insanity / INSANITY_MAX) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span
        className="shrink-0 text-[2cqw] font-bold tracking-[0.08em] uppercase"
        style={{ color }}
      >
        {band.name}
      </span>
    </div>
  );
}
