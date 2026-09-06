import { drizzle } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"
import { afterAll, inject } from "vitest"
import { drizzleAdapter } from "#src/adapter/drizzle"
import type { SeedAdapter } from "#src/adapter/index"
import { postgresAdapter } from "#src/adapter/postgres"
import type { ResolvedConfig } from "#src/config"
import { DDL, schema } from "./schema"

let sequence = 0

export function timestamp(value: unknown): number {
  if (!(value instanceof Date)) {
    throw new TypeError(`expected a Date, got ${String(value)}`)
  }

  return value.getTime()
}

export function first<T>(rows: T[]): T {
  const [row] = rows

  if (row === undefined) throw new Error("expected at least one row")

  return row
}

export interface TestDatabase {
  name: string
  verify: Sql
  drizzleAdapter: SeedAdapter
  postgresAdapter: SeedAdapter
  rows(table: string, orderBy?: string): Promise<Record<string, unknown>[]>
  count(table: string): Promise<number>
  config(root: string, overrides?: Partial<ResolvedConfig>): ResolvedConfig
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const url = inject("databaseUrl")

  sequence += 1

  const name = `s${process.pid.toString(36)}_${sequence}`

  const connect = () =>
    postgres(url, {
      max: 1,
      connection: { search_path: name },
      onnotice: () => {},
    })

  const admin = postgres(url, { max: 1 })

  await admin.unsafe(`CREATE SCHEMA "${name}"`)
  await admin.end({ timeout: 5 })

  const verify = connect()

  await verify.unsafe(DDL)

  const forDrizzle = connect()
  const forPostgres = connect()

  const db = drizzle(forDrizzle, { schema, casing: "snake_case" })

  const database: TestDatabase = {
    name,
    verify,

    drizzleAdapter: drizzleAdapter({ db, schema, casing: "snake_case" }),
    postgresAdapter: postgresAdapter({ client: forPostgres }),

    async rows(table, orderBy = "created_at") {
      const found = await verify`
        SELECT * FROM ${verify(table)} ORDER BY ${verify(orderBy)}
      `

      return found as unknown as Record<string, unknown>[]
    },

    async count(table) {
      const [row] = await verify`
        SELECT COUNT(*)::int AS n FROM ${verify(table)}
      `

      return (row as { n: number }).n
    },

    config(root, overrides = {}) {
      return {
        path: `${root}/seed.config.ts`,
        root,
        adapter: database.drizzleAdapter,
        baseTier: "base",
        protectedEnvironments: ["staging", "production"],
        ...overrides,
      }
    },
  }

  afterAll(async () => {
    await Promise.all([
      verify.end({ timeout: 5 }),
      forDrizzle.end({ timeout: 5 }),
      forPostgres.end({ timeout: 5 }),
    ])

    const cleanup = postgres(url, { max: 1 })

    await cleanup.unsafe(`DROP SCHEMA IF EXISTS "${name}" CASCADE`)
    await cleanup.end({ timeout: 5 })
  })

  return database
}
