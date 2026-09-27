"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { useGameState } from "~/components/game-state-provider";
import { useInformantInbox } from "~/components/informant-provider";
import { cn } from "~/lib/cn";
import type { TipPayload } from "~/lib/events/types";
import { formatClock } from "~/lib/trading-session";

/** How long an arriving message stays up before the bubble goes away. */
export const BUBBLE_MS = 8_000;

/**
 * The informant's phone, face up on the keyboard.
 *
 * As the page places it: it reads the messages out of the game state rather
 * than being handed them, because it sits outside the display alongside the
 * hands, where there are no panels to thread a prop through.
 *
 * Some of those messages are not from anybody. Past a certain reading on the
 * Insane-O-Meter the player's own head starts writing them, and this is where the
 * two streams are merged — the phone below is handed one list and cannot tell
 * which is which, because neither can the player.
 */
export default function Phone() {
  const { ready } = useGameState();
  const messages = useInformantInbox();

  return <PhoneOnDesk tips={messages} ready={ready} />;
}

/**
 * The phone itself, given its messages.
 *
 * A message buzzes the phone and says its piece in a bubble for a few seconds,
 * and then both are gone — this is an announcement, not an inbox. Nothing about
 * it is recoverable afterwards, which is the point: the informant is talking to
 * a player who is supposed to be watching the desk, not an archive to be
 * consulted between trades.
 *
 * Split from the default export above so a test can drive it a message at a
 * time without standing up the provider and the tRPC client behind it.
 */
export function PhoneOnDesk({
  tips,
  ready = true,
  className,
}: {
  tips: TipPayload[];
  /**
   * Whether the server's history has arrived yet.
   *
   * Without it the phone cannot tell a reload from a delivery. The provider
   * renders before its snapshot resolves, so its first sight of a round in
   * progress is an empty list followed by eight messages at once — the same
   * shape a message arriving has. Left to guess, every reload re-announced the
   * whole round.
   */
  ready?: boolean;
  className?: string;
}) {
  const [showing, setShowing] = useState<TipPayload | null>(null);

  /*
    How many messages the phone has already accounted for, seeded from the
    history once it lands so the ones that were already sent count as delivered:
    `null` means the snapshot has not arrived and nothing can be judged new yet.
  */
  const [seen, setSeen] = useState<number | null>(ready ? tips.length : null);

  /*
    Adjusting state during render rather than from an effect. The phone has to
    react to a message arriving, and an effect that called setShowing would be
    the `react-hooks/set-state-in-effect` shape this project's lint rules refuse
    — for good reason, since it renders the silent phone first and buzzes it
    afterwards.

    Compared against the previous count, not against a ref: the provider
    rerenders four times a second on price ticks, and a phone that buzzed on
    each of them would never stop.
  */
  if (seen === null) {
    if (ready) setSeen(tips.length);
  } else if (tips.length !== seen) {
    if (tips.length > seen) setShowing(tips.at(-1) ?? null);
    setSeen(tips.length);
  }

  const showingId = showing?.id;

  /*
    Keyed on the message rather than on a boolean, so a second one arriving
    while the bubble is still up restarts the few seconds instead of inheriting
    whatever was left of the first one's.
  */
  useEffect(() => {
    if (showingId === undefined) return;
    const timer = setTimeout(() => setShowing(null), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [showingId]);

  return (
    /*
      Clipped to the photo for the same reason the hands are: the phone hangs
      past the bottom edge, and the letterbox bars that appear whenever the
      viewport is taller than the photo are not desk.
    */
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {/*
        Over the navigation keys, right of where the right hand rests, running
        off the bottom edge of the photo — the corner of the keyboard nobody
        types on, which is where a phone gets put down.
      */}
      <div className="absolute top-[74%] right-[2%] w-[26%]">
        {/*
          Remounted on each arriving message, because mounting is what starts a
          CSS animation: there is no state to reset and nothing to key past the
          message's own id. Buzz and glow are two nested elements on purpose —
          the phone's resting angle is a transform, and a shake that moved it
          would have to carry that angle through every keyframe.
        */}
        <div
          key={showingId ?? "idle"}
          data-buzz
          className={cn(showingId && "animate-[phone-buzz_0.45s_ease-in-out]")}
        >
          <div
            className={cn(showingId && "animate-[phone-glow_1.4s_ease-out]")}
          >
            <Image
              src="/phone.png"
              alt=""
              width={776}
              height={760}
              sizes="26vw"
              className="h-auto w-full rotate-[19deg] drop-shadow-[0_0.5cqw_0.7cqw_rgba(0,0,0,0.65)]"
            />
          </div>
        </div>

        {/*
          The live region is in the document from the first render, empty, and
          the message is put into it. A region inserted together with its own
          content is commonly not announced at all — the announcement is of a
          mutation, so there has to be something there to mutate.
        */}
        <div
          role="log"
          aria-live="polite"
          aria-label="Messages"
          className="absolute right-[38%] bottom-[92%] w-[26cqw]"
        >
          {showing && (
            <div
              data-message
              className="relative origin-bottom-right animate-[phone-message-in_0.22s_ease-out] rounded-[1.2cqw] bg-[#f6f7f8]/95 px-[1.4cqw] py-[1.1cqw] text-[#101013] shadow-[0_0.4cqw_1.6cqw_rgba(0,0,0,0.7)] backdrop-blur-sm"
            >
              <div className="flex items-baseline gap-[0.8cqw] text-[1.15cqw]">
                <span className="font-bold">{showing.sender}</span>
                <span className="tabular-nums text-black/45">
                  {formatClock(showing.at)}
                </span>
              </div>
              <p className="mt-[0.35cqw] text-[1.35cqw] leading-snug">
                {showing.body}
              </p>
              {/*
                The tail, a corner of the bubble rotated under it so it points
                back down at the phone. Drawn with the bubble's own background
                and no shadow of its own, which is what keeps it reading as part
                of the panel rather than as a diamond behind it.
              */}
              <div
                aria-hidden
                className="absolute right-[8%] -bottom-[0.5cqw] size-[1.2cqw] rotate-45 rounded-[0.2cqw] bg-[#f6f7f8]/95"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
