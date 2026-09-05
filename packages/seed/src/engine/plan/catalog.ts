import type {
  ColumnMetadata,
  DatabaseMetadata,
  ForeignKeyMetadata,
  TableMetadata,
} from "../../adapter/index.js"
import { fail } from "../../errors.js"

function normalize(value: string): string {
  return value.replaceAll("_", "").toLowerCase()
}

function sameColumns(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return (
    left.length === right.length && left.every((name) => right.includes(name))
  )
}

export class Catalog {
  private readonly tables = new Map<string, TableMetadata>()
  private readonly columns = new Map<string, Map<string, ColumnMetadata>>()

  constructor(metadata: DatabaseMetadata) {
    for (const table of metadata.tables) {
      this.tables.set(table.name, table)

      const index = new Map<string, ColumnMetadata>()

      for (const column of table.columns) {
        index.set(column.property, column)

        for (const alias of [
          column.name,
          normalize(column.property),
          normalize(column.name),
        ]) {
          if (!index.has(alias)) index.set(alias, column)
        }
      }

      this.columns.set(table.name, index)
    }
  }

  names(): string[] {
    return [...this.tables.keys()].sort()
  }

  has(table: string): boolean {
    return this.tables.has(table)
  }

  table(table: string): TableMetadata {
    const found = this.tables.get(table)

    if (!found) {
      fail(
        `unknown table "${table}" — known tables: ${this.names().join(", ")}`
      )
    }

    return found
  }

  tryColumn(table: string, column: string): ColumnMetadata | undefined {
    const index = this.columns.get(this.table(table).name)

    return index?.get(column) ?? index?.get(normalize(column))
  }

  column(table: string, column: string): ColumnMetadata {
    const found = this.tryColumn(table, column)

    if (!found) {
      fail(`"${column}" is not a column of "${table}"`)
    }

    return found
  }

  physical(table: string, column: string): string {
    return this.column(table, column).name
  }

  nullable(table: string, column: string): boolean {
    return this.column(table, column).nullable
  }

  naturalKey(
    table: string,
    present: ReadonlySet<string>,
    explicit?: readonly string[]
  ): string[] {
    const meta = this.table(table)

    if (explicit && explicit.length > 0) {
      return explicit.map((column) => this.physical(table, column))
    }

    const covered = meta.uniqueKeys.filter(
      (key) => key.length > 0 && key.every((column) => present.has(column))
    )

    const preferred = covered.filter(
      (key) => !sameColumns(key, meta.primaryKey)
    )

    const candidates = preferred.length > 0 ? preferred : covered

    const first = candidates[0]

    if (!first) {
      fail(
        `${table} has no unique constraint covered by the columns these rows set — add \`key\` to the fixture`
      )
    }

    if (candidates.length > 1) {
      const listed = candidates.map((key) => key.join("+")).join(", ")

      fail(
        `${table} has more than one usable natural key (${listed}) — state which with \`key\``
      )
    }

    return [...first]
  }

  foreignKeys(table: string): ForeignKeyMetadata[] {
    return this.table(table).foreignKeys
  }

  foreignKeyTo(table: string, target: string): ForeignKeyMetadata | undefined {
    return this.foreignKeys(table).find((key) => key.table === target)
  }

  foreignKeyForColumn(
    table: string,
    column: string
  ): ForeignKeyMetadata | undefined {
    return this.foreignKeys(table).find((key) => key.columns.includes(column))
  }

  dependencies(table: string): string[] {
    const targets = new Set<string>()

    for (const key of this.foreignKeys(table)) {
      if (key.table !== table) targets.add(key.table)
    }

    return [...targets]
  }
}
