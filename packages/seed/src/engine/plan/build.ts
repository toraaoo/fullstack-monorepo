import type { TableMetadata } from "#src/adapter/index"
import {
  fixtureLabel,
  isDeterministic,
  type LoadedFixture,
} from "#src/authoring/types"
import type { SeedRow } from "#src/dialect/index"
import type { Catalog } from "#src/engine/plan/catalog"
import { descriptorsIn, orderFixtures, orderRows } from "#src/engine/plan/graph"
import { locate } from "#src/errors"

export interface PlanStep {
  fixture: LoadedFixture
  table: TableMetadata
  rows: SeedRow[]
  key: string[]
  columns: string[]
  updateColumns: string[]
  deferredColumns: string[]
  touchColumn?: string
  waves: number[][]
}

export interface BackfillStep {
  fixture: LoadedFixture
  table: TableMetadata
  rows: SeedRow[]
  key: string[]
  columns: string[]
  touchColumn?: string
}

export interface SeedPlan {
  steps: PlanStep[]
  backfills: BackfillStep[]
  skipped: LoadedFixture[]
  naturalKeys: Map<string, string[]>
}

export interface PlanOptions {
  only?: readonly string[]
}

const TOUCH_COLUMN = "updatedAt"

function normalize(fixture: LoadedFixture, catalog: Catalog): LoadedFixture {
  const where = fixtureLabel(fixture)

  if (!catalog.has(fixture.table)) {
    locate(
      where,
      `targets unknown table "${fixture.table}" — known tables: ${catalog.names().join(", ")}`
    )
  }

  if (fixture.rows.length === 0) locate(where, "has no rows")

  const rows = fixture.rows.map((row, index) => {
    const mapped: SeedRow = {}

    for (const [column, value] of Object.entries(row)) {
      if (value === undefined) continue

      const meta = catalog.tryColumn(fixture.table, column)

      if (!meta) {
        locate(
          where,
          `row ${index} sets "${column}", which is not a column of "${fixture.table}"`
        )
      }

      mapped[meta.name] = value
    }

    return mapped
  })

  return { ...fixture, rows }
}

function presentColumns(fixture: LoadedFixture): Set<string> {
  const present = new Set<string>()

  for (const row of fixture.rows) {
    for (const column of Object.keys(row)) present.add(column)
  }

  return present
}

function volatileColumns(fixture: LoadedFixture): Set<string> {
  const volatile = new Set<string>()

  for (const row of fixture.rows) {
    for (const [column, value] of Object.entries(row)) {
      const unstable = descriptorsIn(value).some(
        (entry) => !isDeterministic(entry)
      )

      if (unstable) volatile.add(column)
    }
  }

  return volatile
}

function matches(fixture: LoadedFixture, only: readonly string[]): boolean {
  if (only.length === 0) return true

  return only.some(
    (needle) =>
      fixture.table === needle ||
      fixture.tier === needle ||
      fixture.file === needle ||
      fixture.file.replace(/\.[^.]+$/, "") === needle
  )
}

function updateColumnsFor(
  fixture: LoadedFixture,
  catalog: Catalog,
  present: ReadonlySet<string>,
  key: readonly string[],
  deferred: readonly string[]
): string[] {
  const excluded = new Set([...key, ...deferred])

  if (fixture.update) {
    return fixture.update
      .map((column) => catalog.physical(fixture.table, column))
      .filter((column) => !excluded.has(column))
  }

  const volatile = volatileColumns(fixture)

  return [...present].filter(
    (column) => !excluded.has(column) && !volatile.has(column)
  )
}

export function buildPlan(
  fixtures: readonly LoadedFixture[],
  catalog: Catalog,
  options: PlanOptions = {}
): SeedPlan {
  const only = options.only ?? []

  const normalized = fixtures.map((fixture) => normalize(fixture, catalog))

  const naturalKeys = new Map<string, string[]>()

  for (const fixture of normalized) {
    const key = catalog.naturalKey(
      fixture.table,
      presentColumns(fixture),
      fixture.key
    )

    for (const column of key) {
      const missing = fixture.rows.findIndex((row) => row[column] === undefined)

      if (missing !== -1) {
        locate(
          fixtureLabel(fixture),
          `row ${missing} is missing "${column}", which is part of the natural key`
        )
      }
    }

    naturalKeys.set(fixture.table, key)
  }

  const selected = normalized.filter((fixture) => matches(fixture, only))

  if (only.length > 0 && selected.length === 0) {
    const available = [
      ...new Set(normalized.flatMap((f) => [f.table, f.tier])),
    ].sort()

    locate("--only", `matched no fixtures — available: ${available.join(", ")}`)
  }

  const { ordered, deferred } = orderFixtures(selected, catalog)

  const steps: PlanStep[] = []
  const backfills: BackfillStep[] = []

  for (const fixture of ordered) {
    const table = catalog.table(fixture.table)
    const present = presentColumns(fixture)
    const key = naturalKeys.get(fixture.table) ?? []

    const deferredColumns = (deferred.get(fixtureLabel(fixture)) ?? []).filter(
      (column) => present.has(column) && !key.includes(column)
    )

    const columns = [...present].filter(
      (column) => !deferredColumns.includes(column)
    )

    const touchColumn = catalog.tryColumn(fixture.table, TOUCH_COLUMN)?.name

    steps.push({
      fixture,
      table,
      rows: fixture.rows,
      key,
      columns,
      updateColumns: updateColumnsFor(
        fixture,
        catalog,
        present,
        key,
        deferredColumns
      ),
      deferredColumns,
      touchColumn,
      waves: orderRows(fixture, key),
    })

    if (deferredColumns.length > 0) {
      backfills.push({
        fixture,
        table,
        rows: fixture.rows,
        key,
        columns: deferredColumns,
        touchColumn,
      })
    }
  }

  return {
    steps,
    backfills,
    skipped: normalized.filter((fixture) => !matches(fixture, only)),
    naturalKeys,
  }
}
