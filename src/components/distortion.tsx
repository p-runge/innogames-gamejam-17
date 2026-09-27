"use client";

import { cn } from "~/lib/cn";
import type { Band } from "~/lib/insanity";

/**
 * How the room looks from behind the Insane-O-Meter.
 *
 * A layer over both windows, and only ever a layer: it changes what the player
 * sees and never what they can press. Distorting the input would make the game
 * feel broken rather than make the player feel ill, and a lost round has to stay
 * the player's own fault.
 *
 * Rendered by the game scene rather than by the page, so it covers the two
 * websites and leaves the laptop, the hands and the phone in the photo alone. The
 * desk is not the thing going wrong.
 */
export default function Distortion({
  band,
  className,
}: {
  band: Band;
  className?: string;
}) {
  if (band.id === "lucid") return null;

  const bad = band.id === "feral" || band.id === "gone";
  const worst = band.id === "gone";

  return (
    <div
      aria-hidden
      className={cn(
        // Above both windows and under nothing, because there is nothing above it
        // inside the scene.
        "pointer-events-none absolute inset-0 z-30",
        className,
      )}
    >
      {/*
        The edges closing in. A radial gradient rather than an inset box shadow, so
        it scales with the display instead of with a pixel length.
      */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.82) 100%)",
          opacity: worst ? 1 : bad ? 0.7 : 0.4,
        }}
      />
      {/*
        The colour going wrong. Overlay rather than a flat fill, so the chart's own
        greens and reds shift with it instead of being painted over — the player
        has to keep reading the price through this.
      */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{
          backgroundColor: "#f4212e",
          opacity: worst ? 0.3 : bad ? 0.18 : 0.08,
        }}
      />
      {bad && (
        <div
          className="absolute inset-0 mix-blend-overlay"
          style={{
            backgroundColor: "#e8b53e",
            animation: `insanity-twitch ${worst ? 1.4 : 2.6}s steps(1, end) infinite`,
          }}
        />
      )}
    </div>
  );
}
