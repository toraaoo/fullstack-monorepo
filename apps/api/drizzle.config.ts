import "dotenv/config"
import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error("DATABASE_URL is required to run drizzle-kit")
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/core/database/database.schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url,
    ssl: process.env.DATABASE_SSL === "true",
  },
  strict: true,
  verbose: true,
})
