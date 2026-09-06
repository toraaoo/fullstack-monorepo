import { describe, expect, it } from "vitest"
import {
  BASE_TIER,
  discoverTiers,
  resolveTiers,
  TIER_PATTERN,
} from "#src/engine/load/tiers"
import { SeedError } from "#src/errors"
import { tempTree } from "../../../support/temp"

describe("BASE_TIER", () => {
  it('is "base"', () => {
    expect(BASE_TIER).toBe("base")
  })
})

describe("TIER_PATTERN", () => {
  it.each([
    "base",
    "local",
    "test",
    "e2e",
    "a",
    "with-dash",
    "with_score",
    "a1",
  ])("accepts %s", (name) => {
    expect(TIER_PATTERN.test(name)).toBe(true)
  })

  it.each([
    "",
    "-leading",
    "_leading",
    "has/slash",
    "has space",
    "has.dot",
    "..",
  ])("rejects %s", (name) => {
    expect(TIER_PATTERN.test(name)).toBe(false)
  })
})

describe("discoverTiers", () => {
  it("lists directories, sorted, ignoring files", async () => {
    const root = await tempTree({
      "base/users.ts": "export default {}",
      "local/items.ts": "export default {}",
      "README.md": "not a tier",
    })

    expect(await discoverTiers(root)).toEqual(["base", "local"])
  })

  it("returns nothing when the root does not exist", async () => {
    expect(await discoverTiers("/definitely/not/here")).toEqual([])
  })

  it("returns nothing for an empty root", async () => {
    expect(await discoverTiers(await tempTree())).toEqual([])
  })
})

describe("resolveTiers", () => {
  it("applies only the base tier when no environment is named", () => {
    expect(resolveTiers(undefined)).toEqual(["base"])
    expect(resolveTiers("")).toEqual(["base"])
  })

  it("does not duplicate the base tier when it is named directly", () => {
    expect(resolveTiers("base")).toEqual(["base"])
  })

  it("applies the base tier alongside the named one", () => {
    expect(resolveTiers("local", { nodeEnv: "development" })).toEqual([
      "base",
      "local",
    ])
  })

  it("respects a custom base tier", () => {
    expect(resolveTiers("shared", { baseTier: "shared" })).toEqual(["shared"])

    expect(
      resolveTiers("local", { baseTier: "shared", nodeEnv: "development" })
    ).toEqual(["shared", "local"])
  })

  it("rejects an environment that is not a plausible directory name", () => {
    expect(() => resolveTiers("../etc")).toThrow(SeedError)

    expect(() => resolveTiers("../etc")).toThrow(
      /invalid environment "\.\.\/etc" — expected a directory name/
    )
  })

  describe("protected environments", () => {
    const options = {
      protectedEnvironments: ["staging", "production"],
      nodeEnv: "production",
    }

    it("refuses a mismatched tier while NODE_ENV is protected", () => {
      expect(() => resolveTiers("local", options)).toThrow(
        /refusing to apply "local" fixtures with NODE_ENV=production — pass --force/
      )
    })

    it("allows it with force", () => {
      expect(resolveTiers("local", { ...options, force: true })).toEqual([
        "base",
        "local",
      ])
    })

    it("allows the tier that matches NODE_ENV", () => {
      expect(resolveTiers("production", options)).toEqual([
        "base",
        "production",
      ])
    })

    it("does not guard when NODE_ENV is not protected", () => {
      expect(
        resolveTiers("local", { ...options, nodeEnv: "development" })
      ).toEqual(["base", "local"])
    })

    it("guards nothing when no environments are protected", () => {
      expect(resolveTiers("local", { nodeEnv: "production" })).toEqual([
        "base",
        "local",
      ])
    })
  })

  it("falls back to process.env.NODE_ENV", () => {
    const previous = process.env.NODE_ENV

    process.env.NODE_ENV = "production"

    try {
      expect(() =>
        resolveTiers("local", { protectedEnvironments: ["production"] })
      ).toThrow(/NODE_ENV=production/)
    } finally {
      process.env.NODE_ENV = previous
    }
  })
})
