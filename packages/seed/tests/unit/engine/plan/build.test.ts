import { describe, expect, it } from "vitest"
import { descriptor } from "#src/authoring/types"
import { buildPlan } from "#src/engine/plan/build"
import { loaded } from "../../../support/fixtures"
import { catalogOf, foreignKey, table } from "../../../support/metadata"

const categories = table("categories", {
  columns: { id: true, slug: true, name: true, updatedAt: true },
  primaryKey: ["id"],
  uniqueKeys: [["slug"]],
})

const items = table("items", {
  columns: {
    id: true,
    reference: true,
    title: true,
    categoryId: true,
    token: { nullable: true },
    updatedAt: true,
  },
  primaryKey: ["id"],
  uniqueKeys: [["reference"]],
  foreignKeys: [foreignKey(["category_id"], "categories", ["id"])],
})

const catalog = catalogOf(categories, items)

function ref(target: string, key: string) {
  return descriptor({ kind: "ref", table: target, key: [key] })
}

describe("normalisation", () => {
  it("rejects a fixture targeting an unknown table", () => {
    const fixture = loaded({ table: "ghosts", rows: [{ id: 1 }] })

    expect(() => buildPlan([fixture], catalog)).toThrow(
      /base\/ghosts\.ts — targets unknown table "ghosts" — known tables: categories, items/
    )
  })

  it("rejects a fixture with no rows", () => {
    const fixture = loaded({ table: "categories", rows: [] })

    expect(() => buildPlan([fixture], catalog)).toThrow(
      "base/categories.ts — has no rows"
    )
  })

  it("rejects a column the table does not have, naming the row", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a" }, { slug: "b", nope: 1 }],
    })

    expect(() => buildPlan([fixture], catalog)).toThrow(
      'row 1 sets "nope", which is not a column of "categories"'
    )
  })

  it("maps camelCase properties onto physical column names", () => {
    const fixture = loaded({
      table: "items",
      rows: [{ reference: "I-1", categoryId: "c1", title: "T" }],
    })

    const [step] = buildPlan([fixture], catalog).steps

    expect(step?.rows[0]).toEqual({
      reference: "I-1",
      category_id: "c1",
      title: "T",
    })
  })

  it("drops columns explicitly set to undefined", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a", name: undefined }],
    })

    const [step] = buildPlan([fixture], catalog).steps

    expect(step?.rows[0]).toEqual({ slug: "a" })
    expect(step?.columns).toEqual(["slug"])
  })

  it("keeps a null, which is a value rather than an absence", () => {
    const fixture = loaded({
      table: "items",
      rows: [{ reference: "I-1", token: null }],
    })

    const [step] = buildPlan([fixture], catalog).steps

    expect(step?.rows[0]).toEqual({ reference: "I-1", token: null })
  })
})

describe("natural keys", () => {
  it("infers the key and records it per table", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a", name: "A" }],
    })

    const plan = buildPlan([fixture], catalog)

    expect(plan.steps[0]?.key).toEqual(["slug"])
    expect(plan.naturalKeys.get("categories")).toEqual(["slug"])
  })

  it("honours an explicit key, mapped to physical names", () => {
    const fixture = loaded({
      table: "items",
      rows: [{ reference: "I-1", categoryId: "c1" }],
      key: ["categoryId", "reference"],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.key).toEqual([
      "category_id",
      "reference",
    ])
  })

  it("rejects a row missing part of the key, naming the row and column", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a" }, { name: "B" }],
    })

    expect(() => buildPlan([fixture], catalog)).toThrow(
      'row 1 is missing "slug", which is part of the natural key'
    )
  })
})

describe("update columns", () => {
  it("defaults to every column set, minus the key", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a", name: "A" }],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.updateColumns).toEqual([
      "name",
    ])
  })

  it("excludes columns whose value came from a volatile helper", () => {
    const fixture = loaded({
      table: "items",
      rows: [
        {
          reference: "I-1",
          title: "T",
          token: descriptor({ kind: "random", length: 8 }),
        },
      ],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.updateColumns).toEqual([
      "title",
    ])
  })

  it("treats a column as volatile if any row makes it so", () => {
    const fixture = loaded({
      table: "items",
      rows: [
        { reference: "I-1", token: "fixed" },
        { reference: "I-2", token: descriptor({ kind: "uuid" }) },
      ],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.updateColumns).toEqual([])
  })

  it("keeps deterministic helpers overwritable", () => {
    const fixture = loaded({
      table: "items",
      rows: [
        {
          reference: "I-1",
          token: descriptor({ kind: "uuid", key: "stable" }),
        },
      ],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.updateColumns).toEqual([
      "token",
    ])
  })

  it("honours an explicit update list, mapped to physical names", () => {
    const fixture = loaded({
      table: "items",
      rows: [
        {
          reference: "I-1",
          title: "T",
          token: descriptor({ kind: "random", length: 8 }),
        },
      ],
      update: ["title", "token"],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.updateColumns).toEqual([
      "title",
      "token",
    ])
  })

  it("never lets the key be overwritten, even when listed explicitly", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a", name: "A" }],
      update: ["slug", "name"],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.updateColumns).toEqual([
      "name",
    ])
  })
})

