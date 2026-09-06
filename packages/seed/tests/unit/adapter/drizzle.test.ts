import { is, Param, type SQL, sql } from "drizzle-orm"
import {
  boolean,
  integer,
  PgDialect,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import { describe, expect, it, vi } from "vitest"
import {
  type DrizzleExecutorLike,
  type DrizzleLike,
  drizzleAdapter,
  drizzleTables,
} from "#src/adapter/drizzle"
import { defineAdapter } from "#src/adapter/index"
import { Query } from "#src/dialect/index"
import { postgresDialect } from "#src/dialect/postgres"

const categories = pgTable("categories", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  position: integer().notNull().default(0),
})

const items = pgTable("items", {
  id: uuid().primaryKey().defaultRandom(),
  categoryId: uuid()
    .notNull()
    .references(() => categories.id),
  reference: text().notNull().unique(),
  ownerEmail: text().notNull(),
  active: boolean().notNull().default(true),
  publishedAt: timestamp({ withTimezone: true }),
})

const memberships = pgTable(
  "memberships",
  {
    orgSlug: text().notNull(),
    userEmail: text().notNull(),
    role: text().notNull(),
    inviteCode: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.orgSlug, t.userEmail] }),
    unique().on(t.inviteCode),
  ]
)

const audit = pgSchema("audit")

const events = audit.table("events", {
  id: uuid().primaryKey(),
  code: text().notNull(),
})

const schema = { categories, items, memberships, events, sql }

function stubDb(result: unknown = { rows: [{ ok: true }] }) {
  const executed: unknown[] = []

  let transactions = 0

  const executor: DrizzleExecutorLike = {
    async execute(query) {
      executed.push(query)
      return result
    },
  }

  const db: DrizzleLike = {
    execute: (query) => executor.execute(query),
    transaction(run) {
      transactions += 1
      return run(executor)
    },
  }

  return { db, executed, transactions: () => transactions }
}

async function metadataFor(casing?: "snake_case" | "camelCase") {
  const { db } = stubDb()

  return drizzleAdapter({ db, schema, casing }).metadata()
}

describe("drizzleTables", () => {
  it("is erased at runtime, existing only to carry types", () => {
    expect(drizzleTables(schema)).toEqual({})
  })
})

describe("metadata", () => {
  it("reads every pgTable in the schema and ignores everything else", async () => {
    const { tables } = await metadataFor("snake_case")

    expect(tables.map((t) => t.name).sort()).toEqual([
      "categories",
      "events",
      "items",
      "memberships",
    ])
  })

  it("maps a property to its snake_case physical name", async () => {
    const { tables } = await metadataFor("snake_case")

    expect(tables.find((t) => t.name === "items")?.columns).toContainEqual({
      name: "category_id",
      property: "categoryId",
      nullable: false,
      hasDefault: false,
    })
  })

  it("leaves names alone under camelCase casing", async () => {
    const { tables } = await metadataFor("camelCase")

    expect(
      tables.find((t) => t.name === "items")?.columns.map((c) => c.name)
    ).toContain("categoryId")
  })

  it("reports nullability from notNull", async () => {
    const { tables } = await metadataFor("snake_case")

    const columns = tables.find((t) => t.name === "items")?.columns ?? []

    expect(columns.find((c) => c.property === "publishedAt")?.nullable).toBe(
      true
    )

    expect(columns.find((c) => c.property === "reference")?.nullable).toBe(
      false
    )
  })

  it("treats a default or a primary key as having a default", async () => {
    const { tables } = await metadataFor("snake_case")

    const columns = tables.find((t) => t.name === "items")?.columns ?? []

    expect(columns.find((c) => c.property === "id")?.hasDefault).toBe(true)
    expect(columns.find((c) => c.property === "active")?.hasDefault).toBe(true)
    expect(columns.find((c) => c.property === "reference")?.hasDefault).toBe(
      false
    )
  })

  it("reads a single-column primary key", async () => {
    const { tables } = await metadataFor("snake_case")

    expect(tables.find((t) => t.name === "categories")?.primaryKey).toEqual([
      "id",
    ])
  })

  it("reads a composite primary key in order", async () => {
    const { tables } = await metadataFor("snake_case")

    expect(tables.find((t) => t.name === "memberships")?.primaryKey).toEqual([
      "org_slug",
      "user_email",
    ])
  })

  it("collects the primary key, column uniques and table uniques", async () => {
    const { tables } = await metadataFor("snake_case")

    expect(tables.find((t) => t.name === "categories")?.uniqueKeys).toEqual([
      ["id"],
      ["slug"],
    ])

    expect(tables.find((t) => t.name === "memberships")?.uniqueKeys).toEqual([
      ["org_slug", "user_email"],
      ["invite_code"],
    ])
  })

  it("reads foreign keys with both sides mapped to physical names", async () => {
    const { tables } = await metadataFor("snake_case")

    expect(tables.find((t) => t.name === "items")?.foreignKeys).toEqual([
      { columns: ["category_id"], table: "categories", foreignColumns: ["id"] },
    ])
  })

  it("carries a non-default schema", async () => {
    const { tables } = await metadataFor("snake_case")

    expect(tables.find((t) => t.name === "events")?.schema).toBe("audit")
    expect(tables.find((t) => t.name === "items")?.schema).toBeUndefined()
  })
})

