import { scryptSync } from "node:crypto"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { descriptor } from "#src/authoring/types"
import { isRawSql } from "#src/dialect/index"
import {
  createRandomSource,
  type ResolveContext,
  resolveRow,
  resolveValue,
} from "#src/engine/apply/resolve"
import { SeedError } from "#src/errors"
import { resolveHashers } from "#src/hashers"
import { tempTree } from "../../../support/temp"

const NOW = new Date("2024-06-15T12:00:00.000Z")

function context(overrides: Partial<ResolveContext> = {}): ResolveContext {
  return {
    now: NOW,
    directory: "/fixtures/base",
    random: createRandomSource(1),
    lookupRef: async () => "resolved-ref",
    ...overrides,
  }
}

const resolve = (value: unknown, overrides?: Partial<ResolveContext>) =>
  resolveValue(value, context(overrides))

describe("createRandomSource", () => {
  it("is deterministic for a given seed", () => {
    const a = createRandomSource(42)(16)
    const b = createRandomSource(42)(16)

    expect(a.equals(b)).toBe(true)
    expect(a).toHaveLength(16)
  })

  it("differs between seeds", () => {
    expect(createRandomSource(1)(16).equals(createRandomSource(2)(16))).toBe(
      false
    )
  })

  it("advances between draws from the same source", () => {
    const source = createRandomSource(42)

    expect(source(16).equals(source(16))).toBe(false)
  })

  it("is unpredictable when unseeded", () => {
    expect(createRandomSource()(16).equals(createRandomSource()(16))).toBe(
      false
    )
  })
})

describe("now", () => {
  it("returns the run clock unshifted", async () => {
    expect(await resolve(descriptor({ kind: "now" }))).toBe(NOW)
  })

  it.each([
    ["+1ms", "2024-06-15T12:00:00.001Z"],
    ["-30s", "2024-06-15T11:59:30.000Z"],
    ["+90m", "2024-06-15T13:30:00.000Z"],
    ["+2h", "2024-06-15T14:00:00.000Z"],
    ["-30d", "2024-05-16T12:00:00.000Z"],
    ["+1w", "2024-06-22T12:00:00.000Z"],
    ["+1M", "2024-07-15T12:00:00.000Z"],
    ["-1M", "2024-05-15T12:00:00.000Z"],
    ["+1y", "2025-06-15T12:00:00.000Z"],
  ])("shifts by %s", async (offset, expected) => {
    const shifted = await resolve(descriptor({ kind: "now", offset }))

    expect((shifted as Date).toISOString()).toBe(expected)
  })

  it("accepts a bare positive number without a sign", async () => {
    const shifted = await resolve(descriptor({ kind: "now", offset: "3d" }))

    expect((shifted as Date).toISOString()).toBe("2024-06-18T12:00:00.000Z")
  })

  it("tolerates whitespace around the offset", async () => {
    const shifted = await resolve(descriptor({ kind: "now", offset: " +1 d " }))

    expect((shifted as Date).toISOString()).toBe("2024-06-16T12:00:00.000Z")
  })

  it("does not mutate the run clock", async () => {
    await resolve(descriptor({ kind: "now", offset: "+1M" }))

    expect(NOW.toISOString()).toBe("2024-06-15T12:00:00.000Z")
  })

  it("treats an empty offset as no offset", async () => {
    expect(await resolve(descriptor({ kind: "now", offset: "" }))).toBe(NOW)
  })

  it.each(["tomorrow", "1", "d", "+1x", "1.5d"])(
    "rejects the offset %s",
    async (offset) => {
      await expect(
        resolve(descriptor({ kind: "now", offset }))
      ).rejects.toThrow(/expected an offset such as -30d, \+2h, \+1M/)
    }
  )
})

describe("uuid", () => {
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  it("produces a v4 uuid from the random source", async () => {
    const value = (await resolve(descriptor({ kind: "uuid" }))) as string

    expect(value).toMatch(UUID)
    expect(value[14]).toBe("4")
  })

  it("is reproducible for a given seed", async () => {
    const draw = () =>
      resolve(descriptor({ kind: "uuid" }), { random: createRandomSource(7) })

    expect(await draw()).toBe(await draw())
  })

  it("produces a stable v5 uuid from a key", async () => {
    const value = (await resolve(
      descriptor({ kind: "uuid", key: "ana" })
    )) as string

    expect(value).toMatch(UUID)
    expect(value[14]).toBe("5")
  })

  it("gives the same v5 uuid regardless of the random source", async () => {
    const keyed = descriptor({ kind: "uuid", key: "ana" })

    expect(await resolve(keyed, { random: createRandomSource(1) })).toBe(
      await resolve(keyed, { random: createRandomSource(999) })
    )
  })

  it("gives different v5 uuids for different keys", async () => {
    expect(await resolve(descriptor({ kind: "uuid", key: "ana" }))).not.toBe(
      await resolve(descriptor({ kind: "uuid", key: "bo" }))
    )
  })
})

