import { join } from "node:path"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { seed } from "#src/engine/index"
import {
  createTestDatabase,
  first,
  type TestDatabase,
  timestamp,
} from "./setup/database"

const FIXTURES = join(import.meta.dirname, "fixtures", "catalog")

describe("seeding a real database", () => {
  let database: TestDatabase

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  it("inserts the base tier only when no environment is named", async () => {
    const result = await seed(database.config(FIXTURES))

    expect(result.tiers).toEqual(["base"])
    expect(await database.count("categories")).toBe(2)
    expect(await database.count("items")).toBe(0)
  })

  it("inserts the environment tier alongside the base tier", async () => {
    const result = await seed(database.config(FIXTURES), {
      environment: "local",
    })

    expect(result.results.map((entry) => entry.fixture.table)).toEqual([
      "categories",
      "items",
    ])

    expect(await database.count("items")).toBe(2)
  })

  it("resolves ref() to the real primary key of the referenced row", async () => {
    const categories = await database.rows("categories", "slug")
    const items = await database.rows("items", "reference")

    const tools = categories.find((row) => row.slug === "tools")
    const first = items.find((row) => row.reference === "ITEM-0001")

    expect(first?.category_id).toBe(tools?.id)
    expect(first?.category_id).toEqual(expect.any(String))
  })

  it("writes helper values through as real column values", async () => {
    const [first] = await database.rows("items", "reference")

    expect(first?.owner_email).toBe("demo@example.com")
    expect(first?.secret).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(first?.token).toMatch(/^[0-9a-f]{16}$/)
    expect(first?.metadata).toEqual({ grade: "alpha", tags: ["demo"] })
    expect(first?.published_at).toBeInstanceOf(Date)
  })

  it("shifts now() by the requested offset", async () => {
    const item = first(await database.rows("items", "reference"))

    const daysAgo = (Date.now() - timestamp(item.published_at)) / 86_400_000

    expect(daysAgo).toBeGreaterThan(29.9)
    expect(daysAgo).toBeLessThan(30.1)
  })

  it("applies column defaults for columns no row sets", async () => {
    const [first] = await database.rows("items", "reference")

    expect(first?.active).toBe(true)
    expect(first?.created_at).toBeInstanceOf(Date)
  })

  describe("re-running", () => {
    it("updates rather than failing, and deletes nothing", async () => {
      const before = await database.rows("items", "reference")

      const result = await seed(database.config(FIXTURES), {
        environment: "local",
      })

      const items = result.results.find(
        (entry) => entry.fixture.table === "items"
      )

      expect(items).toMatchObject({ inserted: 0, updated: 2 })

      const after = await database.rows("items", "reference")

      expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id))
    })

    it("leaves volatile columns exactly as first written", async () => {
      const [before] = await database.rows("items", "reference")

      await seed(database.config(FIXTURES), { environment: "local" })

      const [after] = await database.rows("items", "reference")

      expect(after?.secret).toBe(before?.secret)
      expect(after?.token).toBe(before?.token)
      expect(after?.published_at).toEqual(before?.published_at)
    })

    it("overwrites only the stable columns", async () => {
      const result = await seed(database.config(FIXTURES), {
        environment: "local",
      })

      const items = result.results.find(
        (entry) => entry.fixture.table === "items"
      )

      expect(items?.updateColumns).toEqual([
        "category_id",
        "title",
        "owner_email",
      ])
    })

    it("touches updatedAt when a row is updated", async () => {
      const before = first(await database.rows("items", "reference"))

      await new Promise((resolve) => setTimeout(resolve, 10))
      await seed(database.config(FIXTURES), { environment: "local" })

      const after = first(await database.rows("items", "reference"))

      expect(timestamp(after.updated_at)).toBeGreaterThan(
        timestamp(before.updated_at)
      )

      expect(after.created_at).toEqual(before.created_at)
    })

    it("writes a changed value on the next run", async () => {
      await database.verify`
        UPDATE items SET title = 'Tampered' WHERE reference = 'ITEM-0001'
      `

      await seed(database.config(FIXTURES), { environment: "local" })

      const [restored] = await database.rows("items", "reference")

      expect(restored?.title).toBe("Torque wrench")
    })
  })

  describe("only", () => {
    it("applies just the named table", async () => {
      const result = await seed(database.config(FIXTURES), {
        environment: "local",
        only: ["categories"],
      })

      expect(result.results.map((entry) => entry.fixture.table)).toEqual([
        "categories",
      ])

      expect(result.plan.skipped.map((f) => f.table)).toEqual(["items"])
    })

    it("still resolves refs into tables it skipped, by selecting them", async () => {
      const result = await seed(database.config(FIXTURES), {
        environment: "local",
        only: ["items"],
      })

      expect(result.results.map((entry) => entry.fixture.table)).toEqual([
        "items",
      ])

      const items = await database.rows("items", "reference")

      expect(items[0]?.category_id).toEqual(expect.any(String))
    })
  })

  describe("env()", () => {
    it("reads the variable when it is set", async () => {
      vi.stubEnv("SEED_OWNER_EMAIL", "ana@example.com")

      await seed(database.config(FIXTURES), { environment: "local" })

      const [first] = await database.rows("items", "reference")

      expect(first?.owner_email).toBe("ana@example.com")

      vi.unstubAllEnvs()
    })
  })

  describe("transactionality", () => {
    it("writes nothing when a later fixture fails", async () => {
      const before = await database.count("categories")

      const broken = database.config(join(FIXTURES, "..", "does-not-exist"))

      await expect(
        seed(
          { ...broken, root: FIXTURES },
          {
            environment: "local",
            only: ["nothing-matches-this"],
          }
        )
      ).rejects.toThrow(/matched no fixtures/)

      expect(await database.count("categories")).toBe(before)
    })
  })
})
