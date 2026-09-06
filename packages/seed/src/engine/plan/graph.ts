import {
  type Descriptor,
  type Fixture,
  fixtureLabel,
  isDescriptor,
  type LoadedFixture,
  type RefBody,
} from "#src/authoring/types"
import type { Catalog } from "#src/engine/plan/catalog"
import { fail } from "#src/errors"

export const KEY_SEPARATOR = "|"

export function refsIn(value: unknown): RefBody[] {
  const found: RefBody[] = []

  const walk = (current: unknown): void => {
    if (isDescriptor(current)) {
      if (current.kind === "ref") found.push(current)
      if (current.kind === "once") walk(current.value)
      return
    }

    if (Array.isArray(current)) {
      for (const entry of current) walk(entry)
      return
    }

    if (current !== null && typeof current === "object") {
      for (const entry of Object.values(current)) walk(entry)
    }
  }

  walk(value)

  return found
}

export function referencedTables(fixture: Fixture): Set<string> {
  const tables = new Set<string>()

  for (const row of fixture.rows) {
    for (const ref of refsIn(row)) tables.add(ref.table)
  }

  return tables
}

function columnsReferencing(fixture: Fixture, target: string): string[] {
  const columns = new Set<string>()

  for (const row of fixture.rows) {
    for (const [column, value] of Object.entries(row)) {
      if (refsIn(value).some((ref) => ref.table === target)) columns.add(column)
    }
  }

  return [...columns]
}

function breakableColumns(
  fixture: LoadedFixture,
  target: string,
  catalog: Catalog
): string[] | undefined {
  const foreignKey = catalog.foreignKeyTo(fixture.table, target)

  const candidates =
    foreignKey && foreignKey.columns.length > 0
      ? foreignKey.columns
      : columnsReferencing(fixture, target)

  if (candidates.length === 0) return undefined

  const nullable = candidates.every(
    (column) => catalog.tryColumn(fixture.table, column)?.nullable === true
  )

  return nullable ? candidates : undefined
}

function dependenciesOf(
  fixture: LoadedFixture,
  catalog: Catalog,
  produced: ReadonlySet<string>
): Set<string> {
  const targets = new Set<string>()

  for (const target of catalog.dependencies(fixture.table)) {
    if (produced.has(target)) targets.add(target)
  }

  for (const target of referencedTables(fixture)) {
    if (target !== fixture.table && produced.has(target)) targets.add(target)
  }

  return targets
}

function findCycle(
  pending: readonly LoadedFixture[],
  dependencies: Map<string, Set<string>>
): string[] {
  const byTable = new Map<string, LoadedFixture[]>()

  for (const fixture of pending) {
    const bucket = byTable.get(fixture.table) ?? []

    bucket.push(fixture)
    byTable.set(fixture.table, bucket)
  }

  const path: string[] = []
  const onPath = new Set<string>()
  const done = new Set<string>()

  const visit = (table: string): string[] | undefined => {
    if (onPath.has(table)) return [...path.slice(path.indexOf(table)), table]
    if (done.has(table)) return undefined

    onPath.add(table)
    path.push(table)

    for (const fixture of byTable.get(table) ?? []) {
      for (const target of dependencies.get(fixtureLabel(fixture)) ?? []) {
        if (!byTable.has(target)) continue

        const cycle = visit(target)

        if (cycle) return cycle
      }
    }

    onPath.delete(table)
    path.pop()
    done.add(table)

    return undefined
  }

  for (const table of byTable.keys()) {
    const cycle = visit(table)

    if (cycle) return cycle
  }

  return [...byTable.keys()]
}

export interface OrderedFixtures {
  ordered: LoadedFixture[]
  deferred: Map<string, string[]>
}

