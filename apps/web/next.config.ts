import { join } from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "../.."),
  transpilePackages: ["@workspace/ui", "@workspace/client"],
}

export default nextConfig