describe("touch column", () => {
  it("picks up updatedAt when the table has one", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a", name: "A" }],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.touchColumn).toBe(
      "updated_at"
    )
  })

  it("is undefined when the table has no such column", () => {
    const plain = catalogOf(
      table("logs", {
        columns: { id: true, code: true },
        primaryKey: ["id"],
        uniqueKeys: [["code"]],
      })
    )

    const fixture = loaded({ table: "logs", rows: [{ code: "a" }] })

    expect(buildPlan([fixture], plain).steps[0]?.touchColumn).toBeUndefined()
  })
})

describe("only", () => {
  const categoriesFixture = loaded(
    { table: "categories", rows: [{ slug: "a", name: "A" }] },
    { tier: "base", file: "categories.ts" }
  )

  const itemsFixture = loaded(
    { table: "items", rows: [{ reference: "I-1" }] },
    { tier: "local", file: "example-items.ts" }
  )

  const both = [categoriesFixture, itemsFixture]

  it("selects everything when empty", () => {
    const plan = buildPlan(both, catalog, { only: [] })

    expect(plan.steps).toHaveLength(2)
    expect(plan.skipped).toHaveLength(0)
  })

  it.each([
    ["a table name", "items"],
    ["a tier", "local"],
    ["a file name", "example-items.ts"],
    ["a file stem", "example-items"],
  ])("matches on %s", (_label, needle) => {
    const plan = buildPlan(both, catalog, { only: [needle] })

    expect(plan.steps.map((step) => step.fixture.table)).toEqual(["items"])
    expect(plan.skipped.map((fixture) => fixture.table)).toEqual(["categories"])
  })

  it("fails when nothing matches, listing what is available", () => {
    expect(() => buildPlan(both, catalog, { only: ["nope"] })).toThrow(
      /--only — matched no fixtures — available: base, categories, items, local/
    )
  })

  it("still records natural keys for fixtures it filtered out", () => {
    const plan = buildPlan(both, catalog, { only: ["items"] })

    expect(plan.naturalKeys.get("categories")).toEqual(["slug"])
  })
})

describe("ordering and cycles", () => {
  it("orders steps by dependency", () => {
    const plan = buildPlan(
      [
        loaded({ table: "items", rows: [{ reference: "I-1" }] }),
        loaded({ table: "categories", rows: [{ slug: "a", name: "A" }] }),
      ],
      catalog
    )

    expect(plan.steps.map((step) => step.fixture.table)).toEqual([
      "categories",
      "items",
    ])
  })

  it("splits self-referencing rows into waves", () => {
    const treeCatalog = catalogOf(
      table("nodes", {
        columns: { id: true, slug: true, parentId: { nullable: true } },
        primaryKey: ["id"],
        uniqueKeys: [["slug"]],
        foreignKeys: [foreignKey(["parent_id"], "nodes", ["id"])],
      })
    )

    const fixture = loaded({
      table: "nodes",
      rows: [
        { slug: "child", parentId: ref("nodes", "root") },
        { slug: "root" },
      ],
    })

    expect(buildPlan([fixture], treeCatalog).steps[0]?.waves).toEqual([
      [1],
      [0],
    ])
  })

  it("is one wave when rows are independent", () => {
    const fixture = loaded({
      table: "categories",
      rows: [{ slug: "a" }, { slug: "b" }],
    })

    expect(buildPlan([fixture], catalog).steps[0]?.waves).toEqual([[0, 1]])
  })
})

describe("deferred columns and backfills", () => {
  const cyclic = catalogOf(
    table("users", {
      columns: { id: true, email: true, teamId: true },
      primaryKey: ["id"],
      uniqueKeys: [["email"]],
      foreignKeys: [foreignKey(["team_id"], "teams", ["id"])],
    }),
    table("teams", {
      columns: {
        id: true,
        slug: true,
        ownerId: { nullable: true },
        updatedAt: true,
      },
      primaryKey: ["id"],
      uniqueKeys: [["slug"]],
      foreignKeys: [foreignKey(["owner_id"], "users", ["id"])],
    })
  )

  const plan = buildPlan(
    [
      loaded({
        table: "users",
        rows: [{ email: "ana@e.com", teamId: ref("teams", "acme") }],
      }),
      loaded({
        table: "teams",
        rows: [{ slug: "acme", ownerId: ref("users", "ana@e.com") }],
      }),
    ],
    cyclic
  )

  it("leaves the deferred column out of the insert", () => {
    const teamsStep = plan.steps.find((step) => step.fixture.table === "teams")

    expect(teamsStep?.deferredColumns).toEqual(["owner_id"])
    expect(teamsStep?.columns).toEqual(["slug"])
  })

  it("emits a backfill carrying only the deferred columns", () => {
    expect(plan.backfills).toHaveLength(1)

    expect(plan.backfills[0]).toMatchObject({
      columns: ["owner_id"],
      key: ["slug"],
      touchColumn: "updated_at",
    })
  })

  it("never overwrites a deferred column on conflict", () => {
    const teamsStep = plan.steps.find((step) => step.fixture.table === "teams")

    expect(teamsStep?.updateColumns).not.toContain("owner_id")
  })

  it("emits no backfill when nothing was deferred", () => {
    const simple = buildPlan(
      [loaded({ table: "categories", rows: [{ slug: "a" }] })],
      catalog
    )

    expect(simple.backfills).toEqual([])
  })
})
