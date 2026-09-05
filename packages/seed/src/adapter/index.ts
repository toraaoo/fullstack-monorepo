import type { Dialect, Query } from "../dialect/index.js"

export interface ColumnMetadata {
  name: string
  property: string
  nullable: boolean
  hasDefault: boolean
}

export interface ForeignKeyMetadata {
  columns: string[]
  table: string
  foreignColumns: string[]
}

export interface TableMetadata {
  name: string
  schema?: string
  columns: ColumnMetadata[]
  primaryKey: string[]
  uniqueKeys: string[][]
  foreignKeys: ForeignKeyMetadata[]
}

export interface DatabaseMetadata {
  tables: TableMetadata[]
}

export type AdapterRow = Record<string, unknown>

export interface SeedExecutor {
  run(query: Query): Promise<AdapterRow[]>
}

export interface SeedAdapter {
  readonly dialect: Dialect
  metadata(): Promise<DatabaseMetadata>
  transaction<T>(run: (executor: SeedExecutor) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export function defineAdapter(adapter: SeedAdapter): SeedAdapter {
  return adapter
}

export type {
  Dialect,
  Query,
  RenderedQuery,
  SeedRow,
} from "../dialect/index.js"
