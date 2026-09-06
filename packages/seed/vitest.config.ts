import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "seed",
    root: import.meta.dirname,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/cli/main.ts"],
    },
  },
})
