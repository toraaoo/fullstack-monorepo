import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ResolvedConfig } from "#src/config"
import { planSeed, seed } from "#src/engine/index"
import { memoryAdapter } from "../../support/adapter"
import { metadata, table } from "../../support/metadata"

const TREE = join(import.meta.dirname, "..", "..", "support", "tree")

const schema = metadata(
  table("categories", {
    columns: { id: true, slug: true },
    primaryKey: ["id"],
    uniqueKeys: [["slug"]],
  }),
  table("tags", {
    columns: { id: true, slug: true, name: true },
    primaryKey: ["id"],
    uniqueKeys: [["slug"]],
  }),
  table("items", {
    columns: { id: true, reference: true, ownerEmail: true },
    primaryKey: ["id"],
    uniqueKeys: [["reference"]],
  })
)

function configWith(
  adapter: ReturnType<typeof memoryAdapter>,
  overrides: Partial<ResolvedConfig> = {}
): ResolvedConfig {
  return {
    path: join(TREE, "seed.config.ts"),
    root: TREE,
    adapter,
    baseTier: "base",
    protectedEnvironments: ["staging", "production"],
    ...overrides,
  }
}

function adapterReturning(inserted = true) {
  return memoryAdapter({
    metadata: schema,
    respond: ({ text }) =>
      text.startsWith("INSERT")
        ? [{ id: "x", slug: "s", reference: "r", __seed_inserted: inserted }]
        : [],
  })
}

beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv("NODE_ENV", "development")
})

describe("planSeed", () => {
  it("plans the base tier by default", async () => {
    const plan = await planSeed(configWith(adapterReturning()))

    expect(plan.tiers).toEqual(["base"])
    expect(plan.missingTiers).toEqual([])

    expect(plan.plan.steps.map((step) => step.fixture.file)).toEqual([
      "a-first.ts",
      "b-second.ts",
    ])
  })

  it("adds the named environment tier", async () => {
    const plan = await planSeed(configWith(adapterReturning()), {
      environment: "local",
    })

    expect(plan.tiers).toEqual(["base", "local"])

    expect(plan.plan.steps.map((step) => step.fixture.table)).toContain("items")
  })

  it("reports a tier with no directory rather than failing", async () => {
    const plan = await planSeed(configWith(adapterReturning()), {
      environment: "staging",
      force: true,
    })

    expect(plan.missingTiers).toEqual(["staging"])
    expect(plan.tiers).toEqual(["base", "staging"])
  })

  it("narrows the plan with only", async () => {
    const plan = await planSeed(configWith(adapterReturning()), {
      only: ["tags"],
    })

    expect(plan.plan.steps.map((step) => step.fixture.table)).toEqual(["tags"])
    expect(plan.plan.skipped).toHaveLength(1)
  })

  it("writes nothing", async () => {
    const adapter = adapterReturning()

    await planSeed(configWith(adapter))

    expect(adapter.executor.queries).toHaveLength(0)
  })

  it("propagates the tier guard", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await expect(
      planSeed(configWith(adapterReturning()), { environment: "local" })
    ).rejects.toThrow(/refusing to apply "local" fixtures/)
  })
})

describe("seed", () => {
  it("applies the plan inside one transaction", async () => {
    const transactions: unknown[] = []

    const adapter = memoryAdapter({
      metadata: schema,
      onTransaction: (executor) => transactions.push(executor),
      respond: ({ text }) =>
        text.startsWith("INSERT")
          ? [{ id: "x", slug: "s", __seed_inserted: true }]
          : [],
    })

    const result = await seed(configWith(adapter))

    expect(transactions).toHaveLength(1)
    expect(result.results).toHaveLength(2)
    expect(result.rolledBack).toBe(false)
    expect(result.truncated).toEqual([])
  })

  it("reports elapsed time", async () => {
    const result = await seed(configWith(adapterReturning()))

    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(result.elapsedMs).toBeLessThan(60_000)
  })

  it("carries the plan and tiers through", async () => {
    const result = await seed(configWith(adapterReturning()), {
      environment: "local",
    })

    expect(result.tiers).toEqual(["base", "local"])
    expect(result.plan.steps).toHaveLength(3)
  })

  describe("reset mode", () => {
    it("truncates the targeted tables before applying", async () => {
      const adapter = adapterReturning()

      const result = await seed(configWith(adapter), { mode: "reset" })

      expect(result.truncated).toEqual(["tags", "categories"])

      expect(adapter.executor.statements[0]).toMatch(/^TRUNCATE TABLE/)
    })

    it("does not truncate in run mode", async () => {
      const adapter = adapterReturning()

      await seed(configWith(adapter))

      expect(adapter.executor.matching(/^TRUNCATE/)).toHaveLength(0)
    })
  })

  describe("diff mode", () => {
    it("rolls the transaction back and says so", async () => {
      const result = await seed(configWith(adapterReturning()), {
        mode: "diff",
      })

      expect(result.rolledBack).toBe(true)
      expect(result.results).toHaveLength(2)
    })

    it("collects changes for each fixture", async () => {
      const adapter = memoryAdapter({
        metadata: schema,
        respond: ({ text }) =>
          text.startsWith("INSERT")
            ? [{ id: "x", slug: "s", __seed_inserted: true }]
            : [],
      })

      const result = await seed(configWith(adapter), { mode: "diff" })

      expect(result.results[0]?.changes.every((c) => c.kind === "insert")).toBe(
        true
      )
    })

    it("still queries, since it rolls back rather than skipping", async () => {
      const adapter = adapterReturning()

      await seed(configWith(adapter), { mode: "diff" })

      expect(adapter.executor.matching(/^INSERT/).length).toBeGreaterThan(0)
    })
  })

  it("does not swallow a real failure as a rollback", async () => {
    const adapter = memoryAdapter({
      metadata: schema,
      respond: () => {
        throw new Error("connection lost")
      },
    })

    await expect(seed(configWith(adapter))).rejects.toThrow("connection lost")
  })

  it("does not close the adapter, leaving that to the caller", async () => {
    const adapter = adapterReturning()

    await seed(configWith(adapter))

    expect(adapter.closed()).toBe(0)
  })

  it("returns empty results when no fixture matches the tier", async () => {
    const adapter = adapterReturning()

    const result = await seed(configWith(adapter, { root: "/nowhere" }))

    expect(result.results).toEqual([])
    expect(result.plan.steps).toEqual([])
  })
})

describe("faker seeding", () => {
  it("reseeds faker for every run so --seed is reproducible", async () => {
    const { faker } = await import("#src/authoring/faker")

    await planSeed(configWith(adapterReturning()), { seed: 42 })
    const first = faker.number.int()

    await planSeed(configWith(adapterReturning()), { seed: 42 })
    const second = faker.number.int()

    expect(first).toBe(second)
  })
})
