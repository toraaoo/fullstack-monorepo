import { randomBytes } from "node:crypto"
import { isAbsolute, join } from "node:path"
import { describe, expect, it } from "vitest"
import { defineSeedConfig, loadConfig } from "#src/config"
import { SeedError } from "#src/errors"
import { builtinHashers, selectHasher } from "#src/hashers"
import { tempTree } from "../support/temp"

const ADAPTER = `{
  dialect: { name: "stub" },
  metadata: async () => ({ tables: [] }),
  transaction: async (run) => run({ run: async () => [] }),
  close: async () => {},
}`

function config(body: string): string {
  return `export default ${body}`
}

describe("defineSeedConfig", () => {
  it("returns its input unchanged, existing only to type it", () => {
    const input = { adapter: {} as never }

    expect(defineSeedConfig(input)).toBe(input)
  })

  it("passes a factory through untouched", () => {
    const factory = () => ({ adapter: {} as never })

    expect(defineSeedConfig(factory)).toBe(factory)
  })
})

describe("discovery", () => {
  it("finds seed.config.ts in the given directory", async () => {
    const root = await tempTree({
      "seed.config.ts": config(`{ adapter: ${ADAPTER} }`),
    })

    expect((await loadConfig(root)).path).toBe(join(root, "seed.config.ts"))
  })

  it("walks up to a parent directory", async () => {
    const root = await tempTree({
      "seed.config.ts": config(`{ adapter: ${ADAPTER} }`),
      "apps/api/.keep": "",
    })

    const resolved = await loadConfig(join(root, "apps", "api"))

    expect(resolved.path).toBe(join(root, "seed.config.ts"))
  })

  it("fails when there is no config anywhere above the cwd", async () => {
    const root = await tempTree({ ".keep": "" })

    await expect(loadConfig(root)).rejects.toThrow(
      /no seed\.config\.ts found in .* or any parent — create one with defineSeedConfig\(\)/
    )
  })

  it("prefers an explicit path, resolved against the cwd", async () => {
    const root = await tempTree({
      "seed.config.ts": config(`{ adapter: ${ADAPTER}, baseTier: "wrong" }`),
      "custom/other.config.ts": config(
        `{ adapter: ${ADAPTER}, baseTier: "right" }`
      ),
    })

    const resolved = await loadConfig(root, "custom/other.config.ts")

    expect(resolved.baseTier).toBe("right")
  })

  it("accepts an absolute explicit path", async () => {
    const root = await tempTree({
      "other.config.ts": config(`{ adapter: ${ADAPTER} }`),
    })

    const path = join(root, "other.config.ts")

    expect((await loadConfig(root, path)).path).toBe(path)
  })

  it("fails when the explicit path does not exist", async () => {
    const root = await tempTree({ ".keep": "" })

    await expect(loadConfig(root, "missing.config.ts")).rejects.toThrow(
      /no config file at .*missing\.config\.ts/
    )
  })
})

describe("the exported value", () => {
  it("accepts a plain object", async () => {
    const root = await tempTree({
      "seed.config.ts": config(`{ adapter: ${ADAPTER} }`),
    })

    expect((await loadConfig(root)).adapter).toBeDefined()
  })

  it("calls a synchronous factory", async () => {
    const root = await tempTree({
      "seed.config.ts": config(
        `() => ({ adapter: ${ADAPTER}, baseTier: "from-factory" })`
      ),
    })

    expect((await loadConfig(root)).baseTier).toBe("from-factory")
  })

  it("awaits an asynchronous factory", async () => {
    const root = await tempTree({
      "seed.config.ts": config(
        `async () => ({ adapter: ${ADAPTER}, baseTier: "from-async" })`
      ),
    })

    expect((await loadConfig(root)).baseTier).toBe("from-async")
  })

  it("fails when the module has no default export", async () => {
    const root = await tempTree({
      "seed.config.ts": "export const adapter = {}",
    })

    await expect(loadConfig(root)).rejects.toThrow(
      /has no default export — export defineSeedConfig\(\{ \.\.\. \}\)/
    )
  })

  it("fails when no adapter is set", async () => {
    const root = await tempTree({
      "seed.config.ts": config('{ fixtures: "db/fixtures" }'),
    })

    await expect(loadConfig(root)).rejects.toThrow(/does not set an adapter/)
  })

  it("throws a SeedError rather than a bare Error", async () => {
    const root = await tempTree({ "seed.config.ts": "export const x = 1" })

    await expect(loadConfig(root)).rejects.toBeInstanceOf(SeedError)
  })
})

describe("defaults", () => {
  it("resolves fixtures to db/fixtures beside the config", async () => {
    const root = await tempTree({
      "seed.config.ts": config(`{ adapter: ${ADAPTER} }`),
    })

    const resolved = await loadConfig(root)

    expect(resolved.root).toBe(join(root, "db", "fixtures"))
    expect(resolved.baseTier).toBe("base")
    expect(resolved.protectedEnvironments).toEqual(["staging", "production"])
  })

  it("resolves a relative fixtures path against the config directory", async () => {
    const root = await tempTree({
      "nested/seed.config.ts": config(
        `{ adapter: ${ADAPTER}, fixtures: "seeds" }`
      ),
    })

    const resolved = await loadConfig(join(root, "nested"))

    expect(resolved.root).toBe(join(root, "nested", "seeds"))
  })

  it("uses an absolute fixtures path as given", async () => {
    const root = await tempTree({
      "seed.config.ts": config(
        `{ adapter: ${ADAPTER}, fixtures: "/srv/fixtures" }`
      ),
    })

    const resolved = await loadConfig(root)

    expect(isAbsolute(resolved.root)).toBe(true)
    expect(resolved.root).toBe("/srv/fixtures")
  })

  it("honours an explicit base tier and protected environments", async () => {
    const root = await tempTree({
      "seed.config.ts": config(
        `{ adapter: ${ADAPTER}, baseTier: "shared", protectedEnvironments: ["prod"] }`
      ),
    })

    const resolved = await loadConfig(root)

    expect(resolved.baseTier).toBe("shared")
    expect(resolved.protectedEnvironments).toEqual(["prod"])
  })

  it("allows protected environments to be emptied deliberately", async () => {
    const root = await tempTree({
      "seed.config.ts": config(
        `{ adapter: ${ADAPTER}, protectedEnvironments: [] }`
      ),
    })

    expect((await loadConfig(root)).protectedEnvironments).toEqual([])
  })

  it("exposes the built-in hashers when none are registered", async () => {
    const root = await tempTree({
      "seed.config.ts": config(`{ adapter: ${ADAPTER} }`),
    })

    expect((await loadConfig(root)).hashers).toBe(builtinHashers)
  })

  it("registers custom hashers beside the built-ins", async () => {
    const root = await tempTree({
      "seed.config.ts": config(
        `{ adapter: ${ADAPTER}, hashers: { argon2: (plain) => "argon2$" + plain } }`
      ),
    })

    const { hashers } = await loadConfig(root)

    expect(selectHasher("argon2", hashers)("x", randomBytes)).toBe("argon2$x")
    expect(hashers["better-auth"]).toBe(builtinHashers["better-auth"])
  })

  it("refuses a hasher that is not a function", async () => {
    const root = await tempTree({
      "seed.config.ts": config(
        `{ adapter: ${ADAPTER}, hashers: { argon2: "nope" } }`
      ),
    })

    await expect(loadConfig(root)).rejects.toThrow(
      'hashers["argon2"] is not a function'
    )
  })
})
