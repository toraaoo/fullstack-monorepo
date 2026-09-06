import { describe, expect, it } from "vitest"
import {
  env,
  file,
  hash,
  now,
  once,
  random,
  sql,
  uuid,
} from "#src/authoring/helpers"
import { isDescriptor } from "#src/authoring/types"
import { SeedError } from "#src/errors"

describe("now", () => {
  it("carries no offset by default", () => {
    expect(now()).toMatchObject({ kind: "now", offset: undefined })
  })

  it("keeps the offset verbatim for the resolver to validate", () => {
    expect(now("-30d")).toMatchObject({ kind: "now", offset: "-30d" })
    expect(now("nonsense")).toMatchObject({ offset: "nonsense" })
  })
})

describe("uuid", () => {
  it("is random when given no key", () => {
    expect(uuid()).toMatchObject({ kind: "uuid", key: undefined })
  })

  it("is keyed when given one", () => {
    expect(uuid("ana")).toMatchObject({ kind: "uuid", key: "ana" })
  })
})

describe("random", () => {
  it("defaults to 32 characters", () => {
    expect(random()).toMatchObject({ kind: "random", length: 32 })
  })

  it("accepts the documented bounds", () => {
    expect(random(1)).toMatchObject({ length: 1 })
    expect(random(512)).toMatchObject({ length: 512 })
  })

  it.each([0, -1, 513, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects length %s",
    (length) => {
      expect(() => random(length)).toThrow(SeedError)
      expect(() => random(length)).toThrow(/length must be an integer 1\.\.512/)
    }
  )
})

describe("hash", () => {
  it("captures the plaintext", () => {
    expect(hash("hunter2")).toMatchObject({
      kind: "hash",
      plaintext: "hunter2",
    })
  })

  it("refuses an empty plaintext", () => {
    expect(() => hash("")).toThrow("hash() needs a plaintext")
  })
})

describe("env", () => {
  it("captures the name and optional fallback", () => {
    expect(env("SEED_OWNER")).toMatchObject({
      kind: "env",
      name: "SEED_OWNER",
      fallback: undefined,
    })

    expect(env("SEED_OWNER", "demo@example.com")).toMatchObject({
      fallback: "demo@example.com",
    })
  })

  it("refuses an empty name", () => {
    expect(() => env("")).toThrow("env() needs a variable name")
  })
})

describe("sql", () => {
  it("captures the expression", () => {
    expect(sql("NOW()")).toMatchObject({ kind: "sql", expression: "NOW()" })
  })

  it("refuses an empty expression", () => {
    expect(() => sql("")).toThrow("sql() needs an expression")
  })
})

describe("file", () => {
  it("captures the path and optional encoding", () => {
    expect(file("avatar.png")).toMatchObject({
      kind: "file",
      path: "avatar.png",
      encoding: undefined,
    })

    expect(file("body.md", "utf8")).toMatchObject({ encoding: "utf8" })
  })

  it("refuses an empty path", () => {
    expect(() => file("")).toThrow("file() needs a path")
  })
})

describe("once", () => {
  it("wraps any value, including another descriptor", () => {
    expect(once("static")).toMatchObject({ kind: "once", value: "static" })

    const wrapped = once(random(8))

    expect(wrapped).toMatchObject({ kind: "once" })
    expect(isDescriptor((wrapped as { value: unknown }).value)).toBe(true)
  })

  it("wraps undefined without complaint", () => {
    expect(once(undefined)).toMatchObject({ kind: "once", value: undefined })
  })
})

describe("every helper", () => {
  it("returns a branded descriptor", () => {
    const all = [
      now(),
      uuid(),
      random(),
      hash("x"),
      env("HOME"),
      sql("NOW()"),
      file("a.txt"),
      once(1),
    ]

    expect(all.every(isDescriptor)).toBe(true)
  })
})
