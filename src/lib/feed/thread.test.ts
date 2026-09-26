import { describe, expect, it } from "vitest";
import { OPENING_POST } from "~/lib/feed/opening-post";
import { buildThread, type FeedPost } from "./thread";

function post(id: string, at: number, mine = false): FeedPost {
  return { id, author: "A", handle: "@a", body: id, at, mine };
}

describe("buildThread", () => {
  it("always opens with the seeded post", () => {
    // y-feed renders posts[0] as the thread's subject in its own styling.
    // Without a seed the player's first sentence takes that slot and stays
    // there, restyled and attributed to them, for the rest of the round.
    expect(buildThread([])[0].id).toBe(OPENING_POST.id);
    expect(buildThread([post("mine", 600, true)])[0].id).toBe(OPENING_POST.id);
  });

  it("keeps the opening post first even when a post is stamped earlier", () => {
    // The seed sits exactly at the open and the clock is coarse, so the
    // player's first post can carry the same minute.
    const thread = buildThread([post("mine", 9 * 60, true)]);
    expect(thread[0].id).toBe(OPENING_POST.id);
  });

  it("orders the player's posts under it by the clock", () => {
    const thread = buildThread([
      post("late", 600, true),
      post("early", 545, true),
    ]);
    expect(thread.slice(1).map((p) => p.id)).toEqual(["early", "late"]);
  });

  it("is stable at the same timestamp", () => {
    const thread = buildThread([
      post("first", 550, true),
      post("second", 550, true),
    ]);
    expect(thread.slice(1).map((p) => p.id)).toEqual(["first", "second"]);
  });

  it("does not mutate its input", () => {
    const mine = [post("b", 560, true), post("a", 540, true)];
    buildThread(mine);
    expect(mine.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
