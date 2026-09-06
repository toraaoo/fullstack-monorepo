import { describe, expect, it } from "vitest"
import {
  defineDialect,
  isRawSql,
  Query,
  RAW_SQL,
  raw,
} from "#src/dialect/index"
import { postgresDialect } from "#src/dialect/postgres"
import { table } from "../../support/metadata"

describe("raw", () => {
  it("brands an expression with a global symbol", () => {
    const expression = raw("NOW()")

    expect(expression.expression).toBe("NOW()")
    expect(expression[RAW_SQL]).toBe(true)
    expect(RAW_SQL).toBe(Symbol.for("workspace.seed.raw"))
  })
})

describe("isRawSql", () => {
  it("accepts branded expressions", () => {
    expect(isRawSql(raw("NOW()"))).toBe(true)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "NOW()"],
    ["a plain object", { expression: "NOW()" }],
  ])("rejects %s", (_label, value) => {
    expect(isRawSql(value)).toBe(false)
  })
})

describe("Query", () => {
  it("renders text, identifiers and parameters", () => {
    const query = new Query()
      .text("SELECT ")
      .identifier("id")
      .text(" FROM t WHERE x = ")
      .param(1)
      .text(" AND y = ")
      .param("two")

    expect(query.render(postgresDialect)).toEqual({
      text: 'SELECT "id" FROM t WHERE x = $1 AND y = $2',
      params: [1, "two"],
    })
  })

  it("emits raw fragments without quoting or binding", () => {
    const query = new Query().text("SET x = ").raw("NOW()")

    expect(query.render(postgresDialect)).toEqual({
      text: "SET x = NOW()",
      params: [],
    })
  })

  it("numbers placeholders by parameter order, not fragment order", () => {
    const query = new Query()
      .param("a")
      .raw(" || ")
      .identifier("b")
      .text(" || ")
      .param("c")

    expect(query.render(postgresDialect).text).toBe('$1 || "b" || $2')
  })

  it("binds ordinary values and inlines raw sql through value()", () => {
    const query = new Query().value("literal").text(", ").value(raw("NOW()"))

    expect(query.render(postgresDialect)).toEqual({
      text: "$1, NOW()",
      params: ["literal"],
    })
  })

  it("qualifies a table with its schema when it has one", () => {
    const unqualified = new Query().table(
      table("users", { columns: { id: true } })
    )

    const qualified = new Query().table(
      table("users", { schema: "app", columns: { id: true } })
    )

    expect(unqualified.render(postgresDialect).text).toBe('"users"')
    expect(qualified.render(postgresDialect).text).toBe('"app"."users"')
  })

  it("joins items with a separator and no trailing separator", () => {
    const query = new Query()

    query.join(["a", "b", "c"], ", ", (column) => query.identifier(column))

    expect(query.render(postgresDialect).text).toBe('"a", "b", "c"')
  })

  it("emits nothing when joining an empty list", () => {
    const query = new Query()

    query.join([], ", ", () => {
      throw new Error("must not be called")
    })

    expect(query.render(postgresDialect).text).toBe("")
  })

  it("passes the index to the join callback", () => {
    const seen: number[] = []

    const query = new Query()

    query.join(["a", "b"], ",", (_item, index) => {
      seen.push(index)
      query.text("x")
    })

    expect(seen).toEqual([0, 1])
  })

  it("carries the column a parameter belongs to for adapters to use", () => {
    const query = new Query().param("ana", { table: "users", name: "email" })

    expect(query.fragments).toEqual([
      {
        kind: "param",
        value: "ana",
        column: { table: "users", name: "email" },
      },
    ])
  })
})

describe("defineDialect", () => {
  it("returns the dialect unchanged, existing only to type it", () => {
    expect(defineDialect(postgresDialect)).toBe(postgresDialect)
  })
})
