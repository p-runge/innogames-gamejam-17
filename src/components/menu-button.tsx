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

/**
 * One row of a menu.
 *
 * Its own file rather than the start screen's, because the ending has a menu too
 * and the two have to be the same button — a second copy would drift in a way
 * nobody notices until both are on screen in the same session.
 */
export default function MenuButton({
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
