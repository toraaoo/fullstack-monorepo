import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql"
import type { TestProject } from "vitest/node"

declare module "vitest" {
  interface ProvidedContext {
    databaseUrl: string
  }
}

let container: StartedPostgreSqlContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("seed_test")
    .withUsername("seed")
    .withPassword("seed")
    .start()

  project.provide("databaseUrl", container.getConnectionUri())
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
