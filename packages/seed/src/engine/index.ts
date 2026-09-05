import { seedFaker } from "../authoring/faker.js"
import type { LoadedFixture } from "../authoring/types.js"
import type { ResolvedConfig } from "../config.js"
import { resetTables } from "./apply/reset.js"
import { applyPlan, type FixtureResult } from "./apply/upsert.js"
import { loadFixtures } from "./load/fixtures.js"
import { discoverTiers, resolveTiers } from "./load/tiers.js"
import { buildPlan, type SeedPlan } from "./plan/build.js"
import { Catalog } from "./plan/catalog.js"

class Rollback extends Error {}

export type SeedMode = "run" | "diff" | "reset"

export interface SeedOptions {
  environment?: string
  only?: readonly string[]
  seed?: number
  force?: boolean
  mode?: SeedMode
}

export interface SeedPlanResult {
  tiers: string[]
  missingTiers: string[]
  plan: SeedPlan
}

export interface SeedResult extends SeedPlanResult {
  results: FixtureResult[]
  truncated: string[]
  rolledBack: boolean
  elapsedMs: number
}

async function preparePlan(
  config: ResolvedConfig,
  options: SeedOptions
): Promise<SeedPlanResult & { catalog: Catalog }> {
  const tiers = resolveTiers(options.environment, {
    baseTier: config.baseTier,
    protectedEnvironments: config.protectedEnvironments,
    force: options.force,
  })

  const available = await discoverTiers(config.root)
  const missingTiers = tiers.filter((tier) => !available.includes(tier))

  seedFaker(options.seed)

  const fixtures = await loadFixtures(config.root, tiers)
  const catalog = new Catalog(await config.adapter.metadata())

  return {
    tiers,
    missingTiers,
    catalog,
    plan: buildPlan(fixtures, catalog, { only: options.only }),
  }
}

export async function planSeed(
  config: ResolvedConfig,
  options: SeedOptions = {}
): Promise<SeedPlanResult> {
  const { tiers, missingTiers, plan } = await preparePlan(config, options)

  return { tiers, missingTiers, plan }
}

export async function seed(
  config: ResolvedConfig,
  options: SeedOptions = {}
): Promise<SeedResult> {
  const started = Date.now()
  const mode = options.mode ?? "run"

  const { tiers, missingTiers, plan, catalog } = await preparePlan(
    config,
    options
  )

  let results: FixtureResult[] = []
  let truncated: string[] = []
  let rolledBack = false

  try {
    await config.adapter.transaction(async (executor) => {
      if (mode === "reset") {
        truncated = await resetTables(executor, config.adapter.dialect, plan)
      }

      results = await applyPlan(
        executor,
        catalog,
        config.adapter.dialect,
        plan,
        { seed: options.seed, diff: mode === "diff" }
      )

      if (mode === "diff") throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error

    rolledBack = true
  }

  return {
    tiers,
    missingTiers,
    plan,
    results,
    truncated,
    rolledBack,
    elapsedMs: Date.now() - started,
  }
}

export type { FixtureResult, LoadedFixture, SeedPlan }
