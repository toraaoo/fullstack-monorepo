import { readdir } from "node:fs/promises"
import { fail } from "../../errors.js"

export const BASE_TIER = "base"

export const TIER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i

export async function discoverTiers(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

export interface TierOptions {
  baseTier?: string
  protectedEnvironments?: readonly string[]
  nodeEnv?: string
  force?: boolean
}

export function resolveTiers(
  environment: string | undefined,
  options: TierOptions = {}
): string[] {
  const base = options.baseTier ?? BASE_TIER

  if (!environment || environment === base) return [base]

  if (!TIER_PATTERN.test(environment)) {
    fail(
      `invalid environment "${environment}" — expected a directory name such as local or test`
    )
  }

  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? "development"
  const protectedEnvironments = options.protectedEnvironments ?? []

  if (
    protectedEnvironments.includes(nodeEnv) &&
    environment !== nodeEnv &&
    options.force !== true
  ) {
    fail(
      `refusing to apply "${environment}" fixtures with NODE_ENV=${nodeEnv} — pass --force if that is really what you want`
    )
  }

  return [base, environment]
}
