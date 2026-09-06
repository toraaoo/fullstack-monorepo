import { describe, expect, it } from "vitest"
import { raw } from "#src/dialect/index"
import { postgresDialect } from "#src/dialect/postgres"
import { table } from "../../support/metadata"

const users = table("users", {
  columns: { id: true, email: true, name: true, updatedAt: true },
  primaryKey: ["id"],
})

function sql(query: ReturnType<typeof postgresDialect.upsert>) {
  return query.render(postgresDialect)
}

describe("identity", () => {
  it("names itself and its inserted marker", () => {
    expect(postgresDialect.name).toBe("postgres")
    expect(postgresDialect.insertedColumn).toBe("__seed_inserted")
  })
})

describe("quoteIdentifier", () => {
  it("wraps in double quotes", () => {
    expect(postgresDialect.quoteIdentifier("email")).toBe('"email"')
  })

  it("doubles embedded quotes so identifiers cannot break out", () => {
    expect(postgresDialect.quoteIdentifier('we"ird')).toBe('"we""ird"')
    expect(postgresDialect.quoteIdentifier('a"; DROP TABLE t; --')).toBe(
      '"a""; DROP TABLE t; --"'
    )
  })
})

describe("placeholder", () => {
  it("is one-based and dollar-prefixed", () => {
    expect(postgresDialect.placeholder(1)).toBe("$1")
    expect(postgresDialect.placeholder(12)).toBe("$12")
  })
})

describe("upsert", () => {
  const base = {
    table: users,
    columns: ["email", "name"],
    conflictColumns: ["email"],
    updateColumns: ["name"],
    returning: ["id", "email"],
  }

  it("builds a multi-row insert with a conflict target and returning clause", () => {
    const { text, params } = sql(
      postgresDialect.upsert({
        ...base,
        rows: [
          { email: "ana@example.com", name: "Ana" },
          { email: "bo@example.com", name: "Bo" },
        ],
      })
    )

    expect(text).toBe(
      'INSERT INTO "users" ("email", "name") VALUES ($1, $2), ($3, $4)' +
        ' ON CONFLICT ("email") DO UPDATE SET "name" = EXCLUDED."name"' +
        ' RETURNING "id", "email", (xmax = 0) AS "__seed_inserted"'
    )

    expect(params).toEqual(["ana@example.com", "Ana", "bo@example.com", "Bo"])
  })

  it("writes DEFAULT for a column the row does not set", () => {
    const { text, params } = sql(
      postgresDialect.upsert({
        ...base,
        rows: [{ email: "ana@example.com" }],
      })
    )

    expect(text).toContain("VALUES ($1, DEFAULT)")
    expect(params).toEqual(["ana@example.com"])
  })

  it("inlines raw sql instead of binding it", () => {
    const { text, params } = sql(
      postgresDialect.upsert({
        ...base,
        columns: ["email", "updatedAt"],
        rows: [{ email: "ana@example.com", updatedAt: raw("NOW()") }],
      })
    )

    expect(text).toContain("VALUES ($1, NOW())")
    expect(params).toEqual(["ana@example.com"])
  })

  it("touches the timestamp column only alongside real updates", () => {
    const touched = sql(
      postgresDialect.upsert({
        ...base,
        rows: [{ email: "ana@example.com", name: "Ana" }],
        touchColumn: "updated_at",
      })
    ).text

    expect(touched).toContain(
      'DO UPDATE SET "name" = EXCLUDED."name", "updated_at" = NOW()'
    )
  })

  it("does not touch the timestamp when nothing is overwritten", () => {
    const untouched = sql(
      postgresDialect.upsert({
        ...base,
        rows: [{ email: "ana@example.com", name: "Ana" }],
        updateColumns: [],
        touchColumn: "updated_at",
      })
    ).text

    expect(untouched).not.toContain("updated_at")
  })

  it("degenerates to a self-assignment when no column is overwritten", () => {
    const { text } = sql(
      postgresDialect.upsert({
        ...base,
        rows: [{ email: "ana@example.com", name: "Ana" }],
        updateColumns: [],
      })
    )

    expect(text).toContain(
      'ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"'
    )
  })

  it("supports a composite conflict target", () => {
    const { text } = sql(
      postgresDialect.upsert({
        ...base,
        conflictColumns: ["email", "name"],
        rows: [{ email: "ana@example.com", name: "Ana" }],
      })
    )

    expect(text).toContain('ON CONFLICT ("email", "name")')
  })

  it("qualifies the table with its schema", () => {
    const { text } = sql(
      postgresDialect.upsert({
        ...base,
        table: table("users", { schema: "app", columns: { id: true } }),
        rows: [{ email: "ana@example.com", name: "Ana" }],
      })
    )

    expect(text).toMatch(/^INSERT INTO "app"\."users" /)
  })
})

