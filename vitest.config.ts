import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      "apps/*/vitest.config.{ts,mts}",
      "apps/*/vitest.integration.config.{ts,mts}",
      "packages/*/vitest.config.{ts,mts}",
      "packages/*/vitest.integration.config.{ts,mts}",
    ],
  },
})
