import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone with a self-contained server and only the
  // node_modules it actually reaches, which is what the runtime image copies.
  output: "standalone",
};

export default nextConfig;
