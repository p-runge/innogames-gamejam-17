import { initTRPC } from "@trpc/server";

const t = initTRPC.create({
  sse: {
    // Traefik closes connections with no traffic, and a quiet stretch of
    // gameplay is indistinguishable from a dead server without these pings.
    ping: { enabled: true, intervalMs: 5_000 },
    client: { reconnectAfterInactivityMs: 15_000 },
  },
});

export const router = t.router;
export const baseProcedure = t.procedure;
