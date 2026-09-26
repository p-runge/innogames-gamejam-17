/**
 * Measures whether the model reads the direction out of a player's post.
 *
 * The crowd's reply moods are decided from this one judgement, so a classifier
 * that leans one way turns every tweet into a push in that direction. Cases are
 * labelled with the answer a player would expect; the ambiguous ones are in on
 * purpose, because grief and sarcasm are what people actually type.
 *
 * Watch the timing as well as the hit rate: this request sits in front of every
 * reaction, so it is latency the player feels before the crowd answers.
 *
 * Usage: pnpm llm:lean
 */
import { z } from "zod";

import { leanSchema } from "../../src/lib/llm/schemas.ts";
import { leanPrompt, LEAN_SYSTEM } from "../../src/lib/npc/prompts.ts";

const BASE_URL = process.env.LLM_BASE_URL ?? "http://127.0.0.1:11435";
const MODEL = process.env.LLM_MODEL ?? "qwen3.5:4b";

const CASES = [
  { want: "up", message: "INNO just landed a huge partnership, earnings look fantastic. This is going way up, I am loading the boat." },
  { want: "down", message: "INNO is finished, the numbers are fake and the CEO is lying. Get out now before it goes to zero." },
  { want: "up", message: "Hold the line everyone, this is a healthy correction." },
  { want: "down", message: "Ascendia Capital just disclosed a short. Respect the pros." },
  { want: "up", message: "textbook cup and handle on the 5m. I am so ready." },
  { want: "up", message: "bought the dip at 1180, you're all welcome" },
  { want: "down", message: "I put my daughter's school money into this" },
  { want: "down", message: "this company is run by clowns and the pension fund is bleeding" },
] as const;

let correct = 0;
let totalMs = 0;

for (const testCase of CASES) {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      think: false,
      format: z.toJSONSchema(leanSchema),
      options: { temperature: 0.2, num_predict: 16 },
      messages: [
        { role: "system", content: LEAN_SYSTEM },
        { role: "user", content: leanPrompt({ username: "You", message: testCase.message }) },
      ],
    }),
  });
  const ms = Date.now() - started;
  totalMs += ms;
  const envelope = await response.json();
  const { lean } = leanSchema.parse(JSON.parse(envelope.message.content));
  const hit = lean === testCase.want;
  if (hit) correct++;
  console.log(`  ${hit ? "ok  " : "MISS"} want=${testCase.want.padEnd(4)} got=${lean.padEnd(4)} ${String(ms).padStart(5)}ms  ${testCase.message.slice(0, 60)}`);
}

console.log(`\n  ${correct}/${CASES.length} correct, mean ${Math.round(totalMs / CASES.length)}ms per call`);
