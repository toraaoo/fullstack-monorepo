import { join } from "node:path"
import type { PgColumn } from "drizzle-orm/pg-core"
import { z } from "zod"

export const BASE_TIER = "base"

export const TIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i

export const PROTECTED_ENVS = new Set(["staging", "production"])

export const FIXTURES_ROOT = join(__dirname, "..", "fixtures")

export const fixtureSchema = z
  .object({
    table: z.string().min(1),
    description: z.string().optional(),
    conflictTarget: z.array(z.string().min(1)).min(1),
    update: z.array(z.string().min(1)).optional(),
    rows: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .strict()

export type Fixture = z.infer<typeof fixtureSchema>

export interface LoadedFixture extends Fixture {
  tier: string
  file: string
}

export type Row = Record<string, unknown>

export type ColumnMap = Record<string, PgColumn>

export interface ResolvedValue {
  value: unknown
  deterministic: boolean
}

export interface PlaceholderContext {
  now: Date
  lookupRef: (table: string, key: string, column: string) => Promise<unknown>
}

export type Placeholder = (
  argument: string | undefined,
  context: PlaceholderContext
) => ResolvedValue | Promise<ResolvedValue>

export interface SeedFileResult {
  tier: string
  file: string
  table: string
  inserted: number
  updated: number
  updatedColumns: string[]
}

export interface SeedRunResult {
  results: SeedFileResult[]
  skipped: LoadedFixture[]
  dryRun: boolean
  elapsedMs: number
}

export interface SeedRunOptions {
  root: string
  tiers: readonly string[]
  only?: readonly string[]
  dryRun?: boolean
}
