import { describe, expect, it } from "vitest"
import { Catalog } from "#src/engine/plan/catalog"
import { SeedError } from "#src/errors"
import {
  catalogOf,
  column,
  foreignKey,
  metadata,
  table,
} from "../../../support/metadata"

const users = table("users", {
  columns: {
    id: true,
    email: true,
    teamId: true,
    displayName: { nullable: true },
  },
  primaryKey: ["id"],
  uniqueKeys: [["email"]],
  foreignKeys: [foreignKey(["team_id"], "teams", ["id"])],
})

const teams = table("teams", {
  columns: { id: true, slug: true },
  primaryKey: ["id"],
  uniqueKeys: [["slug"]],
})

describe("names", () => {
  it("lists every table, sorted", () => {
    expect(catalogOf(users, teams).names()).toEqual(["teams", "users"])
  })

  it("is empty for empty metadata", () => {
    expect(new Catalog({ tables: [] }).names()).toEqual([])
  })
})

describe("has", () => {
  it("reports whether a table is known", () => {
    const catalog = catalogOf(users)

    expect(catalog.has("users")).toBe(true)
    expect(catalog.has("teams")).toBe(false)
  })
})

describe("table", () => {
  it("returns the metadata", () => {
    expect(catalogOf(users).table("users")).toBe(users)
  })

  it("fails naming the tables it does know", () => {
    expect(() => catalogOf(users, teams).table("orders")).toThrow(
      'unknown table "orders" — known tables: teams, users'
    )
  })
})

describe("column lookup", () => {
  const catalog = catalogOf(users)

  it("finds a column by its property name", () => {
    expect(catalog.column("users", "teamId").name).toBe("team_id")
  })

  it("finds a column by its physical name", () => {
    expect(catalog.column("users", "team_id").property).toBe("teamId")
  })

  it("ignores case and underscores", () => {
    for (const spelling of ["teamid", "TEAMID", "Team_Id", "TEAM_ID"]) {
      expect(catalog.column("users", spelling).name).toBe("team_id")
    }
  })

  it("returns undefined from tryColumn for an unknown column", () => {
    expect(catalog.tryColumn("users", "nope")).toBeUndefined()
  })

  it("fails from column for an unknown column", () => {
    expect(() => catalog.column("users", "nope")).toThrow(
      '"nope" is not a column of "users"'
    )
  })

  it("still fails for an unknown table", () => {
    expect(() => catalog.tryColumn("orders", "id")).toThrow(SeedError)
  })

  it("prefers the property name when two columns collide on an alias", () => {
    const collided = catalogOf(
      table("odd", {
        columns: {
          teamId: { name: "team_id" },
          team_id: { name: "teamid" },
        },
      })
    )

    expect(collided.column("odd", "teamId").name).toBe("team_id")
    expect(collided.column("odd", "team_id").name).toBe("teamid")
  })

  it("maps a property to its physical name", () => {
    expect(catalog.physical("users", "teamId")).toBe("team_id")
    expect(catalog.physical("users", "email")).toBe("email")
  })

  it("reports nullability", () => {
    expect(catalog.nullable("users", "displayName")).toBe(true)
    expect(catalog.nullable("users", "email")).toBe(false)
  })
})

