import { describe, expect, it } from "vitest"
import { descriptor } from "#src/authoring/types"
import {
  descriptorsIn,
  KEY_SEPARATOR,
  orderFixtures,
  orderRows,
  referencedTables,
  refsIn,
} from "#src/engine/plan/graph"
import { loaded } from "../../../support/fixtures"
import { catalogOf, foreignKey, table } from "../../../support/metadata"

function ref(target: string, key: string | string[]) {
  return descriptor({
    kind: "ref",
    table: target,
    key: Array.isArray(key) ? key : [key],
  })
}

describe("refsIn", () => {
  it("finds a ref used directly as a value", () => {
    expect(refsIn(ref("teams", "acme"))).toMatchObject([{ table: "teams" }])
  })

  it("finds refs nested in arrays and objects", () => {
    const value = {
      owner: ref("users", "ana"),
      tags: [{ team: ref("teams", "acme") }],
    }

    expect(refsIn(value).map((entry) => entry.table)).toEqual([
      "users",
      "teams",
    ])
  })

  it("looks inside once()", () => {
    expect(
      refsIn(descriptor({ kind: "once", value: ref("teams", "acme") }))
    ).toMatchObject([{ table: "teams" }])
  })

  it("does not descend into other descriptors", () => {
    expect(refsIn(descriptor({ kind: "now" }))).toEqual([])
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a scalar", 42],
    ["an empty object", {}],
  ])("finds nothing in %s", (_label, value) => {
    expect(refsIn(value)).toEqual([])
  })
})

describe("referencedTables", () => {
  it("collects every table referenced across all rows", () => {
    const fixture = loaded({
      table: "items",
      rows: [
        { categoryId: ref("categories", "tools") },
        { ownerId: ref("users", "ana"), categoryId: ref("categories", "toys") },
      ],
    })

    expect([...referencedTables(fixture)].sort()).toEqual([
      "categories",
      "users",
    ])
  })
})

describe("descriptorsIn", () => {
  it("collects every descriptor, including the one wrapped by once()", () => {
    const inner = descriptor({ kind: "random", length: 8 })

    const found = descriptorsIn({
      token: descriptor({ kind: "once", value: inner }),
      at: descriptor({ kind: "now" }),
    })

    expect(found.map((entry) => entry.kind)).toEqual(["once", "random", "now"])
  })

  it("walks arrays and nested objects", () => {
    const found = descriptorsIn([
      { a: descriptor({ kind: "now" }) },
      [descriptor({ kind: "uuid" })],
    ])

    expect(found.map((entry) => entry.kind)).toEqual(["now", "uuid"])
  })
})

