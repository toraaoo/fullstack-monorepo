import { describe, expect, it, vi } from "vitest"
import {
  type CommonArgs,
  toSeedOptions,
  warnMissingTiers,
  withConfig,
} from "#src/cli/options"
import { SeedError } from "#src/errors"
import { tempTree } from "../../support/temp"

describe("toSeedOptions", () => {
  it("carries the environment, force flag and nothing else by default", () => {
    expect(toSeedOptions({ environment: "local", force: true })).toEqual({
      environment: "local",
      only: [],
      seed: undefined,
      force: true,
    })
  })

  it("splits a comma-separated only list", () => {
    expect(toSeedOptions({ only: "items,categories" }).only).toEqual([
      "items",
      "categories",
    ])
  })

  it("accepts a repeated flag as an array", () => {
    expect(toSeedOptions({ only: ["items", "categories"] }).only).toEqual([
      "items",
      "categories",
    ])
  })

  it("trims whitespace and drops empty entries", () => {
    expect(toSeedOptions({ only: " items , , categories ," }).only).toEqual([
      "items",
      "categories",
    ])
  })

  it("treats a missing only as no filter", () => {
    expect(toSeedOptions({}).only).toEqual([])
  })

  it("parses a numeric seed", () => {
    expect(toSeedOptions({ seed: "42" }).seed).toBe(42)
    expect(toSeedOptions({ seed: "0" }).seed).toBe(0)
  })

  it("leaves the seed undefined when not given", () => {
    expect(toSeedOptions({}).seed).toBeUndefined()
  })

  it.each(["-1", "1.5", "abc", "", "1e3", " 42"])(
    "rejects the seed %s",
    (seed) => {
      expect(() => toSeedOptions({ seed })).toThrow(SeedError)

      expect(() => toSeedOptions({ seed })).toThrow(
        `--seed must be a whole number, got "${seed}"`
      )
    }
  )
})

describe("warnMissingTiers", () => {
  it("warns once per missing tier", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    warnMissingTiers(["staging", "qa"])

    expect(warn.mock.calls).toEqual([
      ['note: no fixtures directory for tier "staging"'],
      ['note: no fixtures directory for tier "qa"'],
    ])

    warn.mockRestore()
  })

  it("says nothing when none are missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    warnMissingTiers([])

    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })
})

describe("withConfig", () => {
  const ADAPTER = `{
    dialect: { name: "stub" },
    metadata: async () => ({ tables: [] }),
    transaction: async (run) => run({ run: async () => [] }),
    close: async () => { globalThis.__seedClosed = (globalThis.__seedClosed ?? 0) + 1 },
  }`

  async function configDir(): Promise<string> {
    ;(globalThis as { __seedClosed?: number }).__seedClosed = 0

    return tempTree({
      "seed.config.ts": `export default { adapter: ${ADAPTER} }`,
    })
  }

  const closes = () => (globalThis as { __seedClosed?: number }).__seedClosed

  it("loads the config and hands it to the callback", async () => {
    const root = await configDir()

    const seen = await withConfig(
      { config: `${root}/seed.config.ts` },
      async (config) => config.baseTier
    )

    expect(seen).toBe("base")
  })

  it("closes the adapter once the callback resolves", async () => {
    const root = await configDir()

    await withConfig({ config: `${root}/seed.config.ts` }, async () => {})

    expect(closes()).toBe(1)
  })

  it("closes the adapter even when the callback throws", async () => {
    const root = await configDir()

    await expect(
      withConfig({ config: `${root}/seed.config.ts` }, async () => {
        throw new Error("boom")
      })
    ).rejects.toThrow("boom")

    expect(closes()).toBe(1)
  })

  it("propagates a config failure without closing anything", async () => {
    const root = await tempTree({ ".keep": "" })

    await expect(
      withConfig({ config: `${root}/missing.ts` } as CommonArgs, async () => {})
    ).rejects.toThrow(/no config file at/)
  })
})
