import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import type { Fixture, LoadedFixture } from "../../authoring/types.js"
import { locate } from "../../errors.js"

const MODULE_PATTERN = /\.(ts|mts|cts|js|mjs|cjs)$/

function isFixtureModule(file: string): boolean {
  return (
    MODULE_PATTERN.test(file) &&
    !file.startsWith("_") &&
    !file.endsWith(".d.ts")
  )
}

async function tierFiles(root: string, tier: string): Promise<string[]> {
  try {
    const files = await readdir(join(root, tier))

    return files
      .filter(isFixtureModule)
      .sort((left, right) => left.localeCompare(right))
  } catch {
    return []
  }
}

function assertFixture(value: unknown, where: string): Fixture {
  if (typeof value !== "object" || value === null) {
    locate(
      where,
      "has no default export, or exports something that is not a fixture"
    )
  }

  const fixture = value as Partial<Fixture>

  if (typeof fixture.table !== "string" || fixture.table.length === 0) {
    locate(
      where,
      "default export is missing a table name — use defineFixture()"
    )
  }

  if (!Array.isArray(fixture.rows)) {
    locate(where, "default export has no rows array — use defineFixture()")
  }

  fixture.rows.forEach((row, index) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      locate(where, `row ${index} is not an object`)
    }
  })

  return fixture as Fixture
}

export async function loadFixtures(
  root: string,
  tiers: readonly string[]
): Promise<LoadedFixture[]> {
  const loaded: LoadedFixture[] = []

  for (const tier of tiers) {
    const directory = join(root, tier)

    for (const file of await tierFiles(root, tier)) {
      const where = `${tier}/${file}`

      const module = (await import(
        pathToFileURL(join(directory, file)).href
      )) as { default?: unknown }

      loaded.push({
        ...assertFixture(module.default, where),
        tier,
        file,
        directory,
      })
    }
  }

  return loaded
}
