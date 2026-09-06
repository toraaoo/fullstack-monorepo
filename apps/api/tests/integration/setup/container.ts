import { join } from "node:path"
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import type { TestProject } from "vitest/node"

declare module "vitest" {
  interface ProvidedContext {
    databaseUrl: string
  }
}

const MIGRATIONS = join(__dirname, "../../../db/migrations")

let container: StartedPostgreSqlContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("api_test")
    .withUsername("api")
    .withPassword("api")
    .start()

  const url = container.getConnectionUri()
  const client = postgres(url, { max: 1 })

  try {
    await migrate(drizzle(client, { casing: "snake_case" }), {
      migrationsFolder: MIGRATIONS,
    })
  } finally {
    await client.end()
  }

  project.provide("databaseUrl", url)
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
