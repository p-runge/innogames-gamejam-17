import { publish } from "~/lib/events/bus";
import { tweetPayloadSchema } from "~/lib/events/types";
import { baseProcedure, router } from "../init";

export const tweetsRouter = router({
  sendTweet: baseProcedure.input(tweetPayloadSchema).mutation(({ input }) => {
    const published = publish({ type: "tweet", payload: input });
    return { id: published.id };
  }),
});
