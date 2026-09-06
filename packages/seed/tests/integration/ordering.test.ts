import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { planSeed, seed } from "#src/engine/index"
import { createTestDatabase, type TestDatabase } from "./setup/database"

const TREE = join(import.meta.dirname, "fixtures", "tree")
const CYCLE = join(import.meta.dirname, "fixtures", "cycle")

describe("self-referencing rows", () => {
  let database: TestDatabase

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  it("plans one wave per depth regardless of how rows are listed", async () => {
    const { plan } = await planSeed(database.config(TREE))

    expect(plan.steps[0]?.waves).toEqual([[2], [1], [0]])
  })

  it("inserts parents before children so the foreign key holds", async () => {
    await seed(database.config(TREE))

    const nodes = await database.rows("nodes", "slug")

    const bySlug = new Map(nodes.map((row) => [row.slug, row]))

    expect(bySlug.get("root")?.parent_id).toBeNull()
    expect(bySlug.get("child")?.parent_id).toBe(bySlug.get("root")?.id)
    expect(bySlug.get("grandchild")?.parent_id).toBe(bySlug.get("child")?.id)
  })

  it("is idempotent", async () => {
    const result = await seed(database.config(TREE))

    expect(result.results[0]).toMatchObject({ inserted: 0, updated: 3 })
    expect(await database.count("nodes")).toBe(3)
  })
})

describe("cyclic foreign keys", () => {
  let database: TestDatabase

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  it("defers the nullable side of the cycle to a backfill", async () => {
    const { plan } = await planSeed(database.config(CYCLE))

    const teams = plan.steps.find((step) => step.fixture.table === "teams")

    expect(teams?.deferredColumns).toEqual(["owner_id"])
    expect(teams?.columns).toEqual(["slug"])

    expect(plan.backfills.map((entry) => entry.fixture.table)).toEqual([
      "teams",
    ])
  })

  it("orders the non-deferred table first", async () => {
    const { plan } = await planSeed(database.config(CYCLE))

    expect(plan.steps.map((step) => step.fixture.table)).toEqual([
      "teams",
      "members",
    ])
  })

  it("fills the deferred column once both sides exist", async () => {
    await seed(database.config(CYCLE))

    const [team] = await database.rows("teams", "slug")
    const members = await database.rows("members", "email")

    const ana = members.find((row) => row.email === "ana@example.com")

    expect(team?.owner_id).toBe(ana?.id)
  })

  it("resolves a composite natural key reference", async () => {
    const members = await database.rows("members", "email")

    expect(members.map((row) => row.email)).toEqual([
      "ana@example.com",
      "bo@example.com",
    ])

    expect(members.map((row) => row.role)).toEqual(["owner", "member"])
  })

  it("is idempotent", async () => {
    await seed(database.config(CYCLE))

    expect(await database.count("teams")).toBe(1)
    expect(await database.count("members")).toBe(2)
  })
})
