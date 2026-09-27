import Image from "next/image";

import { cn } from "~/lib/cn";

/*
  The four corner marks on a menu frame. Each is a box that keeps only the two
  borders meeting at its own corner, which draws the bracket without a second
  rectangle and a mask.

  Written out in full rather than composed from parts: Tailwind reads the source
  for class names and never sees one that was assembled at runtime.
*/
const CORNERS = [
  "top-[0.22em] left-[0.22em] border-t border-l",
  "top-[0.22em] right-[0.22em] border-t border-r",
  "bottom-[0.22em] left-[0.22em] border-b border-l",
  "bottom-[0.22em] right-[0.22em] border-b border-r",
];

function MenuButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Held on one line: a label that wrapped would grow its own button and
        // leave the menu with two rows of different heights.
        "relative w-[38%] border px-[1em] py-[0.55em] font-pixel tracking-[0.08em] whitespace-nowrap uppercase transition-colors",
        // Dark by default, so a disabled entry reads as a slot the game has
        // not filled yet rather than as a button that swallowed the click.
        "border-terminal-muted text-terminal-muted",
        "enabled:border-brand-gold enabled:text-brand-gold",
        "enabled:hover:bg-brand-gold/10 enabled:focus-visible:bg-brand-gold/10",
        // The frame already changes on focus, and an outline on a beveled
        // pixel frame reads as a second, misaligned border.
        "focus-visible:outline-none",
      )}
    >
      {CORNERS.map((corner) => (
        <span
          key={corner}
          aria-hidden
          className={cn("absolute size-[0.4em] border-current", corner)}
        />
      ))}
      {children}
    </button>
  );
}

/**
 * The menu the game opens on. Starting a round is the player's move, not the
 * page load's, so this scene owns the only way in.
 */
export default function StartScene({ onStart }: { onStart: () => void }) {
  return (
    /*
      One font size in cqw carries the whole scene: every measurement below is
      in em or in a percentage of the screen, so the menu keeps its proportions
      at any size of the photo it sits inside.
    */
    <div className="flex h-full w-full flex-col items-center justify-center gap-[1.9em] text-[2cqw]">
      <Image
        src="/logo.png"
        alt="Rug-Pull Simulator"
        width={2172}
        height={724}
        priority
        sizes="60vw"
        className="h-auto w-[59%]"
      />
      <nav className="flex w-full flex-col items-center gap-[0.9em]">
        <MenuButton onClick={onStart}>Start Game</MenuButton>
        {/*
          Held open rather than left out: the menu the mockup describes has
          three rows, and a round has no score to list yet.
        */}
        <MenuButton disabled>Highscore List</MenuButton>
      </nav>
    </div>
  );
}
