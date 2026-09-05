import { DATABASE_CASING } from "@core/database/client"
import * as schema from "@core/database/schema"
import { getTableColumns, getTableName, is } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import { getTableConfig, PgTable } from "drizzle-orm/pg-core"
import { SeedError } from "./errors"
import type { ColumnMap } from "./types"

export class TableRegistry {
  private readonly tables = new Map<string, PgTable>()
  private readonly casing = new CasingCache(DATABASE_CASING)

  static fromSchema(): TableRegistry {
    const registry = new TableRegistry()

    for (const value of Object.values(schema)) {
      if (is(value, PgTable)) registry.tables.set(getTableName(value), value)
    }

    return registry
  }

  has(name: string): boolean {
    return this.tables.has(name)
  }

  names(): string[] {
    return [...this.tables.keys()]
  }

  table(name: string): PgTable {
    const table = this.tables.get(name)

    if (!table) {
      throw new SeedError(
        `unknown table "${name}" — known tables: ${this.names().join(", ")}`
      )
    }

    return table
  }

  columns(name: string): ColumnMap {
    return getTableColumns(this.table(name)) as ColumnMap
  }

  columnNames(name: string): Set<string> {
    return new Set(Object.keys(this.columns(name)))
  }

  physicalColumn(name: string, column: string): string {
    return this.casing.getColumnCasing(this.columns(name)[column])
  }

  dependencies(name: string): string[] {
    const targets = new Set<string>()

    for (const foreignKey of getTableConfig(this.table(name)).foreignKeys) {
      const target = getTableName(foreignKey.reference().foreignTable)

      if (target !== name) targets.add(target)
    }

    return [...targets]
  }
}
