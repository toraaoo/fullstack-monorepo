import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapter/index.ts",
    "src/adapter/drizzle.ts",
    "src/adapter/postgres.ts",
    "src/dialect/index.ts",
    "src/dialect/postgres.ts",
    "src/cli/main.ts",
  ],
  format: ["esm", "cjs"],
  target: "node22",
  dts: true,
  clean: true,
  splitting: true,
  sourcemap: true,
  external: ["drizzle-orm", "postgres", "citty", "@faker-js/faker"],
})
