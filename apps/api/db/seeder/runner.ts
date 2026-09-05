import type { DatabaseExecutor, DrizzleDatabase } from "@core/database/client"
import { sql } from "drizzle-orm"
import { SeedDirectiveError, SeedError } from "./errors"
import { loadFixtures } from "./fixtures"
import { KEY_SEPARATOR, RowLookup } from "./lookup"
import { resolveValue } from "./placeholders"
import { planSeed } from "./plan"
import { TableRegistry } from "./registry"
import type {
  LoadedFixture,
  PlaceholderContext,
  Row,
  SeedFileResult,
  SeedRunOptions,
  SeedRunResult,
} from "./types"

const INSERTED = "__inserted"

class Rollback extends Error {}

interface ResolvedRows {
  values: Row[]
  present: Set<string>
  volatile: Set<string>
}

async function resolveRows(
  fixture: LoadedFixture,
  registry: TableRegistry,
  context: PlaceholderContext
): Promise<ResolvedRows> {
  const where = `${fixture.tier}/${fixture.file}`
  const columns = registry.columnNames(fixture.table)

  const values: Row[] = []
  const present = new Set<string>()
  const volatile = new Set<string>()

  for (const [index, raw] of fixture.rows.entries()) {
    const row: Row = {}

    for (const [column, value] of Object.entries(raw)) {
      if (!columns.has(column)) {
        throw new SeedError(
          `${where} row ${index} sets "${column}", which is not a column of "${fixture.table}"`
        )
      }

      const resolved = await resolveValue(value, context).catch((error) => {
        if (error instanceof SeedDirectiveError) {
          throw new SeedError(
            `${where} row ${index}, column "${column}": ${error.message}`
          )
        }

        throw error
      })

      row[column] = resolved.value
      present.add(column)

      if (!resolved.deterministic) volatile.add(column)
    }

    for (const column of fixture.conflictTarget) {
      if (row[column] === undefined) {
        throw new SeedError(
          `${where} row ${index} is missing conflictTarget column "${column}"`
        )
      }
    }

    values.push(row)
  }

  return { values, present, volatile }
}

function columnsToUpdate(
  fixture: LoadedFixture,
  resolved: ResolvedRows
): string[] {
  if (fixture.update) return fixture.update

  const conflict = new Set(fixture.conflictTarget)

  return [...resolved.present].filter(
    (column) => !conflict.has(column) && !resolved.volatile.has(column)
  )
}

function buildUpdateSet(
  fixture: LoadedFixture,
  registry: TableRegistry,
  updatedColumns: string[]
): Record<string, unknown> {
  const excluded = (column: string) =>
    sql`excluded.${sql.identifier(registry.physicalColumn(fixture.table, column))}`

  if (updatedColumns.length === 0) {
    const anchor = fixture.conflictTarget[0]

    return { [anchor]: excluded(anchor) }
  }

  const set: Record<string, unknown> = {}

  for (const column of updatedColumns) set[column] = excluded(column)

  if (registry.columnNames(fixture.table).has("updatedAt")) {
    set.updatedAt = sql`now()`
  }

  return set
}

async function applyFixture(
  executor: DatabaseExecutor,
  registry: TableRegistry,
  lookup: RowLookup,
  fixture: LoadedFixture,
  context: PlaceholderContext
): Promise<SeedFileResult> {
  const resolved = await resolveRows(fixture, registry, context)
  const updatedColumns = columnsToUpdate(fixture, resolved)
  const columns = registry.columns(fixture.table)

  const rows = (await executor
    .insert(registry.table(fixture.table))
    .values(resolved.values)
    .onConflictDoUpdate({
      target: fixture.conflictTarget.map((column) => columns[column]),
      set: buildUpdateSet(fixture, registry, updatedColumns),
    })
    .returning({ ...columns, [INSERTED]: sql<boolean>`(xmax = 0)` })) as Row[]

  for (const row of rows) {
    const key = fixture.conflictTarget
      .map((column) => String(row[column]))
      .join(KEY_SEPARATOR)

    lookup.remember(fixture.table, key, row)
  }

  const inserted = rows.filter((row) => row[INSERTED] === true).length

  return {
    tier: fixture.tier,
    file: fixture.file,
    table: fixture.table,
    inserted,
    updated: rows.length - inserted,
    updatedColumns,
  }
}

export async function runSeed(
  db: DrizzleDatabase,
  options: SeedRunOptions
): Promise<SeedRunResult> {
  const started = Date.now()
  const registry = TableRegistry.fromSchema()
  const fixtures = await loadFixtures(options.root, options.tiers)
  const plan = planSeed(fixtures, registry, options.only)

  let results: SeedFileResult[] = []

  try {
    await db.transaction(async (tx) => {
      const lookup = new RowLookup(tx, registry, plan.naturalKeys)
      const context: PlaceholderContext = {
        now: new Date(),
        lookupRef: lookup.find,
      }

      results = []

      for (const fixture of plan.selected) {
        results.push(await applyFixture(tx, registry, lookup, fixture, context))
      }

      if (options.dryRun) throw new Rollback()
    })
  } catch (error) {
    if (!(error instanceof Rollback)) throw error
  }

  return {
    results,
    skipped: plan.skipped,
    dryRun: options.dryRun === true,
    elapsedMs: Date.now() - started,
  }
}
