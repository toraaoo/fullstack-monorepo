import type { SeedExecutor } from "#src/adapter/index"
import { fixtureLabel, type LoadedFixture } from "#src/authoring/types"
import type { Dialect, SeedRow } from "#src/dialect/index"
import {
  createRandomSource,
  type RefRequest,
  type ResolveContext,
  resolveRow,
} from "#src/engine/apply/resolve"
import type { SeedPlan } from "#src/engine/plan/build"
import type { Catalog } from "#src/engine/plan/catalog"
import { KEY_SEPARATOR } from "#src/engine/plan/graph"
import { fail } from "#src/errors"

export interface ColumnChange {
  column: string
  before: unknown
  after: unknown
}

export interface RowChange {
  key: string
  kind: "insert" | "update" | "unchanged"
  columns: ColumnChange[]
}

export interface FixtureResult {
  fixture: LoadedFixture
  inserted: number
  updated: number
  updateColumns: string[]
  deferredColumns: string[]
  changes: RowChange[]
}

export interface ApplyOptions {
  seed?: number
  diff?: boolean
}

function keyOf(row: SeedRow, columns: readonly string[]): string {
  return columns.map((column) => String(row[column])).join(KEY_SEPARATOR)
}

function sameDate(left: unknown, right: unknown): boolean {
  const at = (value: unknown) =>
    value instanceof Date ? value.getTime() : new Date(String(value)).getTime()

  const [first, second] = [at(left), at(right)]

  return Number.isNaN(first) || Number.isNaN(second)
    ? String(left) === String(right)
    : first === second
}

function same(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (left == null || right == null) return left == null && right == null

  if (left instanceof Date || right instanceof Date) {
    return sameDate(left, right)
  }

  if (Buffer.isBuffer(left) || Buffer.isBuffer(right)) {
    return Buffer.isBuffer(left) && Buffer.isBuffer(right) && left.equals(right)
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => same(entry, right[index]))
    )
  }

  if (typeof left === "object" && typeof right === "object") {
    const target = right as Record<string, unknown>
    const source = left as Record<string, unknown>

    const keys = Object.keys(source)

    return (
      keys.length === Object.keys(target).length &&
      keys.every((key) => key in target && same(source[key], target[key]))
    )
  }

  return String(left) === String(right)
}

class RowLookup {
  private readonly seen = new Map<string, SeedRow>()

  constructor(
    private readonly executor: SeedExecutor,
    private readonly catalog: Catalog,
    private readonly dialect: Dialect,
    private readonly naturalKeys: Map<string, string[]>
  ) {}

  remember(table: string, key: string, row: SeedRow): void {
    this.seen.set(`${table} ${key}`, row)
  }

  find = async (request: RefRequest): Promise<unknown> => {
    const column = this.targetColumn(request)
    const key = request.key.join(KEY_SEPARATOR)

    const row =
      this.seen.get(`${request.table} ${key}`) ??
      (await this.select(request.table, request.key))

    if (!(column in row)) {
      fail(
        `ref("${request.table}", "${key}") — no column "${column}" on that row`
      )
    }

    return row[column]
  }

  private targetColumn(request: RefRequest): string {
    if (request.column) {
      return this.catalog.physical(request.table, request.column)
    }

    if (request.from) {
      const foreignKey = this.catalog.foreignKeyForColumn(
        request.from.table,
        request.from.column
      )

      if (foreignKey?.table === request.table) {
        const target = foreignKey.foreignColumns[0]

        if (target) return target
      }
    }

    const primary = this.catalog.table(request.table).primaryKey[0]

    if (!primary) {
      fail(
        `ref("${request.table}", ...) — "${request.table}" has no primary key, so name the column explicitly`
      )
    }

    return primary
  }

