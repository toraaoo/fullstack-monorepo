import { describe, expect, it } from "vitest"
import { createBuilder } from "#src/authoring/builder"

type Tables = {
  users: { id: string; email: string; teamId: string }
  teams: { id: string; slug: string }
}

const { defineFixture, ref } = createBuilder<Tables>()

describe("defineFixture", () => {
  it("passes the table, description, update list and rows through", () => {
    const fixture = defineFixture("users", {
      description: "seed users",
      update: ["email"],
      rows: [{ email: "ana@example.com" }],
    })

    expect(fixture).toEqual({
      table: "users",
      description: "seed users",
      key: undefined,
      update: ["email"],
      rows: [{ email: "ana@example.com" }],
    })
  })

  it("normalises a single-column key into an array", () => {
    expect(defineFixture("users", { key: "email", rows: [{}] }).key).toEqual([
      "email",
    ])
  })

  it("keeps a composite key as given", () => {
    const fixture = defineFixture("users", {
      key: ["teamId", "email"],
      rows: [{}],
    })

    expect(fixture.key).toEqual(["teamId", "email"])
  })

  it("leaves the key undefined so the catalog can infer it", () => {
    expect(defineFixture("users", { rows: [{}] }).key).toBeUndefined()
  })

  it("does not copy the rows array", () => {
    const rows = [{ email: "ana@example.com" }]

    expect(defineFixture("users", { rows }).rows).toBe(rows)
  })
})

describe("ref", () => {
  it("builds a ref descriptor from a single key", () => {
    expect(ref("teams", "acme")).toMatchObject({
      kind: "ref",
      table: "teams",
      key: ["acme"],
      column: undefined,
    })
  })

  it("builds a ref descriptor from a composite key", () => {
    expect(ref("teams", ["acme", "ana"])).toMatchObject({
      key: ["acme", "ana"],
    })
  })

  it("carries an explicit target column", () => {
    expect(ref("teams", "acme", "slug")).toMatchObject({ column: "slug" })
  })
})

describe("createBuilder", () => {
  it("ignores the table map it is handed, which exists only for types", () => {
    const builder = createBuilder({ users: { id: "" } })

    expect(Object.keys(builder).sort()).toEqual(["defineFixture", "ref"])
  })
})
