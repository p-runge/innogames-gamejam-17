/**
 * Measures whether the crowd's moods are balanced, and whether the player's
 * tweet reaches them at all.
 *
 * The mood is the only channel a post has into the price, so a bias here is a
 * round that trends one way whatever anyone does. Three conditions, one cast,
 * one market context: chatter with no player, a strongly bullish player tweet,
 * and a strongly bearish one. Read the summed drift — the three should sit near
 * zero and the two tweets should differ from each other and from the chatter.
 *
 * Imports the game's real prompts and schema rather than copies, so what it
 * measures is what the game sends. `FALLBACK_PERSONAS` stands in for a generated
 * cast on purpose: a fixed cast is what makes two runs comparable.
 *
 * Standalone otherwise, like run.ts: it talks to Ollama over HTTP and does not
 * import the env schema, which is the documented exception for an isolated CLI
 * process.
 *
 * Usage: pnpm llm:moods
 */
import { z } from "zod";

import { replySchema } from "../../src/lib/llm/schemas.ts";
import { FALLBACK_PERSONAS } from "../../src/lib/npc/fallback.ts";
import { MOOD_DRIFT as DRIFT } from "./suite.ts";
import {
  ambientPrompt,
  reactionPrompt,
  REPLY_SYSTEM,
} from "../../src/lib/npc/prompts.ts";

const BASE_URL = process.env.LLM_BASE_URL ?? "http://127.0.0.1:11435";
const MODEL = process.env.LLM_MODEL ?? "qwen3.5:4b";
const CONTEXT = "INNO has barely moved for several minutes.";

const TWEETS = [
  {
    label: "player is strongly positive",
    lean: "up",
    message:
      "INNO just landed a huge partnership, earnings look fantastic. This is going way up, I am loading the boat.",
  },
  {
    label: "player is strongly negative",
    lean: "down",
    message:
      "INNO is finished, the numbers are fake and the CEO is lying. Get out now before it goes to zero.",
  },
] as const;

async function ask(prompt: string) {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      think: false,
      format: z.toJSONSchema(replySchema),
      options: { temperature: 0.9, num_predict: 220, repeat_penalty: 1.15 },
      messages: [
        { role: "system", content: REPLY_SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  const envelope = await response.json();
  return replySchema.parse(JSON.parse(envelope.message.content));
}

async function ambient() {
  const moods: string[] = [];
  let impulse = 0;
  console.log(`\n### no player at all (ambient chatter, flat market)\n`);

  for (const persona of FALLBACK_PERSONAS) {
    try {
      const reply = await ask(ambientPrompt(persona, CONTEXT, []));
      moods.push(reply.mood);
      impulse += DRIFT[reply.mood];
      console.log(
        `  ${reply.mood.padEnd(8)} ${persona.stance.padEnd(6)} @${persona.handle.padEnd(15)} ${reply.body.slice(0, 80)}`,
      );
    } catch (error) {
      console.log(`  FAILED   @${persona.handle}: ${String(error).slice(0, 60)}`);
    }
  }

  const counts: Record<string, number> = {};
  for (const m of moods) counts[m] = (counts[m] ?? 0) + 1;
  console.log(`\n  moods: ${JSON.stringify(counts)}`);
  console.log(`  summed drift: ${impulse.toFixed(4)} (negative = sells off)`);
}

async function main() {
  await ambient();
  for (const tweet of TWEETS) {
    const moods: string[] = [];
    let impulse = 0;
    console.log(`\n### ${tweet.label}\n"${tweet.message}"\n`);

    for (const persona of FALLBACK_PERSONAS) {
      const prompt = reactionPrompt(
        persona,
        CONTEXT,
        { username: "You", message: tweet.message },
        [],
        tweet.lean,
      );
      try {
        const reply = await ask(prompt);
        moods.push(reply.mood);
        impulse += DRIFT[reply.mood];
        console.log(
          `  ${reply.mood.padEnd(8)} ${persona.stance.padEnd(6)} @${persona.handle.padEnd(15)} ${reply.body.slice(0, 90)}`,
        );
      } catch (error) {
        console.log(`  FAILED   @${persona.handle}: ${String(error).slice(0, 80)}`);
      }
    }

    const counts: Record<string, number> = {};
    for (const m of moods) counts[m] = (counts[m] ?? 0) + 1;
    console.log(`\n  moods: ${JSON.stringify(counts)}`);
    console.log(`  summed drift: ${impulse.toFixed(4)} (negative = sells off)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
