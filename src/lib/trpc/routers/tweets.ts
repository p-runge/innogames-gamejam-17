import { TRPCError } from "@trpc/server";

import { publish } from "~/lib/events/bus";
import { sendTweetInputSchema } from "~/lib/events/types";
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
  sendTweet: baseProcedure.input(sendTweetInputSchema).mutation(({ input }) => {
    const suggestion = getSuggestion(input.suggestionId);

    if (suggestion === undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `unknown suggestion: ${input.suggestionId}`,
      });
    }

    // Only the post itself goes back out. The mania scale is the poster's own
    // state and means nothing to anyone else reading the feed.
    const published = publish({
      type: "tweet",
      payload: { username: input.username, suggestionId: input.suggestionId },
    });

    // After the publish, so the post is on the bus before the price it caused
    // starts moving. The scale is the poster's band: a manic voice is a louder
    // one, which is the whole bargain the Insane-O-Meter offers.
    applyImpulse(suggestion.mood, input.mania);

    return { id: published.id };
  }),
});