describe("random", () => {
  it("produces hex of exactly the requested length", async () => {
    for (const length of [1, 2, 8, 31, 32, 64]) {
      const value = (await resolve(
        descriptor({ kind: "random", length })
      )) as string

      expect(value).toHaveLength(length)
      expect(value).toMatch(/^[0-9a-f]+$/)
    }
  })

  it("is reproducible for a given seed", async () => {
    const draw = () =>
      resolve(descriptor({ kind: "random", length: 16 }), {
        random: createRandomSource(3),
      })

    expect(await draw()).toBe(await draw())
  })
})

describe("hash", () => {
  it("produces a verifiable scrypt digest", async () => {
    const value = (await resolve(
      descriptor({ kind: "hash", plaintext: "hunter2", format: "scrypt" })
    )) as string

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

  it("salts each call, so the same plaintext hashes differently", async () => {
    const source = createRandomSource(5)
    const body = descriptor({
      kind: "hash",
      plaintext: "hunter2",
      format: "scrypt",
    })

    const first = await resolve(body, { random: source })
    const second = await resolve(body, { random: source })

    expect(first).not.toBe(second)
  })

  it("routes the descriptor format to the registry on the context", async () => {
    const value = await resolve(
      descriptor({ kind: "hash", plaintext: "hunter2", format: "argon2" }),
      { hashers: resolveHashers({ argon2: (plain) => `argon2$${plain}` }) }
    )

    expect(value).toBe("argon2$hunter2")
  })

  it("falls back to the built-in registry when the context has none", async () => {
    const value = (await resolve(
      descriptor({ kind: "hash", plaintext: "Qwe123!!", format: "better-auth" })
    )) as string

    expect(value).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/)
  })

  it("reports an unknown format", async () => {
    await expect(
      resolve(descriptor({ kind: "hash", plaintext: "x", format: "bcrypt" }))
    ).rejects.toThrow(/hash\(\.\.\., "bcrypt"\) — unknown format/)
  })
})

describe("env", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("reads the variable", async () => {
    vi.stubEnv("SEED_OWNER", "ana@example.com")

    expect(await resolve(descriptor({ kind: "env", name: "SEED_OWNER" }))).toBe(
      "ana@example.com"
    )
  })

  it("prefers the variable over the fallback", async () => {
    vi.stubEnv("SEED_OWNER", "ana@example.com")

    expect(
      await resolve(
        descriptor({ kind: "env", name: "SEED_OWNER", fallback: "demo" })
      )
    ).toBe("ana@example.com")
  })

  it("uses the fallback when unset", async () => {
    vi.stubEnv("SEED_OWNER", undefined)

    expect(
      await resolve(
        descriptor({ kind: "env", name: "SEED_OWNER", fallback: "demo" })
      )
    ).toBe("demo")
  })

  it("fails when unset with no fallback", async () => {
    vi.stubEnv("SEED_OWNER", undefined)

    await expect(
      resolve(descriptor({ kind: "env", name: "SEED_OWNER" }))
    ).rejects.toThrow('env("SEED_OWNER") is unset and has no fallback')
  })

  it("treats an empty string as set", async () => {
    vi.stubEnv("SEED_OWNER", "")

    expect(
      await resolve(
        descriptor({ kind: "env", name: "SEED_OWNER", fallback: "demo" })
      )
    ).toBe("")
  })
})

describe("sql", () => {
  it("becomes a raw expression the dialect will inline", async () => {
    const value = await resolve(
      descriptor({ kind: "sql", expression: "NOW()" })
    )

    expect(isRawSql(value)).toBe(true)
    expect((value as { expression: string }).expression).toBe("NOW()")
  })
})

describe("file", () => {
  it("reads a path relative to the fixture directory as a Buffer", async () => {
    const root = await tempTree({ "base/body.md": "# hello" })

    const value = await resolve(descriptor({ kind: "file", path: "body.md" }), {
      directory: join(root, "base"),
    })

    expect(Buffer.isBuffer(value)).toBe(true)
    expect((value as Buffer).toString()).toBe("# hello")
  })

  it("decodes when given an encoding", async () => {
    const root = await tempTree({ "base/body.md": "# hello" })

    expect(
      await resolve(
        descriptor({ kind: "file", path: "body.md", encoding: "utf8" }),
        { directory: join(root, "base") }
      )
    ).toBe("# hello")
  })

  it("accepts an absolute path", async () => {
    const root = await tempTree({ "body.md": "absolute" })

    expect(
      await resolve(
        descriptor({
          kind: "file",
          path: join(root, "body.md"),
          encoding: "utf8",
        })
      )
    ).toBe("absolute")
  })

  it("propagates a read failure", async () => {
    await expect(
      resolve(descriptor({ kind: "file", path: "missing.md" }))
    ).rejects.toThrow(/ENOENT/)
  })
})

