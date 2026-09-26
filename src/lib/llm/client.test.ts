import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generate } from "./client";

const schema = z.object({ body: z.string(), mood: z.string() });

/**
 * Typed as `fetch` rather than by its implementation: the body ignores the
 * arguments, but the assertions below read the request back out of
 * `mock.calls`, and an untyped mock records those as an empty tuple.
 */
function respond(body: unknown, ok = true) {
  return vi.fn<typeof fetch>(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status: ok ? 200 : 500,
        headers: { "content-type": "application/json" },
      }),
  );
}

/** Ollama wraps the generated JSON in a chat envelope, as a string. */
function envelope(content: unknown) {
  return { message: { content: JSON.stringify(content) } };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("generate", () => {
  it("parses a well-formed response", async () => {
    vi.stubGlobal(
      "fetch",
      respond(envelope({ body: "sell everything", mood: "dump" })),
    );
    expect(await generate({ system: "s", prompt: "p", schema })).toEqual({
      body: "sell everything",
      mood: "dump",
    });
  });

  it("returns null on a non-2xx response", async () => {
    vi.stubGlobal("fetch", respond({ error: "model not found" }, false));
    expect(await generate({ system: "s", prompt: "p", schema })).toBeNull();
  });

  it("returns null when the envelope is not JSON", async () => {
    vi.stubGlobal("fetch", respond("<html>gateway timeout</html>"));
    expect(await generate({ system: "s", prompt: "p", schema })).toBeNull();
  });

  it("returns null when the generated content is prose, not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      respond({ message: { content: "Sure! Here is a reply:" } }),
    );
    expect(await generate({ system: "s", prompt: "p", schema })).toBeNull();
  });

  it("returns null when the generated JSON misses a field", async () => {
    vi.stubGlobal("fetch", respond(envelope({ body: "no mood here" })));
    expect(await generate({ system: "s", prompt: "p", schema })).toBeNull();
  });

  it("returns null when the content is an empty string", async () => {
    vi.stubGlobal("fetch", respond({ message: { content: "" } }));
    expect(await generate({ system: "s", prompt: "p", schema })).toBeNull();
  });

  it("returns null when fetch rejects, rather than throwing at the caller", async () => {
    // A dead container must cost a quiet feed, not a broken request handler.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    expect(await generate({ system: "s", prompt: "p", schema })).toBeNull();
  });

  it("constrains the model with the schema and asks for one plain answer", async () => {
    const fetchMock = respond(envelope({ body: "b", mood: "neutral" }));
    vi.stubGlobal("fetch", fetchMock);
    await generate({ system: "sys", prompt: "usr", schema });

    const [url, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(String(init?.body));
    expect(String(url)).toContain("/api/chat");
    // Without a format the model writes prose and every parse fails; without
    // think:false a reasoning model spends seconds of shared CPU on tokens
    // nobody reads; streaming would break the single-response parse.
    expect(sent.format).toBeDefined();
    expect(sent.think).toBe(false);
    expect(sent.stream).toBe(false);
    expect(sent.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "usr" },
    ]);
  });

  it("does not call the model at all when disabled", async () => {
    vi.stubEnv("LLM_ENABLED", "false");
    vi.resetModules();
    const fetchMock = respond(envelope({ body: "b", mood: "neutral" }));
    vi.stubGlobal("fetch", fetchMock);

    const { generate: fresh } = await import("./client");
    expect(await fresh({ system: "s", prompt: "p", schema })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
