import { describe, expect, it } from "vitest"
import {
  DESCRIPTOR,
  descriptor,
  fixtureLabel,
  isDescriptor,
  isDeterministic,
} from "#src/authoring/types"
import { loaded } from "../../support/fixtures"

describe("descriptor", () => {
  it("brands the body without mutating it", () => {
    const body = { kind: "now" } as const
    const marked = descriptor(body)

    expect(marked).toMatchObject({ kind: "now" })
    expect(marked[DESCRIPTOR]).toBe(true)
    expect(DESCRIPTOR in body).toBe(false)
  })

  it("uses a global symbol so separate copies interoperate", () => {
    expect(DESCRIPTOR).toBe(Symbol.for("workspace.seed.descriptor"))
  })
})

describe("isDescriptor", () => {
  it("accepts branded objects", () => {
    expect(isDescriptor(descriptor({ kind: "uuid" }))).toBe(true)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "now()"],
    ["a number", 7],
    ["a plain object", { kind: "now" }],
    ["an array", [descriptor({ kind: "now" })]],
    ["a date", new Date()],
  ])("rejects %s", (_label, value) => {
    expect(isDescriptor(value)).toBe(false)
  })
})

describe("isDeterministic", () => {
  it.each([
    ["ref", descriptor({ kind: "ref", table: "users", key: ["ana"] }), true],
    ["env", descriptor({ kind: "env", name: "HOME" }), true],
    ["sql", descriptor({ kind: "sql", expression: "NOW()" }), true],
    ["file", descriptor({ kind: "file", path: "avatar.png" }), true],
    ["now", descriptor({ kind: "now" }), false],
    ["random", descriptor({ kind: "random", length: 8 }), false],
    ["hash", descriptor({ kind: "hash", plaintext: "hunter2" }), false],
    ["once", descriptor({ kind: "once", value: 1 }), false],
  ])("treats %s as deterministic=%s", (_label, value, expected) => {
    expect(isDeterministic(value)).toBe(expected)
  })

  it("treats a keyed uuid as deterministic and a bare one as volatile", () => {
    expect(isDeterministic(descriptor({ kind: "uuid", key: "ana" }))).toBe(true)
    expect(isDeterministic(descriptor({ kind: "uuid" }))).toBe(false)
  })
})

describe("fixtureLabel", () => {
  it("reads tier/file", () => {
    const fixture = loaded(
      { table: "users", rows: [{ email: "ana@example.com" }] },
      { tier: "local", file: "users.ts" }
    )

    expect(fixtureLabel(fixture)).toBe("local/users.ts")
  })
})