describe("orderFixtures", () => {
  const catalog = catalogOf(
    table("teams", {
      columns: { id: true, slug: true },
      primaryKey: ["id"],
      uniqueKeys: [["slug"]],
    }),
    table("users", {
      columns: { id: true, email: true, teamId: true },
      primaryKey: ["id"],
      uniqueKeys: [["email"]],
      foreignKeys: [foreignKey(["team_id"], "teams", ["id"])],
    }),
    table("posts", {
      columns: { id: true, slug: true, authorId: true },
      primaryKey: ["id"],
      uniqueKeys: [["slug"]],
      foreignKeys: [foreignKey(["author_id"], "users", ["id"])],
    })
  )

  const teams = loaded({ table: "teams", rows: [{ slug: "acme" }] })
  const users = loaded({ table: "users", rows: [{ email: "ana@e.com" }] })
  const posts = loaded({ table: "posts", rows: [{ slug: "hello" }] })

  it("sorts dependencies before dependents regardless of input order", () => {
    const { ordered } = orderFixtures([posts, users, teams], catalog)

    expect(ordered.map((fixture) => fixture.table)).toEqual([
      "teams",
      "users",
      "posts",
    ])
  })

  it("defers nothing when the graph is acyclic", () => {
    expect(orderFixtures([posts, users, teams], catalog).deferred.size).toBe(0)
  })

  it("ignores dependencies on tables no fixture produces", () => {
    const { ordered } = orderFixtures([posts], catalog)

    expect(ordered.map((fixture) => fixture.table)).toEqual(["posts"])
  })

  it("orders on a ref even without a foreign key constraint", () => {
    const looseCatalog = catalogOf(
      table("teams", {
        columns: { id: true, slug: true },
        primaryKey: ["id"],
        uniqueKeys: [["slug"]],
      }),
      table("audits", {
        columns: { id: true, code: true, teamId: true },
        primaryKey: ["id"],
        uniqueKeys: [["code"]],
      })
    )

    const audits = loaded({
      table: "audits",
      rows: [{ code: "a1", teamId: ref("teams", "acme") }],
    })

    const { ordered } = orderFixtures([audits, teams], looseCatalog)

    expect(ordered.map((fixture) => fixture.table)).toEqual(["teams", "audits"])
  })

  it("keeps every fixture for a table before its dependents", () => {
    const moreUsers = loaded(
      { table: "users", rows: [{ email: "bo@e.com" }] },
      { file: "more-users.ts" }
    )

    const { ordered } = orderFixtures([posts, users, moreUsers, teams], catalog)

    const tables = ordered.map((fixture) => fixture.table)

    expect(tables).toEqual(["teams", "users", "users", "posts"])
  })

  describe("cycles", () => {
    const cyclic = catalogOf(
      table("users", {
        columns: { id: true, email: true, teamId: true },
        primaryKey: ["id"],
        uniqueKeys: [["email"]],
        foreignKeys: [foreignKey(["team_id"], "teams", ["id"])],
      }),
      table("teams", {
        columns: { id: true, slug: true, ownerId: { nullable: true } },
        primaryKey: ["id"],
        uniqueKeys: [["slug"]],
        foreignKeys: [foreignKey(["owner_id"], "users", ["id"])],
      })
    )

    it("breaks a cycle on the nullable side and records the deferred column", () => {
      const cyclicTeams = loaded({
        table: "teams",
        rows: [{ slug: "acme", owner_id: ref("users", "ana") }],
      })

      const cyclicUsers = loaded({
        table: "users",
        rows: [{ email: "ana@e.com", team_id: ref("teams", "acme") }],
      })

      const { ordered, deferred } = orderFixtures(
        [cyclicUsers, cyclicTeams],
        cyclic
      )

      expect(ordered.map((fixture) => fixture.table)).toEqual([
        "teams",
        "users",
      ])

      expect(deferred.get("base/teams.ts")).toEqual(["owner_id"])
    })

    it("fails when every foreign key in the cycle is NOT NULL", () => {
      const rigid = catalogOf(
        table("users", {
          columns: { id: true, email: true, teamId: true },
          primaryKey: ["id"],
          uniqueKeys: [["email"]],
          foreignKeys: [foreignKey(["team_id"], "teams", ["id"])],
        }),
        table("teams", {
          columns: { id: true, slug: true, ownerId: true },
          primaryKey: ["id"],
          uniqueKeys: [["slug"]],
          foreignKeys: [foreignKey(["owner_id"], "users", ["id"])],
        })
      )

      expect(() =>
        orderFixtures(
          [
            loaded({ table: "users", rows: [{ email: "ana@e.com" }] }),
            loaded({ table: "teams", rows: [{ slug: "acme" }] }),
          ],
          rigid
        )
      ).toThrow(/circular dependency between .* every foreign key in the cycle/)
    })
  })
})

describe("orderRows", () => {
  const nodes = loaded({
    table: "nodes",
    rows: [
      { slug: "grandchild", parentId: ref("nodes", "child") },
      { slug: "child", parentId: ref("nodes", "root") },
      { slug: "root" },
    ],
  })

  it("returns a single wave when no row references a sibling", () => {
    const flat = loaded({
      table: "nodes",
      rows: [{ slug: "a" }, { slug: "b" }],
    })

    expect(orderRows(flat, ["slug"])).toEqual([[0, 1]])
  })

  it("splits self-referencing rows into dependency-ordered waves", () => {
    expect(orderRows(nodes, ["slug"])).toEqual([[2], [1], [0]])
  })

  it("ignores refs to other tables", () => {
    const fixture = loaded({
      table: "nodes",
      rows: [
        { slug: "a", ownerId: ref("users", "ana") },
        { slug: "b", ownerId: ref("users", "bo") },
      ],
    })

    expect(orderRows(fixture, ["slug"])).toEqual([[0, 1]])
  })

  it("ignores a ref whose target is not in this fixture", () => {
    const fixture = loaded({
      table: "nodes",
      rows: [{ slug: "a", parentId: ref("nodes", "absent") }],
    })

    expect(orderRows(fixture, ["slug"])).toEqual([[0]])
  })

  it("tolerates a row that references itself", () => {
    const fixture = loaded({
      table: "nodes",
      rows: [
        { slug: "a", parentId: ref("nodes", "a") },
        { slug: "b", parentId: ref("nodes", "a") },
      ],
    })

    expect(orderRows(fixture, ["slug"])).toEqual([[0], [1]])
  })

  it("fails when two rows reference each other", () => {
    const fixture = loaded({
      table: "nodes",
      rows: [
        { slug: "a", parentId: ref("nodes", "b") },
        { slug: "b", parentId: ref("nodes", "a") },
      ],
    })

    expect(() => orderRows(fixture, ["slug"])).toThrow(
      /rows reference each other in a cycle through "nodes"/
    )
  })

  it("matches composite keys on the separator", () => {
    const fixture = loaded({
      table: "pairs",
      rows: [
        { org: "acme", user: "bo", inviterUser: ref("pairs", ["acme", "ana"]) },
        { org: "acme", user: "ana" },
      ],
    })

    expect(orderRows(fixture, ["org", "user"])).toEqual([[1], [0]])
    expect(KEY_SEPARATOR).toBe("|")
  })
})
