/**
 * Runs one candidate model against the suite and writes a Markdown transcript
 * for reading by hand.
 *
 * It imports the game's real prompts and schemas rather than copies of them, so
 * what it measures is what the game sends. Those imports resolve because every
 * path it reaches is either plain TypeScript or a type-only import, which Node
 * strips — nothing under src/lib/npc/prompts.ts pulls in a runtime dependency.
 *
 * Standalone otherwise: it talks to Ollama over HTTP and does not import the env
 * schema, which is the documented exception for an isolated CLI process.
 *
 * Usage: pnpm llm:eval qwen3.5:4b
 */
import { mkdir, writeFile } from "node:fs/promises";

import { personaDraftSchema, replySchema } from "../../src/lib/llm/schemas.ts";
import {
  PERSONA_SYSTEM,
  personaPrompt,
  personaStance,
  reactionPrompt,
  REPLY_SYSTEM,
} from "../../src/lib/npc/prompts.ts";
import { REPLY_CASES } from "./suite.ts";
import { z } from "zod";

const BASE_URL = process.env.LLM_BASE_URL ?? "http://127.0.0.1:11435";
const CAST_SIZE = 5;

const model = process.argv[2];
if (!model) {
  console.error("usage: pnpm llm:eval <model>");
  process.exit(1);
}

type Asked = { raw: string; seconds: number };

async function ask(
  system: string,
  prompt: string,
  schema: z.ZodType,
): Promise<Asked> {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: z.toJSONSchema(schema),
      options: { temperature: 0.9, num_predict: 220, repeat_penalty: 1.15 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  const seconds = (Date.now() - started) / 1000;
  if (!response.ok) return { raw: `HTTP ${response.status}`, seconds };

  const body = (await response.json()) as { message?: { content?: string } };
  return { raw: body.message?.content ?? "(empty)", seconds };
}

/** Reports whether the output would survive the game's own validation. */
function verdict(raw: string, schema: z.ZodType): string {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? "schema ok" : `SCHEMA FAIL: ${parsed.error.message}`;
  } catch {
    return "NOT JSON";
  }
}

async function main() {
  const lines = [`# ${model}`, ""];
  const timings: number[] = [];

  lines.push("## Personas", "");
  const personas = [];

  for (let index = 0; index < CAST_SIZE; index++) {
    const { raw, seconds } = await ask(
      PERSONA_SYSTEM,
      personaPrompt(index),
      personaDraftSchema,
    );
    timings.push(seconds);
    lines.push(
      `### persona ${index} — stance ${personaStance(index)} (${seconds.toFixed(1)}s, ${verdict(raw, personaDraftSchema)})`,
      "",
      "```json",
      raw,
      "```",
      "",
    );

    // Combined exactly as the cast does it: the model writes the voice, the
    // archetype supplies the stance.
    const parsed = personaDraftSchema.safeParse(JSON.parse(raw || "{}"));
    if (parsed.success) {
      personas.push({ ...parsed.data, stance: personaStance(index) });
    }
  }

  lines.push("## Replies", "");

  // Answered by a generated persona where there is one, so the transcript shows
  // the same voice the game would use rather than an invented stand-in.
  for (const [index, item] of REPLY_CASES.entries()) {
    const persona = personas[index % Math.max(personas.length, 1)];
    if (persona === undefined) {
      lines.push(`### ${item.label}`, "", "_no persona parsed_", "");
      continue;
    }

    const prompt = reactionPrompt(persona, item.context, {
      username: "you",
      message: item.tweet,
    });
    const { raw, seconds } = await ask(REPLY_SYSTEM, prompt, replySchema);
    timings.push(seconds);

    lines.push(
      `### ${item.label}`,
      "",
      `As @${persona.handle} · ${item.context} · post: "${item.tweet}"`,
      "",
      `(${seconds.toFixed(1)}s, ${verdict(raw, replySchema)})`,
      "",
      "```json",
      raw,
      "```",
      "",
    );
  }

  const total = timings.reduce((sum, s) => sum + s, 0);
  const slowest = Math.max(...timings);
  lines.push(
    "## Timing",
    "",
    `${timings.length} generations, ${total.toFixed(1)}s total, ${(total / timings.length).toFixed(2)}s mean, ${slowest.toFixed(2)}s slowest.`,
    "",
  );

  await mkdir(".private/llm-eval", { recursive: true });
  const path = `.private/llm-eval/${model.replace(/[^a-z0-9.-]/gi, "_")}.md`;
  await writeFile(path, lines.join("\n"), "utf8");
  console.log(
    `wrote ${path} — ${timings.length} generations, ${(total / timings.length).toFixed(2)}s mean`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
