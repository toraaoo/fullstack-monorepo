import type { TableMetadata } from "../adapter/index.js"

export const RAW_SQL = Symbol.for("workspace.seed.raw")

export interface RawSql {
  readonly [RAW_SQL]: true
  readonly expression: string
}

export function raw(expression: string): RawSql {
  return { [RAW_SQL]: true, expression }
}

export function isRawSql(value: unknown): value is RawSql {
  return typeof value === "object" && value !== null && RAW_SQL in value
}

export type SeedRow = Record<string, unknown>

export interface ColumnRef {
  table: string
  name: string
}

export type QueryFragment =
  | { kind: "text"; value: string }
  | { kind: "identifier"; value: string }
  | { kind: "raw"; value: string }
  | { kind: "param"; value: unknown; column?: ColumnRef }

export interface RenderedQuery {
  text: string
  params: unknown[]
}

export class Query {
  readonly fragments: QueryFragment[] = []

  text(value: string): this {
    this.fragments.push({ kind: "text", value })
    return this
  }

  identifier(value: string): this {
    this.fragments.push({ kind: "identifier", value })
    return this
  }

  raw(value: string): this {
    this.fragments.push({ kind: "raw", value })
    return this
  }

  param(value: unknown, column?: ColumnRef): this {
    this.fragments.push({ kind: "param", value, column })
    return this
  }

  value(value: unknown, column?: ColumnRef): this {
    return isRawSql(value)
      ? this.raw(value.expression)
      : this.param(value, column)
  }

  table(table: TableMetadata): this {
    if (table.schema) this.identifier(table.schema).text(".")

    return this.identifier(table.name)
  }

  join<T>(
    items: readonly T[],
    separator: string,
    each: (item: T, index: number) => void
  ): this {
    items.forEach((item, index) => {
      if (index > 0) this.text(separator)
      each(item, index)
    })

    return this
  }

  render(dialect: Dialect): RenderedQuery {
    const params: unknown[] = []

    let text = ""

    for (const fragment of this.fragments) {
      if (fragment.kind === "text" || fragment.kind === "raw") {
        text += fragment.value
        continue
      }

      if (fragment.kind === "identifier") {
        text += dialect.quoteIdentifier(fragment.value)
        continue
      }

      params.push(fragment.value)
      text += dialect.placeholder(params.length)
    }

    return { text, params }
  }
}

export interface UpsertRequest {
  table: TableMetadata
  columns: string[]
  rows: SeedRow[]
  conflictColumns: string[]
  updateColumns: string[]
  touchColumn?: string
  returning: string[]
}

export interface UpdateRequest {
  table: TableMetadata
  values: SeedRow
  where: SeedRow
  touchColumn?: string
}

export interface SelectRequest {
  table: TableMetadata
  columns: string[]
  keyColumns: string[]
  keys: unknown[][]
}

export interface TruncateRequest {
  tables: TableMetadata[]
}

export interface Dialect {
  readonly name: string
  readonly insertedColumn: string
  quoteIdentifier(value: string): string
  placeholder(index: number): string
  upsert(request: UpsertRequest): Query
  update(request: UpdateRequest): Query
  select(request: SelectRequest): Query
  truncate(request: TruncateRequest): Query
  introspect(): Query
}

export function defineDialect(dialect: Dialect): Dialect {
  return dialect
}
