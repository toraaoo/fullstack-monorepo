import {
  getTableColumns,
  type InferInsertModel,
  is,
  Param,
  type SQL,
  sql,
} from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import { getTableConfig, type PgColumn, PgTable } from "drizzle-orm/pg-core"
import type { Query } from "../dialect/index.js"
import { postgresDialect } from "../dialect/postgres.js"
import {
  type AdapterRow,
  type ColumnMetadata,
  type DatabaseMetadata,
  defineAdapter,
  type SeedAdapter,
  type SeedExecutor,
  type TableMetadata,
} from "./index.js"

export type DrizzleCasing = "snake_case" | "camelCase"

export type DrizzleTables<S> = {
  [K in keyof S as S[K] extends PgTable
    ? S[K]["_"]["name"]
    : never]: S[K] extends PgTable ? InferInsertModel<S[K]> : never
}

export function drizzleTables<S extends Record<string, unknown>>(
  _schema: S
): DrizzleTables<S> {
  return {} as DrizzleTables<S>
}

export interface DrizzleExecutorLike {
  execute(query: SQL): Promise<unknown>
}

export interface DrizzleLike extends DrizzleExecutorLike {
  transaction<T>(run: (tx: DrizzleExecutorLike) => Promise<T>): Promise<T>
}

export interface DrizzleAdapterOptions {
  db: DrizzleLike
  schema: Record<string, unknown>
  casing?: DrizzleCasing
  close?: () => Promise<void>
}

type ColumnIndex = Map<string, Map<string, PgColumn>>

function toSql(query: Query, columns: ColumnIndex): SQL {
  const chunks = query.fragments.map((fragment) => {
    if (fragment.kind === "identifier") return sql.identifier(fragment.value)

    if (fragment.kind === "param") {
      const encoder = fragment.column
        ? columns.get(fragment.column.table)?.get(fragment.column.name)
        : undefined

      return encoder
        ? new Param(fragment.value, encoder)
        : sql`${fragment.value}`
    }

    return sql.raw(fragment.value)
  })

  return sql.join(chunks, sql.raw(""))
}

function toRows(result: unknown): AdapterRow[] {
  if (Array.isArray(result)) return result as AdapterRow[]

  const rows = (result as { rows?: unknown }).rows

  return Array.isArray(rows) ? (rows as AdapterRow[]) : []
}

function executorFor(
  target: DrizzleExecutorLike,
  columns: ColumnIndex
): SeedExecutor {
  return {
    async run(query: Query): Promise<AdapterRow[]> {
      return toRows(await target.execute(toSql(query, columns)))
    },
  }
}

function tableMetadata(table: PgTable, casing: CasingCache): TableMetadata {
  const config = getTableConfig(table)
  const physical = (column: PgColumn) => casing.getColumnCasing(column)

  const columns: ColumnMetadata[] = Object.entries(getTableColumns(table)).map(
    ([property, column]) => ({
      name: physical(column),
      property,
      nullable: !column.notNull,
      hasDefault: column.hasDefault || column.primary,
    })
  )

  const primaryKey =
    config.primaryKeys[0]?.columns.map(physical) ??
    config.columns.filter((column) => column.primary).map(physical)

  const uniqueKeys: string[][] = []

  if (primaryKey.length > 0) uniqueKeys.push(primaryKey)

  for (const column of config.columns) {
    if (column.isUnique) uniqueKeys.push([physical(column)])
  }

  for (const constraint of config.uniqueConstraints) {
    uniqueKeys.push(constraint.columns.map(physical))
  }

  return {
    name: config.name,
    schema: config.schema,
    columns,
    primaryKey,
    uniqueKeys,
    foreignKeys: config.foreignKeys.map((foreignKey) => {
      const reference = foreignKey.reference()

      return {
        columns: reference.columns.map(physical),
        table: getTableConfig(reference.foreignTable).name,
        foreignColumns: reference.foreignColumns.map(physical),
      }
    }),
  }
}

export function drizzleAdapter(options: DrizzleAdapterOptions): SeedAdapter {
  const casing = new CasingCache(options.casing)

  const tables = Object.values(options.schema).filter((value) =>
    is(value, PgTable)
  )

  const columns: ColumnIndex = new Map(
    tables.map((table) => {
      const config = getTableConfig(table)

      return [
        config.name,
        new Map(
          config.columns.map((column) => [
            casing.getColumnCasing(column),
            column,
          ])
        ),
      ] as const
    })
  )

  return defineAdapter({
    dialect: postgresDialect,

    async metadata(): Promise<DatabaseMetadata> {
      return { tables: tables.map((table) => tableMetadata(table, casing)) }
    },

    transaction<T>(run: (executor: SeedExecutor) => Promise<T>): Promise<T> {
      return options.db.transaction((tx) => run(executorFor(tx, columns)))
    },

    async close(): Promise<void> {
      await options.close?.()
    },
  })
}
