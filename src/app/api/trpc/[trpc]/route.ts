import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "~/lib/trpc/routers/_app";

// The bus is an in-process EventEmitter and needs a long-lived Node process,
// so this route must not run on the Edge runtime.
export const runtime = "nodejs";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => ({}),
  });
}

export { handler as GET, handler as POST };
