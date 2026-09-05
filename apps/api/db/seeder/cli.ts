import "dotenv/config"
import { resolve } from "node:path"
import { createDatabaseClient } from "@core/database/client"
import { Command } from "commander"
import { SeedError } from "./errors"
import { discoverTiers, loadFixtures } from "./fixtures"
import { formatList, formatRun } from "./output"
import { runSeed } from "./runner"
import { BASE_TIER, FIXTURES_ROOT, PROTECTED_ENVS, TIER_PATTERN } from "./types"

interface Options {
  env?: string
  only: string[]
  dir: string
  dryRun?: boolean
  force?: boolean
  list?: boolean
  verbose?: boolean
  quiet?: boolean
}

function collect(value: string, previous: string[]): string[] {
  const names = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  return [...previous, ...names]
}

function resolveEnvironment(
  positional: string | undefined,
  options: Options
): string | undefined {
  if (positional && options.env && positional !== options.env) {
    throw new SeedError(
      `two environments given, "${positional}" and "${options.env}" — name only one`
    )
  }

  return positional ?? options.env
}

function resolveTiers(
  environment: string | undefined,
  force: boolean
): string[] {
  if (!environment || environment === BASE_TIER) return [BASE_TIER]

  if (!TIER_PATTERN.test(environment)) {
    throw new SeedError(
      `invalid environment "${environment}" — expected a directory name such as local, test or staging`
    )
  }

  const nodeEnv = process.env.NODE_ENV ?? "development"

  if (PROTECTED_ENVS.has(nodeEnv) && environment !== nodeEnv && !force) {
    throw new SeedError(
      `refusing to apply "${environment}" fixtures with NODE_ENV=${nodeEnv} — pass --force if that is really what you want`
    )
  }

  return [BASE_TIER, environment]
}

async function warnMissingTier(root: string, tiers: string[]): Promise<void> {
  const available = await discoverTiers(root)
  const missing = tiers.filter((tier) => !available.includes(tier))

  for (const tier of missing) {
    console.warn(
      `note: no db/fixtures/${tier} directory — available: ${available.join(", ") || "none"}`
    )
  }
}

async function list(root: string, tiers: string[]): Promise<void> {
  await warnMissingTier(root, tiers)

  console.log(formatList(tiers, await loadFixtures(root, tiers)))
}

async function seed(
  root: string,
  tiers: string[],
  options: Options
): Promise<void> {
  await warnMissingTier(root, tiers)

  const url = process.env.DATABASE_URL

  if (!url) throw new SeedError("DATABASE_URL is required to seed")

  const db = createDatabaseClient({
    url,
    max: 1,
    ssl: process.env.DATABASE_SSL === "true",
    prepare: process.env.DATABASE_PREPARE !== "false",
  })

  try {
    const result = await runSeed(db, {
      root,
      tiers,
      only: options.only,
      dryRun: options.dryRun,
    })

    if (result.results.length === 0) {
      console.log(`no fixtures found in ${root} for ${tiers.join(", ")}`)
      return
    }

    const report = formatRun(result, options.verbose === true)

    console.log(options.quiet ? (report.split("\n").pop() as string) : report)
  } finally {
    await db.$client.end({ timeout: 5 })
  }
}

const program = new Command()

program
  .name("db:seed")
  .description(
    `Seed the database from JSON fixtures.\n\nAlways applies db/fixtures/${BASE_TIER}. Naming an environment also applies db/fixtures/<environment>.`
  )
  .argument("[environment]", "environment tier to apply, e.g. local")
  .option("-e, --env <name>", "same as the positional argument")
  .option(
    "-o, --only <names>",
    "limit to these tables, files or tiers",
    collect,
    []
  )
  .option("-d, --dir <path>", "fixture root", FIXTURES_ROOT)
  .option("-n, --dry-run", "apply inside a transaction, then roll back")
  .option("-f, --force", "allow an environment that does not match NODE_ENV")
  .option("-l, --list", "list the fixtures that would run, then exit")
  .option("-v, --verbose", "show which columns each fixture overwrites")
  .option("-q, --quiet", "print the summary line only")
  .addHelpText(
    "after",
    `
Examples:
  $ bun run db:seed                     ${BASE_TIER} only
  $ bun run db:seed local               ${BASE_TIER} + local
  $ bun run db:seed local -n            dry run, nothing committed
  $ bun run db:seed local -o example_items
  $ bun run db:seed -l                  what would run, without connecting`
  )
  .showSuggestionAfterError()
  .action(async (positional: string | undefined, options: Options) => {
    const environment = resolveEnvironment(positional, options)
    const tiers = resolveTiers(environment, options.force === true)
    const root = resolve(process.cwd(), options.dir)

    await (options.list ? list(root, tiers) : seed(root, tiers, options))
  })

program.parseAsync().catch((error: unknown) => {
  console.error(
    error instanceof SeedError ? `seed failed: ${error.message}` : error
  )

  process.exitCode = 1
})
