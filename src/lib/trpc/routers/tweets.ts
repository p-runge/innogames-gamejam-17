import { publish } from "~/lib/events/bus";
import { tweetPayloadSchema } from "~/lib/events/types";
import { reactToTweet } from "~/lib/npc/crowd";
import { baseProcedure, router } from "../init";

export const tweetsRouter = router({
  sendTweet: baseProcedure.input(tweetPayloadSchema).mutation(({ input }) => {
    const published = publish({ type: "tweet", payload: input });

    // Not awaited: generation takes seconds on a shared CPU, and the player's
    // own post has to appear at once. The replies arrive when they arrive,
    // which is also how a feed behaves. A failure in here must not fail the
    // post, so it is caught rather than left to reject unhandled.
    void reactToTweet(input).catch((error) => {
      console.error("crowd reaction failed", error);
    });

    return { id: published.id };
  }),
});
