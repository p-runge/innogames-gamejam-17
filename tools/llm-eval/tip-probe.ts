/**
 * Measures whether the informant gives the game away.
 *
 * The whole newsticker rests on one property: the message reports a fact and
 * never what it does to the price. A unit test can pin the prompt's wording but
 * not the model's compliance, and compliance is exactly what a 4B model is bad
 * at — it reaches for the consequence because that is the obvious thing to
 * write. This runs the real prompt across every seed and both directions and
 * counts the leaks.
 *
 * Watch the wording as much as the rate: a model that writes "this changes
 * everything for the share price" is leaking even though no banned word is in
 * it, and the fix is the prompt, not the regex.
 *
 * Usage: pnpm llm:tips
 */
import { z } from "zod";

import { tipSchema } from "../../src/lib/llm/schemas.ts";
import { INFORMANTS } from "../../src/lib/news/informant.ts";
import { TIP_SYSTEM, tipPrompt } from "../../src/lib/news/prompts.ts";
import { TOPIC_SEEDS, type NewsEvent } from "../../src/lib/news/types.ts";

const BASE_URL = process.env.LLM_BASE_URL ?? "http://127.0.0.1:11435";
const MODEL = process.env.LLM_MODEL ?? "qwen3.5:4b";

/**
 * The words the message must never contain. Case-insensitive, whole words.
 *
 * Deliberately excludes `short`, `long` and `stock`: a supply-chain tip says
 * "we're short-staffed", "the line has been down a long time" and "stock on
 * hand" in its ordinary sense, and counting those as leaks would report a
 * working prompt as broken — which costs more than missing a leak, because the
 * answer to a bad number is to go and rewrite the prompt.
 *
 * `share` is kept but bounded to the market senses, for the same reason.
 */
const BANNED =
  /\b(rise|rises|rising|rose|fall|falls|falling|fell|surge|plunge|crash|rally|buy|buying|sell|selling|bullish|bearish|share price|shareholders?|upside|downside|the stock|our stock|its stock)\b/i;

/** Any number followed by a percent sign, however spaced. */
const PERCENT = /\d+(\.\d+)?\s*%/;

const CASES: NewsEvent[] = TOPIC_SEEDS.flatMap((seed) =>
  (["up", "down"] as const).map((direction) => ({
    seed,
    direction,
    strength: "medium" as const,
    credibility: "confirmed" as const,
    pays: true,
    delayMs: 8_000,
  })),
);

let leaked = 0;
let failed = 0;
let totalMs = 0;

for (const [index, event] of CASES.entries()) {
  const informant = INFORMANTS[index % INFORMANTS.length];
  const started = Date.now();

  // Caught rather than left to reject: with no container listening, an
  // unhandled rejection buries the reason under a stack trace, and "is Ollama
  // up?" is the first thing anyone running this needs to know.
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      think: false,
      format: z.toJSONSchema(tipSchema),
      options: { temperature: 0.9, num_predict: 220, repeat_penalty: 1.15 },
      messages: [
        { role: "system", content: TIP_SYSTEM },
        { role: "user", content: tipPrompt(informant, event) },
      ],
    }),
  }).catch((error: unknown) => {
    console.log(`FAIL  ${event.seed}/${event.direction}  ${String(error)}`);
    return null;
  });

  const elapsed = Date.now() - started;
  totalMs += elapsed;

  if (response === null) {
    failed++;
    continue;
  }

  if (!response.ok) {
    failed++;
    console.log(`FAIL  ${event.seed}/${event.direction}  ${response.status}`);
    continue;
  }

  const envelope = await response.json();
  const parsed = tipSchema.safeParse(JSON.parse(envelope.message.content));

  if (!parsed.success) {
    failed++;
    console.log(`FAIL  ${event.seed}/${event.direction}  schema`);
    continue;
  }

  const { body } = parsed.data;
  const leak = body.match(BANNED)?.[0] ?? body.match(PERCENT)?.[0];
  if (leak !== undefined) leaked++;

  console.log(
    `${leak === undefined ? "ok   " : `LEAK ${leak}`}  ${event.seed}/${event.direction}  ${elapsed}ms  ${body}`,
  );
}

const answered = CASES.length - failed;
console.log(
  `\n${leaked}/${answered} answered tips leaked the consequence, ${failed} failed outright, ${Math.round(totalMs / CASES.length)}ms average`,
);
