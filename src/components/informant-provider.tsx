"use client";

import { createContext, useContext } from "react";

import { useGameState } from "~/components/game-state-provider";
import { useInsanity } from "~/components/insanity-provider";
import { useInformantMessages } from "~/hooks/use-informant-messages";
import type { TipPayload } from "~/lib/events/types";
import { TRADING_SESSION } from "~/lib/trading-session";

const InformantContext = createContext<TipPayload[] | null>(null);

/**
 * Every message the player is sent, real and invented, as one list.
 *
 * A provider for the same reason the meter is one, and for a sharper reason
 * besides: the phone that shows these sits outside the laptop's display, and the
 * sound that announces them is played from inside it. Held apart, the two
 * disagreed — the chime counted only the informant's real tips, so a fabrication
 * arrived in silence and the player could tell the lies from the truth by ear,
 * which is the one thing the feature must not allow.
 */
export default function InformantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tips, candles, round } = useGameState();
  const { band } = useInsanity();

  /*
    A fabrication is stamped with the session clock, like the informant's own
    messages, so it sits on the same timeline as the candles rather than on the
    player's wall clock.
  */
  const at = candles.at(-1)?.t ?? TRADING_SESSION.openMinutes;
  const messages = useInformantMessages({ tips, band, at, round });

  return (
    <InformantContext.Provider value={messages}>
      {children}
    </InformantContext.Provider>
  );
}

export function useInformantInbox(): TipPayload[] {
  const messages = useContext(InformantContext);
  if (messages === null) {
    throw new Error("useInformantInbox must be used inside InformantProvider");
  }
  return messages;
}
