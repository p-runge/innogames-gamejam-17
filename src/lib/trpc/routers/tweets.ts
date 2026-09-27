import { TRPCError } from "@trpc/server";

import { publish } from "~/lib/events/bus";
import { tweetPayloadSchema } from "~/lib/events/types";
import { getSuggestion } from "~/lib/feed/suggestions";
import { applyImpulse } from "~/lib/market/engine";
import { baseProcedure, router } from "../init";

export const tweetsRouter = router({
  /**
   * Post one of the suggestions and let it move the price.
   *
   * The mood comes from the pool here rather than from the request, so the impulse
   * a post carries is the one that was authored with it. An unknown id is rejected
   * instead of posted quietly: it means the client is running against a different
   * pool than this server, and a post with no market effect is the confusing way
   * for that to show up.
   */
  sendTweet: baseProcedure.input(tweetPayloadSchema).mutation(({ input }) => {
    const suggestion = getSuggestion(input.suggestionId);

    if (suggestion === undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `unknown suggestion: ${input.suggestionId}`,
      });
    }

    const published = publish({ type: "tweet", payload: input });

    // After the publish, so the post is on the bus before the price it caused
    // starts moving.
    applyImpulse(suggestion.mood);

    return { id: published.id };
  }),
});
