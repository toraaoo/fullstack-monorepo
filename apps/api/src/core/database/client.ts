import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres, { type Sql } from "postgres"
import * as schema from "./schema"

export const DATABASE_CASING = "snake_case"

export type DrizzleSchema = typeof schema

export type DrizzleDatabase = PostgresJsDatabase<DrizzleSchema> & {
  $client: Sql
}

export type DatabaseExecutor =
  | DrizzleDatabase
  | Parameters<Parameters<DrizzleDatabase["transaction"]>[0]>[0]

export interface DatabaseClientOptions {
  url: string
  max?: number
  ssl?: boolean
  prepare?: boolean
  onQuery?: (query: string, params: unknown[]) => void
}

export function createDatabaseClient(
  options: DatabaseClientOptions
): DrizzleDatabase {
  const client = postgres(options.url, {
    max: options.max,
    ssl: options.ssl,
    prepare: options.prepare,
  })

  return drizzle(client, {
    schema,
    casing: DATABASE_CASING,
    logger: options.onQuery ? { logQuery: options.onQuery } : false,
  })
}
