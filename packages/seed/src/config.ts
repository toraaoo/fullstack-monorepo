import { stat } from "node:fs/promises"
import { dirname, isAbsolute, join, parse, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { SeedAdapter } from "#src/adapter/index"
import { BASE_TIER } from "#src/engine/load/tiers"
import { fail } from "#src/errors"
import { type Hasher, type HasherRegistry, resolveHashers } from "#src/hashers"

export interface SeedConfig {
  adapter: SeedAdapter
  fixtures?: string
  baseTier?: string
  protectedEnvironments?: string[]
  hashers?: Record<string, Hasher>
}

export type SeedConfigInput =
  | SeedConfig
  | (() => SeedConfig | Promise<SeedConfig>)

export function defineSeedConfig(config: SeedConfigInput): SeedConfigInput {
  return config
}

export interface ResolvedConfig {
  path: string
  root: string
  adapter: SeedAdapter
  baseTier: string
  protectedEnvironments: string[]
  hashers: HasherRegistry
}

const CONFIG_FILES = [
  "seed.config.ts",
  "seed.config.mts",
  "seed.config.js",
  "seed.config.mjs",
]

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function locateConfig(cwd: string): Promise<string> {
  let directory = resolve(cwd)

  const { root } = parse(directory)

  while (true) {
    for (const name of CONFIG_FILES) {
      const candidate = join(directory, name)

      if (await exists(candidate)) return candidate
    }

    if (directory === root) break

    directory = dirname(directory)
  }

  fail(
    `no ${CONFIG_FILES[0]} found in ${cwd} or any parent — create one with defineSeedConfig()`
  )
}

export async function loadConfig(
  cwd: string,
  explicit?: string
): Promise<ResolvedConfig> {
  const path = explicit ? resolve(cwd, explicit) : await locateConfig(cwd)

  if (explicit && !(await exists(path))) fail(`no config file at ${path}`)

  const module = (await import(pathToFileURL(path).href)) as {
    default?: unknown
  }

  const exported = module.default

  if (exported === undefined) {
    fail(`${path} has no default export — export defineSeedConfig({ ... })`)
  }

  const config = (
    typeof exported === "function"
      ? await (exported as () => SeedConfig | Promise<SeedConfig>)()
      : exported
  ) as SeedConfig

  if (!config.adapter) {
    fail(`${path} does not set an adapter`)
  }

  const directory = dirname(path)
  const fixtures = config.fixtures ?? "db/fixtures"

  return {
    path,
    root: isAbsolute(fixtures) ? fixtures : join(directory, fixtures),
    adapter: config.adapter,
    baseTier: config.baseTier ?? BASE_TIER,
    protectedEnvironments: config.protectedEnvironments ?? [
      "staging",
      "production",
    ],
    hashers: resolveHashers(config.hashers),
  }
}
