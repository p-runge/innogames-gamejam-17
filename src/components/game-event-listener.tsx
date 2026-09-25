"use client";

import { useSubscription } from "@trpc/tanstack-react-query";

import { useTRPC } from "~/lib/trpc/client";

/**
 * Subscribes to the single server event stream. Renders nothing; each event
 * kind is handled in the switch below.
 */
export default function GameEventListener() {
  const trpc = useTRPC();

  useSubscription(
    trpc.events.onEvent.subscriptionOptions(undefined, {
      // `tracked()` on the server wraps each event, so the payload arrives as
      // { id, data } rather than the event itself.
      onData: ({ data }) => {
        switch (data.type) {
          case "tweet":
            console.log(`@${data.payload.username}: ${data.payload.message}`);
            break;
        }
      },
      onError: (error) => {
        console.error("event stream failed", error);
      },
    }),
  );

  return null;
}
