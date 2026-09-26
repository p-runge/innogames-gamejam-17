import { describe, expect, it } from "vitest";
import { OPENING_POST } from "~/lib/npc/templates";
import { buildThread, mergePosts, toFeedPost, type FeedPost } from "./thread";

function post(id: string, at: number, mine = false): FeedPost {
  return { id, author: "A", handle: "@a", body: id, at, mine };
}

describe("buildThread", () => {
  const reply = (handle: string, at: number) => ({
    author: "A",
    handle,
    body: `from ${handle}`,
    at,
  });

  it("always opens with the seeded post", () => {
    // y-feed renders posts[0] as the thread's subject in its own styling.
    // Without a seed the player's first sentence takes that slot and stays
    // there, restyled and attributed to them, for the rest of the round.
    const thread = buildThread([], []);
    expect(thread[0].id).toBe(OPENING_POST.id);

    const withPosts = buildThread([reply("a_b", 545)], [post("mine", 600, true)]);
    expect(withPosts[0].id).toBe(OPENING_POST.id);
  });

  it("keeps the opening post first even when replies are stamped earlier", () => {
    // A reply cannot predate the post it answers, but the clock is coarse and
    // the seed sits exactly at the open.
    const thread = buildThread([reply("a_b", 9 * 60)], []);
    expect(thread[0].id).toBe(OPENING_POST.id);
  });

  it("orders the crowd and the player under it by the clock", () => {
    const thread = buildThread(
      [reply("early", 545), reply("late", 600)],
      [post("mine", 560, true)],
    );
    expect(thread.slice(1).map((p) => p.body)).toEqual([
      "from early",
      "mine",
      "from late",
    ]);
  });

  it("deduplicates a reply that arrives in both the history and the stream", () => {
    // A client that reloads gets the thread from session.state and then keeps
    // receiving live events; the same reply can be in both.
    const same = reply("a_b", 545);
    const thread = buildThread([same, same], []);
    expect(thread).toHaveLength(2);
  });
});

describe("mergePosts", () => {
  it("orders both sides by the in-game clock", () => {
    const crowd = [post("crowd-early", 540), post("crowd-late", 560)];
    const mine = [post("mine-middle", 550, true)];
    expect(mergePosts(crowd, mine).map((p) => p.id)).toEqual([
      "crowd-early",
      "mine-middle",
      "crowd-late",
    ]);
  });

  it("keeps the player's post ahead of a reply stamped the same minute", () => {
    // The reply answers the post, so at equal timestamps the post came first.
    // Ordering them the other way reads as the crowd answering before you spoke.
    const crowd = [post("reply", 550)];
    const mine = [post("mine", 550, true)];
    expect(mergePosts(crowd, mine).map((p) => p.id)).toEqual(["mine", "reply"]);
  });

  it("is stable within one side at the same timestamp", () => {
    const crowd = [post("first", 550), post("second", 550)];
    expect(mergePosts(crowd, []).map((p) => p.id)).toEqual(["first", "second"]);
  });

  it("handles either side being empty", () => {
    expect(mergePosts([], [])).toEqual([]);
    expect(mergePosts([post("a", 540)], []).map((p) => p.id)).toEqual(["a"]);
    expect(mergePosts([], [post("b", 540, true)]).map((p) => p.id)).toEqual(["b"]);
  });

  it("does not mutate either input", () => {
    const crowd = [post("b", 560), post("a", 540)];
    mergePosts(crowd, []);
    expect(crowd.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("toFeedPost", () => {
  it("strips a handle the model put at the front of its own reply", () => {
    // Told explicitly not to, qwen3.5:4b still opened replies with a handle —
    // usually its own, which renders as an account answering itself.
    const post = toFeedPost(
      {
        author: "A",
        handle: "gsh_92",
        body: "@gsh_92, Ascendia is bleeding out while they profit.",
        at: 550,
      },
      0,
    );
    expect(post.body).toBe("Ascendia is bleeding out while they profit.");
  });

  it("leaves a handle mentioned inside the reply alone", () => {
    // Addressing someone else mid-sentence is normal on a feed and is not the
    // thing being corrected.
    const body = "textbook trap, @chartcrimes called it wrong again";
    const post = toFeedPost({ author: "A", handle: "a_b", body, at: 550 }, 0);
    expect(post.body).toBe(body);
  });

  it("does not empty a reply that is only a handle", () => {
    // Nothing usable is left, so the reply keeps its text rather than rendering
    // as a blank row.
    const body = "@someone";
    const post = toFeedPost({ author: "A", handle: "a_b", body, at: 550 }, 0);
    expect(post.body).toBe(body);
  });

  it("adds the @ the feed renders and a stable id", () => {
    const first = toFeedPost(
      { author: "Exit Liquidity", handle: "exitliq", body: "sold", at: 550 },
      3,
    );
    expect(first.handle).toBe("@exitliq");
    expect(first.author).toBe("Exit Liquidity");
    expect(first.mine).toBe(false);
    expect(first.id).toContain("exitliq");
  });

  it("gives two replies from one account different ids", () => {
    // React keys collide otherwise, and the second reply silently replaces the
    // first in the rendered list.
    const payload = { author: "A", handle: "a_person", body: "x", at: 550 };
    expect(toFeedPost(payload, 0).id).not.toBe(toFeedPost(payload, 1).id);
  });
});