  private async select(
    table: string,
    key: readonly string[]
  ): Promise<SeedRow> {
    const naturalKey = this.naturalKeys.get(table)

    if (!naturalKey) {
      fail(
        `ref("${table}", ...) — no fixture in this run declares a natural key for "${table}", so its rows cannot be looked up`
      )
    }

    if (naturalKey.length !== key.length) {
      fail(
        `ref("${table}", ...) — natural key is (${naturalKey.join(", ")}), so pass ${naturalKey.length} value(s)`
      )
    }

    const meta = this.catalog.table(table)

    const [row] = await this.executor.run(
      this.dialect.select({
        table: meta,
        columns: meta.columns.map((column) => column.name),
        keyColumns: naturalKey,
        keys: [[...key]],
      })
    )

    if (!row) {
      fail(
        `ref("${table}", "${key.join(KEY_SEPARATOR)}") found no row — seed "${table}" first, or widen --only`
      )
    }

    this.remember(table, key.join(KEY_SEPARATOR), row)

    return row
  }
}

export async function applyPlan(
  executor: SeedExecutor,
  catalog: Catalog,
  dialect: Dialect,
  plan: SeedPlan,
  options: ApplyOptions = {}
): Promise<FixtureResult[]> {
  const lookup = new RowLookup(executor, catalog, dialect, plan.naturalKeys)
  const random = createRandomSource(options.seed)
  const now = new Date()

  const results: FixtureResult[] = []

  for (const step of plan.steps) {
    const context: ResolveContext = {
      now,
      random,
      directory: step.fixture.directory,
      lookupRef: lookup.find,
    }

    const returning = step.table.columns.map((column) => column.name)

    let inserted = 0
    let updated = 0

    const changes: RowChange[] = []

    for (const wave of step.waves) {
      const rows: SeedRow[] = []

      for (const index of wave) {
        const source = step.rows[index]

        if (!source) continue

        rows.push(
          await resolveRow(source, step.columns, step.fixture.table, context)
        )
      }

      if (rows.length === 0) continue

      if (options.diff) {
        changes.push(
          ...(await diffWave(executor, dialect, step, rows, returning))
        )
      }

      const returned = await executor.run(
        dialect.upsert({
          table: step.table,
          columns: step.columns,
          rows,
          conflictColumns: step.key,
          updateColumns: step.updateColumns,
          touchColumn: step.touchColumn,
          returning,
        })
      )

      for (const row of returned) {
        if (row[dialect.insertedColumn] === true) inserted += 1
        else updated += 1

        lookup.remember(step.fixture.table, keyOf(row, step.key), row)
      }
    }

    results.push({
      fixture: step.fixture,
      inserted,
      updated,
      updateColumns: step.updateColumns,
      deferredColumns: step.deferredColumns,
      changes,
    })
  }

  for (const backfill of plan.backfills) {
    const context: ResolveContext = {
      now,
      random,
      directory: backfill.fixture.directory,
      lookupRef: lookup.find,
    }

    for (const source of backfill.rows) {
      const values = await resolveRow(
        source,
        backfill.columns,
        backfill.fixture.table,
        context
      )

      if (Object.keys(values).length === 0) continue

      const where: SeedRow = {}

      for (const column of backfill.key) where[column] = source[column]

      await executor.run(
        dialect.update({
          table: backfill.table,
          values,
          where,
          touchColumn: backfill.touchColumn,
        })
      )
    }
  }

  return results
}

async function diffWave(
  executor: SeedExecutor,
  dialect: Dialect,
  step: SeedPlan["steps"][number],
  rows: readonly SeedRow[],
  returning: readonly string[]
): Promise<RowChange[]> {
  const keys = rows.map((row) => step.key.map((column) => row[column]))

  const existing = await executor.run(
    dialect.select({
      table: step.table,
      columns: [...returning],
      keyColumns: step.key,
      keys,
    })
  )

  const before = new Map(
    existing.map((row) => [keyOf(row, step.key), row] as const)
  )

  return rows.map((row) => {
    const key = keyOf(row, step.key)
    const found = before.get(key)

    if (!found) return { key, kind: "insert", columns: [] }

    const columns = step.updateColumns
      .filter((column) => !same(found[column], row[column]))
      .map((column) => ({
        column,
        before: found[column],
        after: row[column],
      }))

    return {
      key,
      kind: columns.length > 0 ? "update" : "unchanged",
      columns,
    }
  })
}

export function resultLabel(result: FixtureResult): string {
  return fixtureLabel(result.fixture)
}
