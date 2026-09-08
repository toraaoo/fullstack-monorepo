import { execFile } from "node:child_process"
import { join } from "node:path"
import { promisify } from "node:util"
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

const run = promisify(execFile)

const API_ROOT = join(__dirname, "../../..")

let container: StartedPostgreSqlContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("api_test")
    .withUsername("api")
    .withPassword("api")
    .start()

  const url = container.getConnectionUri()

  await run("bunx", ["drizzle-kit", "push", "--force"], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_URL: url, DATABASE_SSL: "false" },
  })

  project.provide("databaseUrl", url)
}

export async function teardown(): Promise<void> {
  await container?.stop()
}