describe("naturalKey", () => {
  const catalog = catalogOf(users, teams)

  it("takes an explicit key and maps it to physical names", () => {
    expect(catalog.naturalKey("users", new Set(), ["teamId", "email"])).toEqual(
      ["team_id", "email"]
    )
  })

  it("ignores an empty explicit key and infers instead", () => {
    expect(catalog.naturalKey("users", new Set(["email"]), [])).toEqual([
      "email",
    ])
  })

  it("prefers a unique constraint over the primary key", () => {
    expect(catalog.naturalKey("users", new Set(["id", "email"]))).toEqual([
      "email",
    ])
  })

  it("falls back to the primary key when it is the only one covered", () => {
    expect(catalog.naturalKey("users", new Set(["id"]))).toEqual(["id"])
  })

  it("only considers keys the rows fully populate", () => {
    const composite = catalogOf(
      table("memberships", {
        columns: { orgSlug: true, userEmail: true, role: true },
        uniqueKeys: [["org_slug", "user_email"]],
      })
    )

    expect(
      composite.naturalKey(
        "memberships",
        new Set(["org_slug", "user_email", "role"])
      )
    ).toEqual(["org_slug", "user_email"])

    expect(() =>
      composite.naturalKey("memberships", new Set(["org_slug", "role"]))
    ).toThrow(/no unique constraint covered by the columns these rows set/)
  })

  it("fails when the table has no unique constraint at all", () => {
    const keyless = catalogOf(table("logs", { columns: { message: true } }))

    expect(() => keyless.naturalKey("logs", new Set(["message"]))).toThrow(
      /logs has no unique constraint covered/
    )
  })

  it("fails when more than one key would do, naming both", () => {
    const ambiguous = catalogOf(
      table("things", {
        columns: { id: true, slug: true, code: true },
        primaryKey: ["id"],
        uniqueKeys: [["slug"], ["code"]],
      })
    )

    expect(() =>
      ambiguous.naturalKey("things", new Set(["id", "slug", "code"]))
    ).toThrow(/more than one usable natural key \(slug, code\)/)
  })

  it("returns a copy so callers cannot mutate the metadata", () => {
    const key = catalog.naturalKey("teams", new Set(["slug"]))

    key.push("mutated")

    expect(catalog.naturalKey("teams", new Set(["slug"]))).toEqual(["slug"])
  })
})

describe("foreign keys", () => {
  const catalog = catalogOf(users, teams)

  it("lists a table's foreign keys", () => {
    expect(catalog.foreignKeys("users")).toEqual([
      { columns: ["team_id"], table: "teams", foreignColumns: ["id"] },
    ])

    expect(catalog.foreignKeys("teams")).toEqual([])
  })

  it("finds the key pointing at a given table", () => {
    expect(catalog.foreignKeyTo("users", "teams")?.columns).toEqual(["team_id"])

    expect(catalog.foreignKeyTo("users", "orders")).toBeUndefined()
  })

  it("finds the key a given column participates in", () => {
    expect(catalog.foreignKeyForColumn("users", "team_id")?.table).toBe("teams")
    expect(catalog.foreignKeyForColumn("users", "email")).toBeUndefined()
  })
})

describe("dependencies", () => {
  it("lists the tables a table points at", () => {
    expect(catalogOf(users, teams).dependencies("users")).toEqual(["teams"])
  })

  it("excludes a self-reference, which orders rows rather than tables", () => {
    const nodes = catalogOf(
      table("nodes", {
        columns: { id: true, parentId: { nullable: true } },
        primaryKey: ["id"],
        foreignKeys: [foreignKey(["parent_id"], "nodes", ["id"])],
      })
    )

    expect(nodes.dependencies("nodes")).toEqual([])
  })

  it("deduplicates two keys onto the same table", () => {
    const edges = catalogOf(
      table("edges", {
        columns: { fromId: true, toId: true },
        foreignKeys: [
          foreignKey(["from_id"], "nodes", ["id"]),
          foreignKey(["to_id"], "nodes", ["id"]),
        ],
      })
    )

    expect(edges.dependencies("edges")).toEqual(["nodes"])
  })
})

describe("construction", () => {
  it("indexes tables by their physical name", () => {
    const catalog = new Catalog(
      metadata(table("users", { schema: "app", columns: { id: true } }))
    )

    expect(catalog.table("users").schema).toBe("app")
  })

  it("keeps every column reachable", () => {
    const wide = new Catalog(
      metadata({
        name: "wide",
        columns: [column("a"), column("bCamel"), column("c_snake")],
        primaryKey: [],
        uniqueKeys: [],
        foreignKeys: [],
      })
    )

    expect(wide.physical("wide", "a")).toBe("a")
    expect(wide.physical("wide", "bCamel")).toBe("b_camel")
    expect(wide.physical("wide", "c_snake")).toBe("c_snake")
  })
})
