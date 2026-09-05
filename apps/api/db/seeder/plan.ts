import { SeedError } from "./errors"
import type { TableRegistry } from "./registry"
import type { LoadedFixture } from "./types"

export interface SeedPlan {
  selected: LoadedFixture[]
  skipped: LoadedFixture[]
  naturalKeys: Map<string, string[]>
}

function validate(fixture: LoadedFixture, registry: TableRegistry): void {
  const where = `${fixture.tier}/${fixture.file}`

  if (!registry.has(fixture.table)) {
    throw new SeedError(
      `${where} targets unknown table "${fixture.table}" — known tables: ${registry.names().join(", ")}`
    )
  }

  const columns = registry.columnNames(fixture.table)

  for (const column of fixture.conflictTarget) {
    if (!columns.has(column)) {
      throw new SeedError(
        `${where} conflictTarget "${column}" is not a column of "${fixture.table}"`
      )
    }
  }

  for (const column of fixture.update ?? []) {
    if (!columns.has(column)) {
      throw new SeedError(
        `${where} update lists "${column}", which is not a column of "${fixture.table}"`
      )
    }
  }
}

function matches(fixture: LoadedFixture, only: readonly string[]): boolean {
  if (only.length === 0) return true

  return only.some(
    (needle) =>
      fixture.table === needle ||
      fixture.tier === needle ||
      fixture.file === needle ||
      fixture.file.replace(/\.json$/, "") === needle
  )
}

function orderByForeignKeys(
  fixtures: LoadedFixture[],
  registry: TableRegistry
): LoadedFixture[] {
  const outstanding = new Map<string, number>()

  for (const fixture of fixtures) {
    outstanding.set(fixture.table, (outstanding.get(fixture.table) ?? 0) + 1)
  }

  const blockedBy = new Map<string, string[]>()

  for (const table of outstanding.keys()) {
    blockedBy.set(
      table,
      registry.dependencies(table).filter((target) => outstanding.has(target))
    )
  }

  const isReady = (fixture: LoadedFixture): boolean =>
    (blockedBy.get(fixture.table) as string[]).every(
      (dependency) => outstanding.get(dependency) === 0
    )

  const pending = [...fixtures]
  const ordered: LoadedFixture[] = []

  while (pending.length > 0) {
    const index = pending.findIndex(isReady)

    if (index === -1) {
      const cycle = [...new Set(pending.map((fixture) => fixture.table))]

      throw new SeedError(
        `circular foreign keys between ${cycle.join(", ")} — seed those tables from one fixture, or make the column nullable and fill it from a second one`
      )
    }

    const [next] = pending.splice(index, 1)

    ordered.push(next)
    outstanding.set(next.table, (outstanding.get(next.table) as number) - 1)
  }

  return ordered
}

export function planSeed(
  fixtures: LoadedFixture[],
  registry: TableRegistry,
  only: readonly string[] = []
): SeedPlan {
  const naturalKeys = new Map<string, string[]>()

  for (const fixture of fixtures) {
    validate(fixture, registry)
    naturalKeys.set(fixture.table, fixture.conflictTarget)
  }

  const selected = fixtures.filter((fixture) => matches(fixture, only))

  if (only.length > 0 && selected.length === 0) {
    const available = [
      ...new Set(fixtures.flatMap((fixture) => [fixture.table, fixture.tier])),
    ]

    throw new SeedError(
      `--only matched no fixtures — available: ${available.sort().join(", ")}`
    )
  }

  return {
    selected: orderByForeignKeys(selected, registry),
    skipped: fixtures.filter((fixture) => !matches(fixture, only)),
    naturalKeys,
  }
}
