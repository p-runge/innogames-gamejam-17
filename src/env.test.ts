import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The schema validates on import, so each case needs a fresh module registry:
 * a cached `~/env` would carry the previous case's values.
 */
async function loadEnv() {
  vi.resetModules();
  return (await import("./env")).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("env", () => {
  it("falls back to defaults when nothing is set", async () => {
    const env = await loadEnv();
    expect(env.LLM_BASE_URL).toBe("http://127.0.0.1:11435");
    expect(env.LLM_ENABLED).toBe(true);
    expect(env.LLM_TIMEOUT_MS).toBe(20_000);
    expect(env.LLM_MODEL.length).toBeGreaterThan(0);
  });

  it("reads the model and base url from the environment", async () => {
    vi.stubEnv("LLM_BASE_URL", "http://ollama:11434");
    vi.stubEnv("LLM_MODEL", "qwen3.5:2b");
    const env = await loadEnv();
    expect(env.LLM_BASE_URL).toBe("http://ollama:11434");
    expect(env.LLM_MODEL).toBe("qwen3.5:2b");
  });

  it("coerces the timeout to a number", async () => {
    vi.stubEnv("LLM_TIMEOUT_MS", "5000");
    expect((await loadEnv()).LLM_TIMEOUT_MS).toBe(5_000);
  });

  it("reads LLM_ENABLED as a boolean, not a truthy string", async () => {
    // The trap this pins: a plain z.string() would make "false" enabled, and the
    // switch that is supposed to keep a broken container from taking the game
    // down would be stuck on.
    vi.stubEnv("LLM_ENABLED", "false");
    expect((await loadEnv()).LLM_ENABLED).toBe(false);
  });

  it("rejects a non-numeric timeout instead of running with NaN", async () => {
    vi.stubEnv("LLM_TIMEOUT_MS", "not-a-number");
    await expect(loadEnv()).rejects.toThrow();
  });

  it("rejects a base url that is not a url", async () => {
    vi.stubEnv("LLM_BASE_URL", "ollama:11434");
    await expect(loadEnv()).rejects.toThrow();
  });

  it("treats an empty model name as unset and uses the default", async () => {
    // emptyStringAsUndefined, so a variable left blank in a deploy config falls
    // through to the default rather than reaching Ollama as "".
    vi.stubEnv("LLM_MODEL", "");
    expect((await loadEnv()).LLM_MODEL.length).toBeGreaterThan(0);
  });
});