export function orderFixtures(
  fixtures: readonly LoadedFixture[],
  catalog: Catalog
): OrderedFixtures {
  const produced = new Set(fixtures.map((fixture) => fixture.table))

  const outstanding = new Map<string, number>()

  for (const fixture of fixtures) {
    outstanding.set(fixture.table, (outstanding.get(fixture.table) ?? 0) + 1)
  }

  const dependencies = new Map<string, Set<string>>()

  for (const fixture of fixtures) {
    dependencies.set(
      fixtureLabel(fixture),
      dependenciesOf(fixture, catalog, produced)
    )
  }

  const deferred = new Map<string, string[]>()

  const pending = [...fixtures]
  const ordered: LoadedFixture[] = []

  const isReady = (fixture: LoadedFixture): boolean =>
    [...(dependencies.get(fixtureLabel(fixture)) ?? [])].every(
      (target) => (outstanding.get(target) ?? 0) === 0
    )

  while (pending.length > 0) {
    const index = pending.findIndex(isReady)

    if (index === -1) {
      breakCycle(pending, dependencies, deferred, catalog)
      continue
    }

    const [next] = pending.splice(index, 1)

    if (!next) break

    ordered.push(next)
    outstanding.set(next.table, (outstanding.get(next.table) ?? 1) - 1)
  }

  return { ordered, deferred }
}

function breakCycle(
  pending: readonly LoadedFixture[],
  dependencies: Map<string, Set<string>>,
  deferred: Map<string, string[]>,
  catalog: Catalog
): void {
  const cycle = findCycle(pending, dependencies)

  for (let index = 0; index < cycle.length - 1; index += 1) {
    const from = cycle[index]
    const to = cycle[index + 1]

    if (!from || !to) continue

    for (const fixture of pending) {
      if (fixture.table !== from) continue

      const label = fixtureLabel(fixture)

      if (!dependencies.get(label)?.has(to)) continue

      const columns = breakableColumns(fixture, to, catalog)

      if (!columns) continue

      dependencies.get(label)?.delete(to)
      deferred.set(label, [...(deferred.get(label) ?? []), ...columns])

      return
    }
  }

  fail(
    `circular dependency between ${[...new Set(cycle)].join(" → ")} — every foreign key in the cycle is NOT NULL, so nothing can be inserted first. Make one of them nullable, or seed those tables from a single fixture.`
  )
}

function keyOf(row: Record<string, unknown>, key: readonly string[]): string {
  return key.map((column) => String(row[column])).join(KEY_SEPARATOR)
}

export function orderRows(
  fixture: LoadedFixture,
  key: readonly string[]
): number[][] {
  const rows = fixture.rows

  const identity = new Map<string, number>()

  rows.forEach((row, index) => {
    if (key.every((column) => typeof row[column] !== "object")) {
      identity.set(keyOf(row, key), index)
    }
  })

  const blockedBy = rows.map((row) => {
    const blockers = new Set<number>()

    for (const ref of refsIn(row)) {
      if (ref.table !== fixture.table) continue

      const target = identity.get(ref.key.join(KEY_SEPARATOR))

      if (target !== undefined) blockers.add(target)
    }

    return blockers
  })

  if (blockedBy.every((blockers) => blockers.size === 0)) {
    return [rows.map((_, index) => index)]
  }

  const placed = new Set<number>()
  const waves: number[][] = []

  while (placed.size < rows.length) {
    const wave: number[] = []

    rows.forEach((_, index) => {
      if (placed.has(index)) return

      const blockers = blockedBy[index]

      if (!blockers) return

      const ready = [...blockers].every(
        (blocker) => blocker === index || placed.has(blocker)
      )

      if (ready) wave.push(index)
    })

    if (wave.length === 0) {
      fail(
        `${fixtureLabel(fixture)} — rows reference each other in a cycle through "${fixture.table}"`
      )
    }

    for (const index of wave) placed.add(index)

    waves.push(wave)
  }

  return waves
}

export function descriptorsIn(value: unknown): Descriptor[] {
  const found: Descriptor[] = []

  const walk = (current: unknown): void => {
    if (isDescriptor(current)) {
      found.push(current)

      if (current.kind === "once") walk(current.value)

      return
    }

    if (Array.isArray(current)) {
      for (const entry of current) walk(entry)
      return
    }

    if (current !== null && typeof current === "object") {
      for (const entry of Object.values(current)) walk(entry)
    }
  }

  walk(value)

  return found
}
