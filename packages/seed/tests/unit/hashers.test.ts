import { scryptSync } from "node:crypto"
import { describe, expect, it } from "vitest"
import { createRandomSource } from "#src/engine/apply/resolve"
import { SeedError } from "#src/errors"
import {
  builtinHashers,
  DEFAULT_HASHER,
  type Hasher,
  resolveHashers,
  selectHasher,
} from "#src/hashers"

const random = () => createRandomSource(7)

describe("builtinHashers", () => {
  it("defaults to scrypt", () => {
    expect(DEFAULT_HASHER).toBe("scrypt")
    expect(Object.keys(builtinHashers).sort()).toEqual([
      "better-auth",
      "scrypt",
    ])
  })
})

describe("scrypt", () => {
  it("produces a verifiable digest", () => {
    const value = selectHasher("scrypt")("hunter2", random())

    const [scheme, n, r, p, salt, derived] = value.split("$")

    expect(scheme).toBe("scrypt")
    expect([n, r, p]).toEqual(["16384", "8", "1"])

    const recomputed = scryptSync(
      "hunter2",
      Buffer.from(salt as string, "base64"),
      64,
      { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
    )

    expect(recomputed.toString("base64")).toBe(derived)
  })
})

describe("better-auth", () => {
  it("produces a digest better-auth can verify", () => {
    const value = selectHasher("better-auth")("Qwe123!!", random())

    const [salt, key] = value.split(":")

    expect(salt).toMatch(/^[0-9a-f]{32}$/)
    expect(key).toMatch(/^[0-9a-f]{128}$/)

    const recomputed = scryptSync("Qwe123!!", salt as string, 64, {
      N: 16_384,
      r: 16,
      p: 1,
      maxmem: 128 * 16_384 * 16 * 2,
    })

    expect(recomputed.toString("hex")).toBe(key)
  })

  it("normalizes the plaintext to NFKC, as better-auth does", () => {
    const composed = "café"

    const value = selectHasher("better-auth")(composed, random())
    const [salt, key] = value.split(":")

    const recomputed = scryptSync(
      composed.normalize("NFKC"),
      salt as string,
      64,
      {
        N: 16_384,
        r: 16,
        p: 1,
        maxmem: 128 * 16_384 * 16 * 2,
      }
    )

    expect(recomputed.toString("hex")).toBe(key)
  })

  it("salts every call", () => {
    const source = random()
    const hasher = selectHasher("better-auth")

    expect(hasher("Qwe123!!", source)).not.toBe(hasher("Qwe123!!", source))
  })
})

describe("resolveHashers", () => {
  it("returns the built-ins when nothing is registered", () => {
    expect(resolveHashers()).toBe(builtinHashers)
  })

  it("adds custom formats alongside the built-ins", () => {
    const argon2: Hasher = (plaintext) => `argon2$${plaintext}`
    const registry = resolveHashers({ argon2 })

    expect(selectHasher("argon2", registry)("x", random())).toBe("argon2$x")
    expect(registry.scrypt).toBe(builtinHashers.scrypt)
  })

  it("lets a custom format override a built-in", () => {
    const registry = resolveHashers({ scrypt: () => "overridden" })

    expect(selectHasher("scrypt", registry)("x", random())).toBe("overridden")
  })

  it("refuses an entry that is not a function", () => {
    expect(() =>
      resolveHashers({ argon2: "nope" as unknown as Hasher })
    ).toThrow(SeedError)
  })

  it("refuses an entry with an empty name", () => {
    expect(() => resolveHashers({ "": (() => "x") as Hasher })).toThrow(
      "hashers has an entry with an empty name"
    )
  })
})

describe("selectHasher", () => {
  it("names the available formats when one is unknown", () => {
    expect(() => selectHasher("argon2")).toThrow(
      /unknown format\. Available: better-auth, scrypt/
    )
  })
})
