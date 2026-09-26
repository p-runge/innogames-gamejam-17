import { afterEach, describe, expect, it, vi } from "vitest";
import { personaSchema } from "~/lib/llm/schemas";
import { FALLBACK_PERSONAS } from "./fallback";

vi.mock("~/lib/llm/client", () => ({ generate: vi.fn() }));
const { generate } = await import("~/lib/llm/client");
const mocked = vi.mocked(generate);

const { CAST_SIZE, generateCast, getCast, resetCast } = await import("./cast");

/** What the model returns: everything but the stance, which the cast supplies. */
function persona(handle: string) {
  return {
    name: "Test Account",
    handle,
    bio: "a bio",
    tic: "says 'mate'",
  };
}

afterEach(() => {
  resetCast();
  vi.resetAllMocks();
});

describe("FALLBACK_PERSONAS", () => {
  it("holds at least a full cast, or a dead model yields a short one", () => {
    expect(FALLBACK_PERSONAS.length).toBeGreaterThanOrEqual(CAST_SIZE);
  });

  it("satisfies the schema the model's output is held to", () => {
    // The project's own data has to pass its own validation, or the fallback
    // path would fail exactly when it is needed.
    for (const member of FALLBACK_PERSONAS) {
      expect(personaSchema.safeParse(member).success).toBe(true);
    }
  });

  it("has no duplicate handles", () => {
    const handles = FALLBACK_PERSONAS.map((p) => p.handle);
    expect(new Set(handles).size).toBe(handles.length);
  });
});

describe("generateCast", () => {
  it("returns CAST_SIZE valid personas when the model cooperates", async () => {
    let n = 0;
    mocked.mockImplementation(async () => persona(`account_${n++}`));
    const cast = await generateCast();
    expect(cast).toHaveLength(CAST_SIZE);
    for (const member of cast) {
      expect(personaSchema.safeParse(member).success).toBe(true);
    }
  });

  it("deduplicates handles the model repeats", async () => {
    // Every generation returns the same handle, which would otherwise leave the
    // feed with ten accounts that render identically and cannot be told apart.
    mocked.mockImplementation(async () => persona("same_handle"));
    const cast = await generateCast();
    expect(new Set(cast.map((p) => p.handle)).size).toBe(cast.length);
    expect(cast).toHaveLength(CAST_SIZE);
  });

  it("fills gaps from the curated list when every generation fails", async () => {
    mocked.mockResolvedValue(null);
    const cast = await generateCast();
    expect(cast).toHaveLength(CAST_SIZE);
    for (const member of cast) {
      expect(personaSchema.safeParse(member).success).toBe(true);
    }
  });

  it("keeps the generated ones and only tops up the rest", async () => {
    let n = 0;
    // Three good generations, then the model gives up.
    mocked.mockImplementation(async () =>
      n < 3 ? persona(`generated_${n++}`) : null,
    );
    const cast = await generateCast();
    expect(cast).toHaveLength(CAST_SIZE);
    expect(cast.filter((p) => p.handle.startsWith("generated_"))).toHaveLength(3);
  });

  it("builds one cast when several callers ask at once", async () => {
    // Every browser tab calls session.start from an effect, and reactToTweet
    // asks too. Without an in-flight guard each caller runs its own ten
    // sequential generations: on four capped cores they all slow each other
    // down, some cross the timeout and are discarded, and the last writer's
    // cast — mostly curated fallbacks by then — overwrites the good one.
    let n = 0;
    mocked.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return persona(`account_${n++}`);
    });

    const [a, b, c] = await Promise.all([
      generateCast(),
      generateCast(),
      generateCast(),
    ]);

    expect(mocked.mock.calls.length).toBe(CAST_SIZE);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("caches the cast so a second call does not regenerate", async () => {
    let n = 0;
    mocked.mockImplementation(async () => persona(`cached_${n++}`));
    const first = await generateCast();
    const calls = mocked.mock.calls.length;
    const second = await generateCast();
    expect(mocked.mock.calls.length).toBe(calls);
    expect(second).toEqual(first);
  });
});

describe("stance", () => {
  it("comes from the archetype, not from the model", async () => {
    // Every generation returns the same thing, and the cast still has a mix. A
    // crowd that is all one stance cheers or jeers through everything.
    let n = 0;
    mocked.mockImplementation(async () => persona(`account_${n++}`));
    const cast = await generateCast();

    const stances = new Set(cast.map((p) => p.stance));
    expect(stances.size).toBeGreaterThan(1);
    expect(cast.every((p) => personaSchema.safeParse(p).success)).toBe(true);
  });

  it("does not ask the model for a stance at all", async () => {
    let n = 0;
    mocked.mockImplementation(async () => persona(`account_${n++}`));
    await generateCast();

    // The schema sent to the model is what constrains its output; leaving
    // stance in it is what let the model pick "bull" ten times.
    const sentSchema = mocked.mock.calls[0][0].schema;
    const parsed = sentSchema.safeParse({
      name: "A Name",
      handle: "a_handle",
      bio: "my portfolio is a crime scene",
      tic: "says 'champ'",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("handle normalisation", () => {
  it("strips the underscores the model puts on the ends", async () => {
    // Told not to, qwen3.5:4b still returned "_markuskillsit_" and "_grimy_84_".
    // They validate, but they read as two handles rather than an account name.
    mocked.mockResolvedValue(persona("_markuskillsit_"));
    const [first] = await generateCast();
    expect(first.handle).toBe("markuskillsit");
  });

  it("keeps underscores inside the handle", async () => {
    mocked.mockResolvedValue(persona("_market_watcher_"));
    const [first] = await generateCast();
    expect(first.handle).toBe("market_watcher");
  });

  it("falls back rather than producing a handle below the minimum", async () => {
    // "___" would normalise to an empty string, which is not a handle at all.
    mocked.mockResolvedValue(persona("___"));
    const cast = await generateCast();
    for (const member of cast) {
      expect(personaSchema.safeParse(member).success).toBe(true);
    }
  });
});

describe("getCast", () => {
  it("is empty before the round starts", () => {
    expect(getCast()).toEqual([]);
  });

  it("returns the generated cast afterwards", async () => {
    mocked.mockResolvedValue(null);
    await generateCast();
    expect(getCast()).toHaveLength(CAST_SIZE);
  });
});
