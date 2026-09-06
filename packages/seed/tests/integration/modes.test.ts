import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { seed } from "#src/engine/index"
import { createTestDatabase, type TestDatabase } from "./setup/database"

const FIXTURES = join(import.meta.dirname, "fixtures", "catalog")

describe("diff", () => {
  let database: TestDatabase

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  it("reports every row as an insert against an empty database, writing nothing", async () => {
    const result = await seed(database.config(FIXTURES), {
      environment: "local",
      mode: "diff",
    })

    expect(result.rolledBack).toBe(true)

    const kinds = result.results.flatMap((entry) =>
      entry.changes.map((change) => change.kind)
    )

    expect(kinds).toEqual(["insert", "insert", "insert", "insert"])
    expect(await database.count("categories")).toBe(0)
    expect(await database.count("items")).toBe(0)
  })

  it("reports nothing to change straight after a real run", async () => {
    await seed(database.config(FIXTURES), { environment: "local" })

    const result = await seed(database.config(FIXTURES), {
      environment: "local",
      mode: "diff",
    })

    const kinds = result.results.flatMap((entry) =>
      entry.changes.map((change) => change.kind)
    )

    expect(kinds.every((kind) => kind === "unchanged")).toBe(true)
  })

  it("names the column and both values when a row drifted", async () => {
    await database.verify`
      UPDATE categories SET name = 'Drifted' WHERE slug = 'tools'
    `

    const result = await seed(database.config(FIXTURES), {
      environment: "local",
      mode: "diff",
    })

    const categories = result.results.find(
      (entry) => entry.fixture.table === "categories"
    )

    const change = categories?.changes.find((entry) => entry.key === "tools")

    expect(change).toMatchObject({
      kind: "update",
      columns: [{ column: "name", before: "Drifted", after: "Tools" }],
    })
  })

  it("leaves the drift in place, having rolled back", async () => {
    const categories = await database.rows("categories", "slug")

    expect(categories.find((row) => row.slug === "tools")?.name).toBe("Drifted")
  })
})

describe("reset", () => {
  let database: TestDatabase

  beforeAll(async () => {
    database = await createTestDatabase()
  })

  it("truncates the targeted tables, dependents first, then reapplies", async () => {
    await seed(database.config(FIXTURES), { environment: "local" })

    const before = await database.rows("categories", "slug")

    const result = await seed(database.config(FIXTURES), {
      environment: "local",
      mode: "reset",
    })

    expect(result.truncated).toEqual(["items", "categories"])

    const after = await database.rows("categories", "slug")

    expect(after).toHaveLength(2)
    expect(after[0]?.id).not.toBe(before[0]?.id)
  })

  it("counts every row as an insert again", async () => {
    const result = await seed(database.config(FIXTURES), {
      environment: "local",
      mode: "reset",
    })

    expect(result.results.every((entry) => entry.updated === 0)).toBe(true)

    expect(await database.count("items")).toBe(2)
  })

  it("leaves untargeted tables alone", async () => {
    await database.verify`
      INSERT INTO nodes (slug) VALUES ('keep-me')
    `

    await seed(database.config(FIXTURES), {
      environment: "local",
      mode: "reset",
    })

    expect(await database.count("nodes")).toBe(1)
  })
})
