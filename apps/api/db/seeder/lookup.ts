import type { DatabaseExecutor } from "@core/database/client"
import { and, eq } from "drizzle-orm"
import { fail } from "./errors"
import type { TableRegistry } from "./registry"
import type { Row } from "./types"

export const KEY_SEPARATOR = "|"

export class RowLookup {
  private readonly seen = new Map<string, Row>()

  constructor(
    private readonly executor: DatabaseExecutor,
    private readonly registry: TableRegistry,
    private readonly naturalKeys: Map<string, string[]>
  ) {}

  remember(table: string, key: string, row: Row): void {
    this.seen.set(`${table} ${key}`, row)
  }

  find = async (
    table: string,
    key: string,
    column: string
  ): Promise<unknown> => {
    const row =
      this.seen.get(`${table} ${key}`) ?? (await this.select(table, key))

    if (!(column in row)) {
      fail(
        `ref ${table}.${key}.${column} — "${table}" has no column "${column}"`
      )
    }

    return row[column]
  }

  private async select(table: string, key: string): Promise<Row> {
    if (!this.registry.has(table)) fail(`ref targets unknown table "${table}"`)

    const naturalKey = this.naturalKeys.get(table)

    if (!naturalKey) {
      fail(
        `ref targets "${table}", which has no fixture declaring a conflictTarget — its natural key is unknown`
      )
    }

    const values = key.split(KEY_SEPARATOR)

    if (values.length !== naturalKey.length) {
      fail(
        `ref key "${key}" does not match the natural key of "${table}" (${naturalKey.join(", ")}) — join composite values with "${KEY_SEPARATOR}"`
      )
    }

    const columns = this.registry.columns(table)

    const [row] = await this.executor
      .select()
      .from(this.registry.table(table))
      .where(
        and(
          ...naturalKey.map((name, index) => eq(columns[name], values[index]))
        )
      )
      .limit(1)

    if (!row) {
      fail(
        `ref ${table}.${key} found no row — seed "${table}" first, or widen --only`
      )
    }

    this.remember(table, key, row)

    return row
  }
}
