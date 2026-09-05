import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { SeedError } from "./errors"
import { fixtureSchema, type LoadedFixture } from "./types"

export async function discoverTiers(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

async function readTier(root: string, tier: string): Promise<string[]> {
  try {
    const files = await readdir(join(root, tier))

    return files
      .filter((file) => file.endsWith(".json"))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function parse(label: string, contents: string): LoadedFixture {
  let json: unknown

  try {
    json = JSON.parse(contents)
  } catch (error) {
    throw new SeedError(
      `${label} is not valid JSON: ${(error as Error).message}`
    )
  }

  const result = fixtureSchema.safeParse(json)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ")

    throw new SeedError(`${label} is malformed — ${issues}`)
  }

  return result.data as LoadedFixture
}

export async function loadFixtures(
  root: string,
  tiers: readonly string[]
): Promise<LoadedFixture[]> {
  const loaded: LoadedFixture[] = []

  for (const tier of tiers) {
    for (const file of await readTier(root, tier)) {
      const contents = await readFile(join(root, tier, file), "utf8")

      loaded.push({ ...parse(`${tier}/${file}`, contents), tier, file })
    }
  }

  return loaded
}
