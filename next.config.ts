import type { NextConfig } from "next";

// Validates the environment at build time. The import alone is the check.
import "./src/env";

const nextConfig: NextConfig = {
  // Produces .next/standalone with a self-contained server and only the
  // node_modules it actually reaches, which is what the runtime image copies.
  output: "standalone",
};

export default nextConfig;
