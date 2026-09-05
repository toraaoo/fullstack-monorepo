import postgres, { type Sql } from "postgres"
import type { Query } from "../dialect/index.js"
import { postgresDialect } from "../dialect/postgres.js"
import { fail } from "../errors.js"
import {
  type AdapterRow,
  type DatabaseMetadata,
  defineAdapter,
  type SeedAdapter,
  type SeedExecutor,
  type TableMetadata,
} from "./index.js"

export interface PostgresAdapterOptions {
  url?: string
  client?: Sql
  ssl?: boolean
  prepare?: boolean
  max?: number
}

type Queryable = Pick<Sql, "unsafe">

function executorFor(client: Queryable): SeedExecutor {
  return {
    async run(query: Query): Promise<AdapterRow[]> {
      const { text, params } = query.render(postgresDialect)

      const rows = await client.unsafe(text, params as never[])

      return rows as unknown as AdapterRow[]
    },
  }
}

function toTables(value: unknown): TableMetadata[] {
  if (!Array.isArray(value)) return []

  return value.map((entry) => {
    const table = entry as Partial<TableMetadata>

    return {
      name: String(table.name),
      schema: table.schema,
      columns: table.columns ?? [],
      primaryKey: table.primaryKey ?? [],
      uniqueKeys: (table.uniqueKeys ?? []).filter(
        (key): key is string[] => Array.isArray(key) && key.length > 0
      ),
      foreignKeys: (table.foreignKeys ?? []).filter(
        (key) => Array.isArray(key.columns) && Array.isArray(key.foreignColumns)
      ),
    }
  })
}

export function postgresAdapter(
  options: PostgresAdapterOptions = {}
): SeedAdapter {
  const owned = options.client === undefined

  const client =
    options.client ??
    postgres(options.url ?? process.env.DATABASE_URL ?? "", {
      max: options.max ?? 1,
      ssl: options.ssl,
      prepare: options.prepare,
    })

  if (owned && !(options.url ?? process.env.DATABASE_URL)) {
    fail("postgresAdapter() needs a url, or DATABASE_URL in the environment")
  }

  return defineAdapter({
    dialect: postgresDialect,

    async metadata(): Promise<DatabaseMetadata> {
      const [row] = await executorFor(client).run(postgresDialect.introspect())

      return { tables: toTables(row?.tables) }
    },

    transaction<T>(run: (executor: SeedExecutor) => Promise<T>): Promise<T> {
      return client.begin((tx) =>
        run(executorFor(tx as unknown as Queryable))
      ) as Promise<T>
    },

    async close(): Promise<void> {
      if (owned) await client.end({ timeout: 5 })
    },
  })
}
