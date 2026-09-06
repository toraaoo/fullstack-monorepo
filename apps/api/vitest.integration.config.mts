import swc from "unplugin-swc"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    name: "api:integration",
    root: import.meta.dirname,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/setup/container.ts"],
    setupFiles: ["tests/integration/setup/env.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
})
