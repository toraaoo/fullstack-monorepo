import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      "apps/*/vitest.config.ts",
      "apps/*/vitest.integration.config.ts",
      "packages/*/vitest.config.ts",
      "packages/*/vitest.integration.config.ts",
    ],
  },
})
