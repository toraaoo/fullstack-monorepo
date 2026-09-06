import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import type { DatabaseMetadata } from "#src/adapter/index"
import { planSeed, seed } from "#src/engine/index"
import {
  createTestDatabase,
  first,
  type TestDatabase,
  timestamp,
} from "./setup/database"

const FIXTURES = join(import.meta.dirname, "fixtures", "catalog")

function byName(metadata: DatabaseMetadata) {
  return new Map(metadata.tables.map((table) => [table.name, table]))
}

describe("introspection against the live database", () => {
  let database: TestDatabase
  let introspected: DatabaseMetadata
  let declared: DatabaseMetadata

  beforeAll(async () => {
    database = await createTestDatabase()
    introspected = await database.postgresAdapter.metadata()
    declared = await database.drizzleAdapter.metadata()
  })

  it("finds every table in the schema", () => {
    expect([...byName(introspected).keys()].sort()).toEqual([
      "categories",
      "items",
      "members",
      "nodes",
      "teams",
    ])
  })

  it("agrees with the drizzle schema on columns", () => {
    const live = byName(introspected).get("items")
    const fromSchema = byName(declared).get("items")

    expect(live?.columns.map((column) => column.name).sort()).toEqual(
      fromSchema?.columns.map((column) => column.name).sort()
    )
  })

  it("agrees on nullability and defaults", () => {
    const live = byName(introspected).get("items")
    const fromSchema = byName(declared).get("items")

    for (const column of live?.columns ?? []) {
      const counterpart = fromSchema?.columns.find(
        (entry) => entry.name === column.name
      )

      expect({ [column.name]: column.nullable }).toEqual({
        [column.name]: counterpart?.nullable,
      })

      expect({ [column.name]: column.hasDefault }).toEqual({
        [column.name]: counterpart?.hasDefault,
      })
    }
  })

  it("agrees on primary keys", () => {
    expect(byName(introspected).get("items")?.primaryKey).toEqual(
      byName(declared).get("items")?.primaryKey
    )
  })

  it("agrees on unique constraints", () => {
    const live = byName(introspected).get("members")?.uniqueKeys ?? []
    const fromSchema = byName(declared).get("members")?.uniqueKeys ?? []

    const normalise = (keys: string[][]) =>
      keys.map((key) => key.join(",")).sort()

    expect(normalise(live)).toEqual(normalise(fromSchema))
  })

  it("agrees on foreign keys", () => {
    expect(byName(introspected).get("items")?.foreignKeys).toEqual(
      byName(declared).get("items")?.foreignKeys
    )
  })

  it("reads the composite unique on members", () => {
    expect(byName(introspected).get("members")?.uniqueKeys).toContainEqual([
      "team_slug",
      "email",
    ])
  })

  it("reports the schema each table lives in", () => {
    expect(byName(introspected).get("items")?.schema).toBe(database.name)
  })
})

describe("seeding through the introspecting adapter", () => {
  let database: TestDatabase

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  it("produces the same rows as the drizzle adapter would", async () => {
    const result = await seed(
      database.config(FIXTURES, { adapter: database.postgresAdapter }),
      { environment: "local" }
    )

    expect(result.results.map((entry) => entry.inserted)).toEqual([2, 2])

    const items = await database.rows("items", "reference")
    const categories = await database.rows("categories", "slug")

    expect(items).toHaveLength(2)

    expect(items[0]?.category_id).toBe(
      categories.find((row) => row.slug === "tools")?.id
    )
  })

  it("is idempotent through the wire protocol too", async () => {
    const result = await seed(
      database.config(FIXTURES, { adapter: database.postgresAdapter }),
      { environment: "local" }
    )

    expect(result.results.map((entry) => entry.updated)).toEqual([2, 2])
    expect(await database.count("items")).toBe(2)
  })

  it("round-trips jsonb through the driver", async () => {
    const items = await database.rows("items", "reference")

    expect(items[0]?.metadata).toEqual({ grade: "alpha", tags: ["demo"] })
  })
})

describe("sql() and once()", () => {
  let database: TestDatabase

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  const VOLATILE = join(import.meta.dirname, "fixtures", "volatile")

  it("passes a raw expression to the database instead of binding it", async () => {
    await seed(database.config(VOLATILE))

    const item = first(await database.rows("items", "reference"))

    expect(item.published_at).toBeInstanceOf(Date)
    expect(Date.now() - timestamp(item.published_at)).toBeLessThan(60_000)
  })

  it("gives a keyed uuid the same value on every run", async () => {
    const before = first(await database.rows("items", "reference"))

    await seed(database.config(VOLATILE))

    const after = first(await database.rows("items", "reference"))

    expect((after.metadata as { id: string }).id).toBe(
      (before.metadata as { id: string }).id
    )
  })

  it("never rewrites a column built from a volatile helper", async () => {
    const before = first(await database.rows("items", "reference"))

    await seed(database.config(VOLATILE))

    const after = first(await database.rows("items", "reference"))

    expect(after.secret).toBe(before.secret)
    expect(after.token).toBe(before.token)
  })

  it("re-evaluates sql(), which is deterministic in text but not in value", async () => {
    const plan = await planSeed(database.config(VOLATILE))

    const items = plan.plan.steps.find((step) => step.fixture.table === "items")

    expect(items?.updateColumns).toContain("published_at")
    expect(items?.updateColumns).not.toContain("secret")
    expect(items?.updateColumns).not.toContain("token")

    const before = first(await database.rows("items", "reference"))

    await new Promise((resolve) => setTimeout(resolve, 10))
    await seed(database.config(VOLATILE))

    const after = first(await database.rows("items", "reference"))

    expect(timestamp(after.published_at)).toBeGreaterThan(
      timestamp(before.published_at)
    )
  })
})