describe("execution", () => {
  it("runs inside the drizzle transaction", async () => {
    const { db, executed, transactions } = stubDb()

    const adapter = drizzleAdapter({ db, schema, casing: "snake_case" })

    await adapter.transaction(async (tx) => {
      await tx.run(new Query().text("SELECT 1"))
    })

    expect(transactions()).toBe(1)
    expect(executed).toHaveLength(1)
  })

  it("renders identifiers, raw text and parameters into one SQL object", async () => {
    const { db, executed } = stubDb()

    const adapter = drizzleAdapter({ db, schema, casing: "snake_case" })

    await adapter.transaction(async (tx) => {
      await tx.run(
        new Query()
          .text("SELECT ")
          .identifier("slug")
          .raw(" FROM categories")
          .text(" WHERE slug = ")
          .param("tools", { table: "categories", name: "slug" })
      )
    })

    const rendered = new PgDialect().sqlToQuery(executed[0] as SQL)

    expect(rendered.sql).toBe('SELECT "slug" FROM categories WHERE slug = $1')
    expect(rendered.params).toEqual(["tools"])
  })

  it("binds a parameter carrying a column through a drizzle Param", async () => {
    const { db, executed } = stubDb()

    const adapter = drizzleAdapter({ db, schema, casing: "snake_case" })

    await adapter.transaction(async (tx) => {
      await tx.run(
        new Query().param("2024-01-01", {
          table: "items",
          name: "published_at",
        })
      )
    })

    const chunks = (executed[0] as SQL).queryChunks

    expect(chunks.some((chunk) => is(chunk, Param))).toBe(true)
  })

  it("unwraps rows from a result object", async () => {
    const { db } = stubDb()

    const adapter = drizzleAdapter({ db, schema, casing: "snake_case" })

    expect(
      await adapter.transaction((tx) => tx.run(new Query().text("SELECT 1")))
    ).toEqual([{ ok: true }])
  })

  it("accepts a driver that returns a bare array", async () => {
    const { db } = stubDb([{ ok: 1 }])

    const adapter = drizzleAdapter({ db, schema, casing: "snake_case" })

    expect(
      await adapter.transaction((tx) => tx.run(new Query().text("SELECT 1")))
    ).toEqual([{ ok: 1 }])
  })

  it("yields no rows when the driver returns something unexpected", async () => {
    const { db } = stubDb(42)

    const adapter = drizzleAdapter({ db, schema, casing: "snake_case" })

    expect(
      await adapter.transaction((tx) => tx.run(new Query().text("SELECT 1")))
    ).toEqual([])
  })
})

describe("lifecycle", () => {
  it("uses the postgres dialect", () => {
    const { db } = stubDb()

    expect(drizzleAdapter({ db, schema }).dialect).toBe(postgresDialect)
  })

  it("delegates close to the supplied callback", async () => {
    const { db } = stubDb()
    const close = vi.fn(async () => {})

    await drizzleAdapter({ db, schema, close }).close()

    expect(close).toHaveBeenCalledTimes(1)
  })

  it("closes cleanly when given no callback", async () => {
    const { db } = stubDb()

    await expect(
      drizzleAdapter({ db, schema }).close()
    ).resolves.toBeUndefined()
  })
})

describe("defineAdapter", () => {
  it("returns the adapter unchanged, existing only to type it", () => {
    const { db } = stubDb()
    const adapter = drizzleAdapter({ db, schema })

    expect(defineAdapter(adapter)).toBe(adapter)
  })
})
