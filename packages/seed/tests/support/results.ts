import type { LoadedFixture } from "#src/authoring/types"
import type { FixtureResult, RowChange } from "#src/engine/apply/upsert"
import type { SeedPlanResult, SeedResult } from "#src/engine/index"
import type { PlanStep, SeedPlan } from "#src/engine/plan/build"
import { loaded } from "./fixtures"
import { table } from "./metadata"

export interface StepInput {
  table: string
  tier?: string
  file?: string
  rows?: number
  key?: string[]
  waves?: number[][]
  deferredColumns?: string[]
}

export function step(input: StepInput): PlanStep {
  const rows = Array.from({ length: input.rows ?? 1 }, (_, index) => ({
    id: index,
  }))

  const fixture = loaded(
    { table: input.table, rows },
    { tier: input.tier, file: input.file }
  )

  return {
    fixture,
    table: table(input.table, { columns: { id: true } }),
    rows,
    key: input.key ?? ["slug"],
    columns: [],
    updateColumns: [],
    deferredColumns: input.deferredColumns ?? [],
    waves: input.waves ?? [[0]],
  }
}

export function plan(
  steps: PlanStep[],
  skipped: LoadedFixture[] = []
): SeedPlan {
  return { steps, backfills: [], skipped, naturalKeys: new Map() }
}

export function planResult(
  overrides: Partial<SeedPlanResult> & { plan: SeedPlan }
): SeedPlanResult {
  return { tiers: ["base"], missingTiers: [], ...overrides }
}

export interface ResultInput {
  table: string
  tier?: string
  file?: string
  inserted?: number
  updated?: number
  updateColumns?: string[]
  deferredColumns?: string[]
  changes?: RowChange[]
}

export function fixtureResult(input: ResultInput): FixtureResult {
  return {
    fixture: loaded(
      { table: input.table, rows: [{}] },
      { tier: input.tier, file: input.file }
    ),
    inserted: input.inserted ?? 0,
    updated: input.updated ?? 0,
    updateColumns: input.updateColumns ?? [],
    deferredColumns: input.deferredColumns ?? [],
    changes: input.changes ?? [],
  }
}

export function seedResult(overrides: Partial<SeedResult> = {}): SeedResult {
  return {
    tiers: ["base"],
    missingTiers: [],
    plan: plan([]),
    results: [],
    truncated: [],
    rolledBack: false,
    elapsedMs: 12,
    ...overrides,
  }
}
