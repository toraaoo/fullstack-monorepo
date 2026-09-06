import { describe, expect, it } from "vitest"
import { postgresDialect } from "#src/dialect/postgres"
import { resetTables } from "#src/engine/apply/reset"
import type { PlanStep, SeedPlan } from "#src/engine/plan/build"
import { RecordingExecutor } from "../../../support/executor"
import { loaded } from "../../../support/fixtures"
import { table } from "../../../support/metadata"

function planOf(...names: string[]): SeedPlan {
  const steps = names.map(
    (name) =>
      ({
        fixture: loaded({ table: name, rows: [{ id: 1 }] }),
        table: table(name, { columns: { id: true } }),
        rows: [],
        key: ["id"],
        columns: [],
        updateColumns: [],
        deferredColumns: [],
        waves: [],
      }) as PlanStep
  )

  return { steps, backfills: [], skipped: [], naturalKeys: new Map() }
}

describe("resetTables", () => {
  it("truncates in reverse dependency order, so dependents go first", async () => {
    const executor = new RecordingExecutor()

    const truncated = await resetTables(
      executor,
      postgresDialect,
      planOf("categories", "items", "tags")
    )

    expect(truncated).toEqual(["tags", "items", "categories"])

    expect(executor.statements).toEqual([
      'TRUNCATE TABLE "tags", "items", "categories" RESTART IDENTITY CASCADE',
    ])
  })

  it("issues a single statement", async () => {
    const executor = new RecordingExecutor()

    await resetTables(executor, postgresDialect, planOf("a", "b", "c"))

    expect(executor.queries).toHaveLength(1)
  })

  it("truncates each table once when several fixtures target it", async () => {
    const executor = new RecordingExecutor()

    const truncated = await resetTables(
      executor,
      postgresDialect,
      planOf("categories", "items", "categories")
    )

    expect(truncated).toEqual(["items", "categories"])
  })

  it("does nothing when the plan has no steps", async () => {
    const executor = new RecordingExecutor()

    expect(await resetTables(executor, postgresDialect, planOf())).toEqual([])
    expect(executor.queries).toHaveLength(0)
  })
})
