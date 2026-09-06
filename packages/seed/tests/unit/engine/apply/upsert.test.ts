import { describe, expect, it } from "vitest"
import type { AdapterRow } from "#src/adapter/index"
import { descriptor } from "#src/authoring/types"
import { postgresDialect } from "#src/dialect/postgres"
import { applyPlan } from "#src/engine/apply/upsert"
import { buildPlan } from "#src/engine/plan/build"
import { RecordingExecutor, type Responder } from "../../../support/executor"
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

function ref(target: string, key: string | string[], column?: string) {
  return descriptor({
    kind: "ref",
    table: target,
    key: Array.isArray(key) ? key : [key],
    column,
  })
}

function inserts(...rows: AdapterRow[]): Responder {
  return ({ text }) =>
    text.startsWith("INSERT")
      ? rows.map((row) => ({ __seed_inserted: true, ...row }))
      : []
}

const apply = (
  plan: ReturnType<typeof buildPlan>,
  executor: RecordingExecutor,
  options?: Parameters<typeof applyPlan>[4]
) => applyPlan(executor, catalog, postgresDialect, plan, options)

describe("counting", () => {
  const plan = buildPlan(
    [
      loaded({
        table: "categories",
        rows: [
          { slug: "a", name: "A" },
          { slug: "b", name: "B" },
        ],
      }),
    ],
    catalog
  )

  it("splits inserted from updated using the dialect's marker", async () => {
    const executor = new RecordingExecutor(({ text }) =>
      text.startsWith("INSERT")
        ? [
            { id: "c1", slug: "a", __seed_inserted: true },
            { id: "c2", slug: "b", __seed_inserted: false },
          ]
        : []
    )

    const [result] = await apply(plan, executor)

    expect(result).toMatchObject({ inserted: 1, updated: 1 })
  })

  it("reports the columns it would overwrite and defer", async () => {
    const [result] = await apply(plan, new RecordingExecutor())

    expect(result).toMatchObject({
      updateColumns: ["name"],
      deferredColumns: [],
      changes: [],
    })
  })

  it("issues one statement per wave", async () => {
    const executor = new RecordingExecutor()

    await apply(plan, executor)

    expect(executor.matching(/^INSERT/)).toHaveLength(1)
  })

  it("issues one statement per wave when rows depend on siblings", async () => {
    const tree = catalogOf(
      table("nodes", {
        columns: { id: true, slug: true, parentId: { nullable: true } },
        primaryKey: ["id"],
        uniqueKeys: [["slug"]],
        foreignKeys: [foreignKey(["parent_id"], "nodes", ["id"])],
      })
    )

    const nested = buildPlan(
      [
        loaded({
          table: "nodes",
          rows: [
            { slug: "child", parentId: ref("nodes", "root") },
            { slug: "root" },
          ],
        }),
      ],
      tree
    )

    const executor = new RecordingExecutor(({ text }) =>
      text.startsWith("INSERT")
        ? [{ id: "n1", slug: "root", __seed_inserted: true }]
        : []
    )

    await applyPlan(executor, tree, postgresDialect, nested)

    expect(executor.matching(/^INSERT/)).toHaveLength(2)
  })
})

