"use client";

import { useSound } from "~/components/sound-provider";
import { cn } from "~/lib/cn";

/**
 * The one control the game offers over its own noise.
 *
 * Deliberately small and in the display's corner: it has to be reachable in both
 * scenes — a jury that wants the room quiet should not have to find the menu
 * again mid-round — while reading as part of the machine rather than as a piece
 * of the game's own interface. Over the trading screen it lands on the empty half
 * of the browser's tab strip, where it passes for an extension icon.
 */
export default function MuteToggle({ className }: { className?: string }) {
  const { muted, toggleMuted } = useSound();

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-pressed={muted}
      aria-label={muted ? "Turn sound on" : "Turn sound off"}
      title={muted ? "Turn sound on" : "Turn sound off"}
      className={cn(
        // Its own dark chip, because the corner it sits in is light browser
        // chrome in one scene and a dark menu in the other.
        "grid place-items-center rounded-[0.5cqw] bg-terminal/80 p-[0.4cqw] transition-colors",
        muted
          ? "text-terminal-muted hover:text-white"
          : "text-white hover:text-brand-gold",
        "focus-visible:outline-none focus-visible:ring-[0.3cqw] focus-visible:ring-brand-gold/60",
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[1.9cqw]"
      >
        <path d="M4 9h3l4-3.5v13L7 15H4z" />
        {muted ? (
          <path d="M15 9.5l5 5m0-5l-5 5" />
        ) : (
          /* Two arcs rather than one: at this size a single wave reads as a
             scratch on the icon. */
          <>
            <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5" />
            <path d="M17.5 7a6.5 6.5 0 0 1 0 10" />
          </>
        )}
      </svg>
    </button>
  );
}