describe("ref", () => {
  it("delegates to the lookup, passing the column it is filling", async () => {
    const lookupRef = vi.fn().mockResolvedValue("category-1")

    const resolved = await resolveRow(
      {
        category_id: descriptor({
          kind: "ref",
          table: "categories",
          key: ["tools"],
        }),
      },
      ["category_id"],
      "items",
      context({ lookupRef })
    )

    expect(resolved).toEqual({ category_id: "category-1" })

    expect(lookupRef).toHaveBeenCalledWith({
      table: "categories",
      key: ["tools"],
      column: undefined,
      from: { table: "items", column: "category_id" },
    })
  })

  it("passes an explicit target column through", async () => {
    const lookupRef = vi.fn().mockResolvedValue("tools")

    await resolve(
      descriptor({
        kind: "ref",
        table: "categories",
        key: ["tools"],
        column: "slug",
      }),
      { lookupRef }
    )

    expect(lookupRef).toHaveBeenCalledWith(
      expect.objectContaining({ column: "slug" })
    )
  })
})

describe("once", () => {
  it("resolves the value it wraps", async () => {
    expect(await resolve(descriptor({ kind: "once", value: "static" }))).toBe(
      "static"
    )
  })

  it("resolves a descriptor it wraps", async () => {
    const value = await resolve(
      descriptor({
        kind: "once",
        value: descriptor({ kind: "now", offset: "+1d" }),
      })
    )

    expect((value as Date).toISOString()).toBe("2024-06-16T12:00:00.000Z")
  })
})

describe("resolveValue", () => {
  it.each([
    ["a string", "plain"],
    ["a number", 42],
    ["a boolean", true],
    ["null", null],
    ["undefined", undefined],
  ])("passes %s through untouched", async (_label, value) => {
    expect(await resolve(value)).toBe(value)
  })

  it("passes a Date through by identity", async () => {
    const date = new Date("2020-01-01")

    expect(await resolve(date)).toBe(date)
  })

  it("passes a Buffer through by identity", async () => {
    const buffer = Buffer.from("bytes")

    expect(await resolve(buffer)).toBe(buffer)
  })

  it("resolves descriptors nested in arrays", async () => {
    const value = await resolve([
      "a",
      descriptor({ kind: "now" }),
      [descriptor({ kind: "sql", expression: "NOW()" })],
    ])

    expect((value as unknown[])[0]).toBe("a")
    expect((value as unknown[])[1]).toBe(NOW)
    expect(isRawSql((value as unknown[][])[2]?.[0])).toBe(true)
  })

  it("resolves descriptors nested in objects", async () => {
    const value = await resolve({
      grade: "alpha",
      at: descriptor({ kind: "now" }),
      nested: { deep: descriptor({ kind: "env", name: "PATH" }) },
    })

    expect(value).toMatchObject({ grade: "alpha", at: NOW })
    expect((value as { nested: { deep: string } }).nested.deep).toBeTypeOf(
      "string"
    )
  })

  it("returns a new object rather than mutating the fixture", async () => {
    const source = { at: descriptor({ kind: "now" }) }

    const resolved = await resolve(source)

    expect(resolved).not.toBe(source)
    expect(source.at).toMatchObject({ kind: "now" })
  })
})

describe("resolveRow", () => {
  it("resolves only the requested columns", async () => {
    const row = {
      slug: "tools",
      name: "Tools",
      at: descriptor({ kind: "now" }),
    }

    expect(
      await resolveRow(row, ["slug", "at"], "categories", context())
    ).toEqual({ slug: "tools", at: NOW })
  })

  it("skips a column the row does not set at all", async () => {
    const resolved = await resolveRow(
      { slug: "tools" },
      ["slug", "name"],
      "categories",
      context()
    )

    expect(resolved).toEqual({ slug: "tools" })
    expect("name" in resolved).toBe(false)
  })

  it("keeps a column explicitly set to undefined", async () => {
    const resolved = await resolveRow(
      { slug: "tools", name: undefined },
      ["slug", "name"],
      "categories",
      context()
    )

    expect("name" in resolved).toBe(true)
    expect(resolved.name).toBeUndefined()
  })

  it("throws a SeedError for a bad descriptor", async () => {
    await expect(
      resolveRow(
        { at: descriptor({ kind: "now", offset: "nope" }) },
        ["at"],
        "categories",
        context()
      )
    ).rejects.toBeInstanceOf(SeedError)
  })
})