describe("references", () => {
  const plan = buildPlan(
    [
      loaded({ table: "categories", rows: [{ slug: "tools", name: "Tools" }] }),
      loaded({
        table: "items",
        rows: [{ reference: "I-1", categoryId: ref("categories", "tools") }],
      }),
    ],
    catalog
  )

  it("resolves from a row written earlier in the same run", async () => {
    const executor = new RecordingExecutor(({ text }) =>
      text.includes('INTO "categories"')
        ? [{ id: "c1", slug: "tools", __seed_inserted: true }]
        : []
    )

    await apply(plan, executor)

    const [itemsInsert] = executor.matching(/INTO "items"/)

    expect(itemsInsert?.params).toContain("c1")
    expect(executor.matching(/^SELECT/)).toHaveLength(0)
  })

  it("infers the target column from the foreign key", async () => {
    const executor = new RecordingExecutor(({ text }) =>
      text.includes('INTO "categories"')
        ? [
            {
              id: "c1",
              slug: "tools",
              name: "Tools",
              __seed_inserted: true,
            },
          ]
        : []
    )

    await apply(plan, executor)

    expect(executor.matching(/INTO "items"/)[0]?.params).toContain("c1")
  })

  it("honours an explicit target column", async () => {
    const explicit = buildPlan(
      [
        loaded({
          table: "categories",
          rows: [{ slug: "tools", name: "Tools" }],
        }),
        loaded({
          table: "items",
          rows: [
            {
              reference: "I-1",
              title: ref("categories", "tools", "name"),
            },
          ],
        }),
      ],
      catalog
    )

    const executor = new RecordingExecutor(({ text }) =>
      text.includes('INTO "categories"')
        ? [{ id: "c1", slug: "tools", name: "Tools", __seed_inserted: true }]
        : []
    )

    await apply(explicit, executor)

    expect(executor.matching(/INTO "items"/)[0]?.params).toContain("Tools")
  })

  it("falls back to a select when the row was not written this run", async () => {
    const only = buildPlan(
      [
        loaded({ table: "categories", rows: [{ slug: "tools", name: "T" }] }),
        loaded({
          table: "items",
          rows: [{ reference: "I-1", categoryId: ref("categories", "tools") }],
        }),
      ],
      catalog,
      { only: ["items"] }
    )

    const executor = new RecordingExecutor(({ text }) =>
      text.startsWith("SELECT") ? [{ id: "c9", slug: "tools" }] : []
    )

    await apply(only, executor)

    const [select] = executor.matching(/^SELECT/)

    expect(select?.text).toContain('FROM "categories" WHERE "slug" IN ($1)')
    expect(select?.params).toEqual(["tools"])
    expect(executor.matching(/INTO "items"/)[0]?.params).toContain("c9")
  })

  it("selects only once for repeated references to the same row", async () => {
    const only = buildPlan(
      [
        loaded({ table: "categories", rows: [{ slug: "tools", name: "T" }] }),
        loaded({
          table: "items",
          rows: [
            { reference: "I-1", categoryId: ref("categories", "tools") },
            { reference: "I-2", categoryId: ref("categories", "tools") },
          ],
        }),
      ],
      catalog,
      { only: ["items"] }
    )

    const executor = new RecordingExecutor(({ text }) =>
      text.startsWith("SELECT") ? [{ id: "c9", slug: "tools" }] : []
    )

    await apply(only, executor)

    expect(executor.matching(/^SELECT/)).toHaveLength(1)
  })

  it("fails when the referenced row does not exist", async () => {
    const only = buildPlan(
      [
        loaded({ table: "categories", rows: [{ slug: "tools", name: "T" }] }),
        loaded({
          table: "items",
          rows: [{ reference: "I-1", categoryId: ref("categories", "gone") }],
        }),
      ],
      catalog,
      { only: ["items"] }
    )

    await expect(apply(only, new RecordingExecutor())).rejects.toThrow(
      /ref\("categories", "gone"\) found no row — seed "categories" first, or widen --only/
    )
  })

  it("fails when no fixture declares a natural key for the target", async () => {
    const orphan = buildPlan(
      [
        loaded({
          table: "items",
          rows: [{ reference: "I-1", categoryId: ref("categories", "tools") }],
        }),
      ],
      catalog
    )

    await expect(apply(orphan, new RecordingExecutor())).rejects.toThrow(
      /no fixture in this run declares a natural key for "categories"/
    )
  })

  it("fails when the key has the wrong number of values", async () => {
    const wrong = buildPlan(
      [
        loaded({ table: "categories", rows: [{ slug: "tools", name: "T" }] }),
        loaded({
          table: "items",
          rows: [
            {
              reference: "I-1",
              categoryId: ref("categories", ["tools", "extra"]),
            },
          ],
        }),
      ],
      catalog,
      { only: ["items"] }
    )

    await expect(apply(wrong, new RecordingExecutor())).rejects.toThrow(
      /natural key is \(slug\), so pass 1 value\(s\)/
    )
  })

  it("fails when the resolved row has no such column", async () => {
    const plan2 = buildPlan(
      [
        loaded({ table: "categories", rows: [{ slug: "tools", name: "T" }] }),
        loaded({
          table: "items",
          rows: [
            { reference: "I-1", title: ref("categories", "tools", "name") },
          ],
        }),
      ],
      catalog
    )

    const executor = new RecordingExecutor(({ text }) =>
      text.includes('INTO "categories"')
        ? [{ id: "c1", slug: "tools", __seed_inserted: true }]
        : []
    )

    await expect(apply(plan2, executor)).rejects.toThrow(
      /ref\("categories", "tools"\) — no column "name" on that row/
    )
  })

  it("fails when the target has no primary key to fall back on", async () => {
    const keyless = catalogOf(
      table("labels", {
        columns: { code: true, text: true },
        uniqueKeys: [["code"]],
      }),
      table("notes", {
        columns: { id: true, slug: true, labelCode: true },
        primaryKey: ["id"],
        uniqueKeys: [["slug"]],
      })
    )

    const plan2 = buildPlan(
      [
        loaded({ table: "labels", rows: [{ code: "x", text: "X" }] }),
        loaded({
          table: "notes",
          rows: [{ slug: "n1", labelCode: ref("labels", "x") }],
        }),
      ],
      keyless
    )

    const executor = new RecordingExecutor(({ text }) =>
      text.includes('INTO "labels"')
        ? [{ code: "x", text: "X", __seed_inserted: true }]
        : []
    )

    await expect(
      applyPlan(executor, keyless, postgresDialect, plan2)
    ).rejects.toThrow(
      /"labels" has no primary key, so name the column explicitly/
    )
  })
})

