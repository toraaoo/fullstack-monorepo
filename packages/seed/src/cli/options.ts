import { loadConfig, type ResolvedConfig } from "#src/config"
import type { SeedOptions } from "#src/engine/index"
import { fail } from "#src/errors"

export const commonArgs = {
  environment: {
    type: "positional",
    required: false,
    description: "environment tier to apply, e.g. local",
  },
  config: {
    type: "string",
    alias: "c",
    description: "path to seed.config.ts",
  },
  only: {
    type: "string",
    alias: "o",
    description: "limit to these tables, files or tiers",
  },
  seed: {
    type: "string",
    description: "make random values reproducible",
  },
  force: {
    type: "boolean",
    alias: "f",
    description: "allow an environment that does not match NODE_ENV",
  },
  verbose: {
    type: "boolean",
    alias: "v",
    description: "show which columns each fixture overwrites",
  },
  quiet: {
    type: "boolean",
    alias: "q",
    description: "print the summary line only",
  },
} as const

export interface CommonArgs {
  environment?: string
  config?: string
  only?: string | string[]
  seed?: string
  force?: boolean
  verbose?: boolean
  quiet?: boolean
}

function toList(value: string | string[] | undefined): string[] {
  const entries = value === undefined ? [] : [value].flat()

  return entries
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function toSeedOptions(args: CommonArgs): SeedOptions {
  if (args.seed !== undefined && !/^\d+$/.test(args.seed)) {
    fail(`--seed must be a whole number, got "${args.seed}"`)
  }

  return {
    environment: args.environment,
    only: toList(args.only),
    seed: args.seed === undefined ? undefined : Number.parseInt(args.seed, 10),
    force: args.force,
  }
}

export async function withConfig<T>(
  args: CommonArgs,
  run: (config: ResolvedConfig) => Promise<T>
): Promise<T> {
  const config = await loadConfig(process.cwd(), args.config)

  try {
    return await run(config)
  } finally {
    await config.adapter.close()
  }
}

export function warnMissingTiers(missing: readonly string[]): void {
  for (const tier of missing) {
    console.warn(`note: no fixtures directory for tier "${tier}"`)
  }
}
