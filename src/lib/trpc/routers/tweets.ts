import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publish } from "~/lib/events/bus";
import { tweetPayloadSchema } from "~/lib/events/types";
import { draftForMoods, getDraft } from "~/lib/feed/drafts";
import { getSuggestion } from "~/lib/feed/suggestions";
import { applyImpulse } from "~/lib/market/engine";
import { moodSchema } from "~/lib/market/types";
import { baseProcedure, router } from "../init";

export const tweetsRouter = router({
  /**
   * Write a line for each button on offer, ready for the click that posts it.
   *
   * Called while the player's cooldown runs, so the generation happens in a window
   * where they cannot post anyway. At most five, because there are five moods and a
   * client asking for more than one line per button is asking for work nobody can
   * use.
   */
  draft: baseProcedure
    .input(z.object({ moods: moodSchema.array().min(1).max(5) }))
    .mutation(({ input }) => draftForMoods(input.moods)),

  /**
   * Post a line and let it move the price.
   *
   * The mood comes from the server's own copy of the line rather than from the
   * request, so the impulse a post carries is the one that was drafted with it. A
   * drafted id is looked up first and the authored pool second — the client falls
   * back to the pool whenever a draft has not arrived, so both kinds of id reach
   * here in normal play.
   *
   * An unknown id is rejected rather than posted quietly: after a server restart a
   * client can still be holding `draft-` ids from a store that no longer exists,
   * and a post with no market effect is the confusing way for that to surface.
   */
  sendTweet: baseProcedure.input(tweetPayloadSchema).mutation(({ input }) => {
    const suggestion =
      getDraft(input.suggestionId) ?? getSuggestion(input.suggestionId);

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