describe("backfills", () => {
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

  it("updates the deferred column after both tables exist", async () => {
    const executor = new RecordingExecutor(({ text }) => {
      if (text.includes('INTO "teams"')) {
        return [{ id: "t1", slug: "acme", __seed_inserted: true }]
      }

      if (text.includes('INTO "users"')) {
        return [{ id: "u1", email: "ana@e.com", __seed_inserted: true }]
      }

      return []
    })

    await applyPlan(executor, cyclic, postgresDialect, plan)

    const [update] = executor.matching(/^UPDATE/)

    expect(update?.text).toBe(
      'UPDATE "teams" SET "owner_id" = $1, "updated_at" = NOW() WHERE "slug" = $2'
    )

    expect(update?.params).toEqual(["u1", "acme"])
  })

  it("runs backfills after every insert", async () => {
    const executor = new RecordingExecutor(({ text }) =>
      text.startsWith("INSERT")
        ? [{ id: "x", slug: "acme", email: "ana@e.com", __seed_inserted: true }]
        : []
    )

    await applyPlan(executor, cyclic, postgresDialect, plan)

    const kinds = executor.statements.map((text) => text.split(" ")[0])

    expect(kinds).toEqual(["INSERT", "INSERT", "UPDATE"])
  })
})

describe("diff", () => {
  const plan = buildPlan(
    [
      loaded({
        table: "categories",
        rows: [
          { slug: "a", name: "Changed" },
          { slug: "b", name: "Same" },
          { slug: "c", name: "New" },
        ],
      }),
    ],
    catalog
  )

  const existing: Responder = ({ text }) =>
    text.startsWith("SELECT")
      ? [
          { id: "c1", slug: "a", name: "Before" },
          { id: "c2", slug: "b", name: "Same" },
        ]
      : []

  it("classifies each row as insert, update or unchanged", async () => {
    const [result] = await apply(plan, new RecordingExecutor(existing), {
      diff: true,
    })

    expect(result?.changes).toEqual([
      {
        key: "a",
        kind: "update",
        columns: [{ column: "name", before: "Before", after: "Changed" }],
      },
      { key: "b", kind: "unchanged", columns: [] },
      { key: "c", kind: "insert", columns: [] },
    ])
  })

  it("selects the existing rows by natural key before writing", async () => {
    const executor = new RecordingExecutor(existing)

    await apply(plan, executor, { diff: true })

    const [select] = executor.matching(/^SELECT/)

    expect(select?.params).toEqual(["a", "b", "c"])
  })

  it("records no changes when diff is off", async () => {
    const [result] = await apply(plan, new RecordingExecutor(existing))

    expect(result?.changes).toEqual([])
  })

  describe("value comparison", () => {
    async function changed(before: unknown, after: unknown) {
      const single = buildPlan(
        [
          loaded({
            table: "categories",
            rows: [{ slug: "a", name: after }],
          }),
        ],
        catalog
      )

      const executor = new RecordingExecutor(({ text }) =>
        text.startsWith("SELECT") ? [{ id: "c1", slug: "a", name: before }] : []
      )

      const [result] = await apply(single, executor, { diff: true })

      return result?.changes[0]?.kind
    }

    it.each([
      ["identical strings", "same", "same"],
      ["a number against its string", 1, "1"],
      ["both null", null, null],
      ["equal dates", new Date("2024-01-01"), new Date("2024-01-01")],
      [
        "a date against its iso string",
        new Date("2024-01-01"),
        "2024-01-01T00:00:00.000Z",
      ],
      ["equal buffers", Buffer.from("x"), Buffer.from("x")],
      ["equal arrays", [1, 2], [1, 2]],
      ["equal objects", { a: 1 }, { a: 1 }],
      ["nested equal objects", { a: { b: [1] } }, { a: { b: [1] } }],
    ])("treats %s as unchanged", async (_label, before, after) => {
      expect(await changed(before, after)).toBe("unchanged")
    })

    it.each([
      ["different strings", "one", "two"],
      ["null against a value", null, "value"],
      ["a value against null", "value", null],
      ["different dates", new Date("2024-01-01"), new Date("2024-01-02")],
      ["different buffers", Buffer.from("x"), Buffer.from("y")],
      ["arrays of different length", [1], [1, 2]],
      ["arrays with different members", [1, 2], [1, 3]],
      ["objects with different values", { a: 1 }, { a: 2 }],
      ["objects with different keys", { a: 1 }, { b: 1 }],
      ["an object with an extra key", { a: 1 }, { a: 1, b: 2 }],
    ])("treats %s as an update", async (_label, before, after) => {
      expect(await changed(before, after)).toBe("update")
    })
  })
})

describe("determinism", () => {
  it("resolves volatile helpers reproducibly when given a seed", async () => {
    const plan = buildPlan(
      [
        loaded({
          table: "items",
          rows: [
            {
              reference: "I-1",
              token: descriptor({ kind: "random", length: 8 }),
            },
          ],
        }),
      ],
      catalog
    )

    const run = async () => {
      const executor = new RecordingExecutor(inserts({ id: "i1" }))

      await apply(plan, executor, { seed: 99 })

      return executor.matching(/^INSERT/)[0]?.params
    }

    expect(await run()).toEqual(await run())
  })

  it("uses one clock for the whole run", async () => {
    const plan = buildPlan(
      [
        loaded({
          table: "categories",
          rows: [
            { slug: "a", name: descriptor({ kind: "now" }) },
            { slug: "b", name: descriptor({ kind: "now" }) },
          ],
        }),
      ],
      catalog
    )

    const executor = new RecordingExecutor(inserts({ id: "c1", slug: "a" }))

    await apply(plan, executor)

    const params = executor.matching(/^INSERT/)[0]?.params ?? []

    expect(params[1]).toBe(params[3])
  })
})
