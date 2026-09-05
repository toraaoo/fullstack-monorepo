import "dotenv/config"
import { createDatabaseClient, DATABASE_CASING } from "@core/database/client"
import * as schema from "@core/database/schema"
import { defineSeedConfig } from "@workspace/seed"
import { drizzleAdapter } from "@workspace/seed/drizzle"

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error("DATABASE_URL is required to seed")
}

const db = createDatabaseClient({
  url,
  max: 1,
  ssl: process.env.DATABASE_SSL === "true",
  prepare: process.env.DATABASE_PREPARE !== "false",
})

export default defineSeedConfig({
  fixtures: "db/fixtures",
  protectedEnvironments: ["staging", "production"],
  adapter: drizzleAdapter({
    db,
    schema,
    casing: DATABASE_CASING,
    close: () => db.$client.end({ timeout: 5 }),
  }),
})
