import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained build output for Docker (see Dockerfile) — bundles only
  // the runtime deps Next's tracing finds actually used, not the full node_modules.
  output: "standalone",
};

export default nextConfig;
