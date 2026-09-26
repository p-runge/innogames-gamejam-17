"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useEffect, useState } from "react";

import type { TipPayload } from "~/lib/events/types";
import { cn } from "~/lib/cn";
import { formatClock } from "~/lib/trading-session";

/** How long an arriving message stays open before the dock folds away. */
export const AUTO_CLOSE_MS = 8_000;

/** Messages kept in view. Older ones scroll; the dock is not an inbox. */
const SHOWN = 6;

/**
 * The informant's direct messages, docked at the foot of the Y window.
 *
 * Y's own messages bar: a shut strip that pops open when something arrives and
 * folds away again. A private channel rather than a post in the thread, which
 * is what keeps the one piece of information the crowd does not have from
 * reading as the eleventh angry reply.
 *
 * It deliberately does not reach for the game state itself. The thread and the
 * dock are two surfaces on the same page and neither should have to know about
 * the other, so `Screen` places both and hands this one its messages.
 */
export default function DmDock({
  tips,
  ready = true,
  className,
}: {
  tips: TipPayload[];
  /**
   * Whether the server's history has arrived yet.
   *
   * Without it the dock cannot tell a reload from a delivery. The provider
   * renders before its snapshot resolves, so the dock's first sight of a round
   * in progress is an empty list followed by eight tips at once — the same
   * shape a tip arriving has. Left to guess, every reload popped the dock open
   * and re-announced the whole round.
   */
  ready?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  /*
    Whether the dock opened by itself. A message that arrived folds away after
    eight seconds; one the player opened deliberately stays until they close
    it, because snapping shut mid-read is how a missed tip stays missed.
  */
  const [arrived, setArrived] = useState(false);

  /*
    Both seeded from the history once it lands, so the messages that were
    already sent count as read: `null` means the snapshot has not arrived and
    nothing can be judged new yet.
  */
  const [seen, setSeen] = useState<number | null>(ready ? tips.length : null);
  const [read, setRead] = useState(ready ? tips.length : 0);

  /*
    Adjusting state during render rather than from an effect. The dock has to
    react to a message arriving, and an effect that called setOpen would be the
    `react-hooks/set-state-in-effect` shape this project's lint rules refuse —
    for good reason, since it renders the shut dock first and then opens it.

    Compared against the previous count, not against a ref: the provider
    rerenders four times a second on price ticks, and a dock that reopened on
    each of them would never close.
  */
  if (seen === null) {
    if (ready) {
      setSeen(tips.length);
      setRead(tips.length);
    }
  } else if (tips.length !== seen) {
    if (tips.length > seen) {
      setOpen(true);
      setArrived(true);
    }
    setSeen(tips.length);
  }

  const latestId = tips.at(-1)?.id;

  /*
    Keyed on the newest message as well as on `open`, so a second tip arriving
    while the dock is already open restarts the eight seconds instead of
    inheriting whatever was left of the first one's.
  */
  useEffect(() => {
    if (!open || !arrived) return;
    const timer = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, arrived, latestId]);

  const [animateRef] = useAutoAnimate<HTMLDivElement>();

  const unread = Math.max(0, tips.length - read);
  const shown = tips.slice(-SHOWN);

  return (
    <div
      ref={animateRef}
      className={cn(
        "flex w-[38cqw] flex-col overflow-hidden rounded-t-[1.4cqw] border border-b-0 border-feed-line bg-feed-surface shadow-[0_0_2cqw_rgba(0,0,0,0.6)]",
        className,
      )}
    >
      {/*
        The live region is in the document from the first render, empty, and
        the messages are put into it. A region inserted together with its own
        content is commonly not announced at all — the announcement is of a
        mutation, so there has to be something there to mutate.
      */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Direct messages"
        className={cn(
          "overflow-y-auto",
          open ? "max-h-[34cqw] px-[2.2cqw] py-[1.8cqw]" : "max-h-0",
        )}
      >
        {open &&
          shown.map((tip) => (
            <div key={tip.id} className="mb-[1.6cqw] last:mb-0">
              <div className="flex items-baseline gap-[1cqw] text-[2.1cqw] text-feed-muted">
                <span className="font-bold text-feed-ink">{tip.sender}</span>
                <span className="tabular-nums">{formatClock(tip.at)}</span>
              </div>
              {/*
                A left rule and a flat panel rather than a chat bubble: the
                informant is not having a conversation, they are dropping
                something off.
              */}
              <p className="mt-[0.6cqw] border-l-[0.4cqw] border-feed-accent bg-feed-hover px-[1.4cqw] py-[1cqw] text-[2.4cqw] leading-snug">
                {tip.body}
              </p>
            </div>
          ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setOpen((wasOpen) => !wasOpen);
          // Opened on purpose, so it stays open until it is closed on purpose.
          setArrived(false);
          setRead(tips.length);
        }}
        className="flex shrink-0 items-center justify-between gap-[1.4cqw] border-t border-feed-line px-[2.2cqw] py-[1.4cqw] text-left text-[2.4cqw] font-bold hover:bg-feed-hover"
      >
        <span>Messages</span>
        {unread > 0 && (
          <span className="grid min-w-[3.2cqw] place-items-center rounded-full bg-feed-accent px-[0.9cqw] py-[0.2cqw] text-[2cqw] tabular-nums text-white">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
