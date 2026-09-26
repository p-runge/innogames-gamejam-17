import "server-only";

import { z } from "zod";

import { env } from "~/env";

export type GenerateOptions<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Loosened by default: ten personas that sound alike is the failure mode. */
  temperature?: number;
  /**
   * Hard ceiling on generated tokens. Too low is not a truncated field that
   * fails validation, it is a field that ends mid-sentence and still passes:
   * measured at 120, bios came back as "literally just watching my" and replies
   * as "The man cares more than he'd". Callers set this from the length their
   * schema actually allows.
   */
  maxTokens?: number;
};

/** Ollama's chat envelope. The generated JSON arrives as a string inside it. */
const envelopeSchema = z.object({
  message: z.object({ content: z.string() }),
});

/**
 * One generation against the local model, constrained to `schema`.
 *
 * Returns `null` for every failure: the model switched off, a dead container, a
 * non-2xx status, an envelope that is not JSON, generated content that is prose
 * rather than JSON, and JSON that does not satisfy the schema. Callers fall back
 * rather than catch, because none of these are exceptional while a game is
 * running on a CPU-bound model, and a throw here would surface as a broken
 * request instead of a quiet template.
 */
export async function generate<T>({
  system,
  prompt,
  schema,
  temperature = 0.9,
  maxTokens = 220,
}: GenerateOptions<T>): Promise<T | null> {
  if (!env.LLM_ENABLED) return null;

  try {
    const response = await fetch(`${env.LLM_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(env.LLM_TIMEOUT_MS),
      body: JSON.stringify({
        model: env.LLM_MODEL,
        stream: false,
        // Reasoning would multiply the token count, and on a shared CPU that is
        // seconds per reply spent on output nobody reads.
        think: false,
        format: z.toJSONSchema(schema),
        options: {
          temperature,
          num_predict: maxTokens,
          // Small models restate their own phrasing across a round otherwise.
          repeat_penalty: 1.15,
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      // Logged because the alternative is indistinguishable at runtime: a
      // typo'd LLM_MODEL returns 404 here and surfaces only as a feed quietly
      // running on templates, with nothing in the server log saying why.
      console.warn(`llm: ${response.status} from ${env.LLM_BASE_URL}`);
      return null;
    }

    const envelope = envelopeSchema.safeParse(await response.json());
    if (!envelope.success) return null;

    const parsed = schema.safeParse(JSON.parse(envelope.data.message.content));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    // Covers the abort on timeout, a refused connection, a body that is not JSON
    // at all, and content that is not JSON. All mean the same to the caller, but
    // not to whoever is reading the logs wondering where the crowd went.
    console.warn("llm: generation failed", error);
    return null;
  }
}
