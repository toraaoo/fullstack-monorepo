import { defineConfig } from "tsup"

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/i18n/index.ts",
    "src/http/index.ts",
    "src/health/index.ts",
    "src/access/index.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  outDir: "dist",
})