describe("update", () => {
  it("sets each value and filters on the whole where clause", () => {
    const { text, params } = sql(
      postgresDialect.update({
        table: users,
        values: { name: "Ana", email: "ana@example.com" },
        where: { id: "u1" },
      })
    )

    expect(text).toBe(
      'UPDATE "users" SET "name" = $1, "email" = $2 WHERE "id" = $3'
    )

    expect(params).toEqual(["Ana", "ana@example.com", "u1"])
  })

  it("ands together a composite where clause", () => {
    const { text } = sql(
      postgresDialect.update({
        table: users,
        values: { name: "Ana" },
        where: { email: "ana@example.com", id: "u1" },
      })
    )

    expect(text).toContain('WHERE "email" = $2 AND "id" = $3')
  })

  it("always touches the timestamp column when given one", () => {
    const { text } = sql(
      postgresDialect.update({
        table: users,
        values: { name: "Ana" },
        where: { id: "u1" },
        touchColumn: "updated_at",
      })
    )

    expect(text).toContain('SET "name" = $1, "updated_at" = NOW() WHERE')
  })

  it("inlines raw sql in both values and where", () => {
    const { text, params } = sql(
      postgresDialect.update({
        table: users,
        values: { name: raw("UPPER(name)") },
        where: { id: raw("gen_random_uuid()") },
      })
    )

    expect(text).toBe(
      'UPDATE "users" SET "name" = UPPER(name) WHERE "id" = gen_random_uuid()'
    )

    expect(params).toEqual([])
  })
})

describe("select", () => {
  it("uses IN for a single-column key", () => {
    const { text, params } = sql(
      postgresDialect.select({
        table: users,
        columns: ["id", "email"],
        keyColumns: ["email"],
        keys: [["ana@example.com"], ["bo@example.com"]],
      })
    )

    expect(text).toBe(
      'SELECT "id", "email" FROM "users" WHERE "email" IN ($1, $2)'
    )

    expect(params).toEqual(["ana@example.com", "bo@example.com"])
  })

  it("uses a row constructor for a composite key", () => {
    const { text, params } = sql(
      postgresDialect.select({
        table: users,
        columns: ["id"],
        keyColumns: ["email", "name"],
        keys: [
          ["ana@example.com", "Ana"],
          ["bo@example.com", "Bo"],
        ],
      })
    )

    expect(text).toBe(
      'SELECT "id" FROM "users" WHERE ("email", "name") IN' +
        " (($1, $2), ($3, $4))"
    )

    expect(params).toEqual(["ana@example.com", "Ana", "bo@example.com", "Bo"])
  })

  it("qualifies the table with its schema", () => {
    const { text } = sql(
      postgresDialect.select({
        table: table("users", { schema: "app", columns: { id: true } }),
        columns: ["id"],
        keyColumns: ["id"],
        keys: [["u1"]],
      })
    )

    expect(text).toContain('FROM "app"."users"')
  })
})

describe("truncate", () => {
  it("truncates every table in one statement, restarting identities", () => {
    const { text } = sql(
      postgresDialect.truncate({
        tables: [users, table("teams", { columns: { id: true } })],
      })
    )

    expect(text).toBe(
      'TRUNCATE TABLE "users", "teams" RESTART IDENTITY CASCADE'
    )
  })
})

describe("introspect", () => {
  it("is a single raw statement selecting a tables aggregate", () => {
    const { text, params } = sql(postgresDialect.introspect())

    expect(params).toEqual([])
    expect(text).toContain("AS tables")
    expect(text).toContain("CURRENT_SCHEMAS(FALSE)")
    expect(text).not.toContain("$1")
  })
})
