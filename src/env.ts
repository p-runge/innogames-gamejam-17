import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Every environment variable the app reads, validated once at build and once at
 * server start. Application code imports `env` from here rather than reaching
 * for the raw process environment, so a missing or malformed value fails
 * immediately and in one place instead of surfacing later as a confusing
 * runtime error.
 */
export const env = createEnv({
  server: {
    /**
     * Where Ollama listens. Inside Compose this is the service name; on a
     * developer machine it is the port `docker-compose.yml` publishes, which is
     * deliberately not 11434 so a locally installed Ollama app keeps working.
     */
    // The protocol is pinned because a bare `z.url()` accepts "ollama:11434" —
    // a valid URL with a scheme fetch cannot use. Without this the misconfigured
    // value passes validation and fails later as a confusing runtime error,
    // which is the exact thing this schema exists to prevent.
    LLM_BASE_URL: z
      .url({ protocol: /^https?$/ })
      .default("http://127.0.0.1:11435"),
    LLM_MODEL: z.string().min(1).default("qwen3.5:4b"),
    /**
     * Off means the game runs on curated personas and templated replies. It is
     * the switch that keeps a broken container from taking the game down.
     */
    LLM_ENABLED: z.stringbool().default(true),
    /** A single generation that outruns this is abandoned, not awaited. */
    LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  },
  emptyStringAsUndefined: true,
  // Required by the Next.js preset even with no client variables: it is where
  // NEXT_PUBLIC_* values would be listed so the bundler can inline them. Every
  // variable here is server-side, so there is nothing to inline.
  experimental__runtimeEnv: {},
});
