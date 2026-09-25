import { describe, expect, it } from "vitest";
import { cn } from "~/lib/cn";

describe("test setup", () => {
  it("resolves the ~ path alias", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("neutralises server-only instead of throwing", async () => {
    await expect(import("server-only")).resolves.toBeDefined();
  });
});
