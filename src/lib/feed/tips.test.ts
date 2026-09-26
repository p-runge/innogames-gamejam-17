import { describe, expect, it } from "vitest";

import type { TipPayload } from "~/lib/events/types";
import { mergeTips } from "./tips";

function tip(id: string, body = "something is happening"): TipPayload {
  return {
    id,
    sender: "nachtschicht",
    handle: "nachtschicht",
    body,
    at: 9 * 60 + 25,
  };
}

describe("mergeTips", () => {
  it("returns the history when the stream has nothing", () => {
    expect(mergeTips([tip("a")], [])).toEqual([tip("a")]);
  });

  it("appends what the stream has added", () => {
    expect(mergeTips([tip("a")], [tip("b")]).map((entry) => entry.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("drops a tip the history and the stream both carry", () => {
    // What a mid-round reload produces: the snapshot replays what the bus
    // buffer also hands back.
    const merged = mergeTips([tip("a"), tip("b")], [tip("b"), tip("c")]);
    expect(merged.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the history's copy when the two disagree", () => {
    const merged = mergeTips([tip("a", "first wording")], [tip("a", "second")]);
    expect(merged).toHaveLength(1);
    expect(merged[0].body).toBe("first wording");
  });

  it("survives an empty round", () => {
    expect(mergeTips([], [])).toEqual([]);
  });
});
