import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "seed:integration",
    root: import.meta.dirname,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/setup/container.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
  },
})
