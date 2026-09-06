import type {
  ColumnMetadata,
  DatabaseMetadata,
  ForeignKeyMetadata,
  TableMetadata,
} from "#src/adapter/index"
import { Catalog } from "#src/engine/plan/catalog"

export interface ColumnInput {
  name?: string
  property?: string
  nullable?: boolean
  hasDefault?: boolean
}

export interface TableInput {
  schema?: string
  columns: Record<string, ColumnInput | true>
  primaryKey?: string[]
  uniqueKeys?: string[][]
  foreignKeys?: ForeignKeyMetadata[]
}

function snake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

export function column(
  property: string,
  input: ColumnInput | true = true
): ColumnMetadata {
  const options = input === true ? {} : input

  return {
    name: options.name ?? snake(property),
    property: options.property ?? property,
    nullable: options.nullable ?? false,
    hasDefault: options.hasDefault ?? false,
  }
}

export function table(name: string, input: TableInput): TableMetadata {
  const columns = Object.entries(input.columns).map(([property, options]) =>
    column(property, options)
  )

  const primaryKey = input.primaryKey ?? []

  return {
    name,
    schema: input.schema,
    columns,
    primaryKey,
    uniqueKeys: [
      ...(primaryKey.length > 0 ? [primaryKey] : []),
      ...(input.uniqueKeys ?? []),
    ],
    foreignKeys: input.foreignKeys ?? [],
  }
}

export function foreignKey(
  columns: string[],
  target: string,
  foreignColumns: string[]
): ForeignKeyMetadata {
  return { columns, table: target, foreignColumns }
}

export function metadata(...tables: TableMetadata[]): DatabaseMetadata {
  return { tables }
}

export function catalogOf(...tables: TableMetadata[]): Catalog {
  return new Catalog(metadata(...tables))
}
