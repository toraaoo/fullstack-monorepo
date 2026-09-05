import type { SeedExecutor, TableMetadata } from "../../adapter/index.js"
import type { Dialect } from "../../dialect/index.js"
import type { SeedPlan } from "../plan/build.js"

export async function resetTables(
  executor: SeedExecutor,
  dialect: Dialect,
  plan: SeedPlan
): Promise<string[]> {
  const tables: TableMetadata[] = []
  const seen = new Set<string>()

  for (const step of plan.steps) {
    if (seen.has(step.table.name)) continue

    seen.add(step.table.name)
    tables.push(step.table)
  }

  if (tables.length === 0) return []

  const ordered = tables.reverse()

  await executor.run(dialect.truncate({ tables: ordered }))

  return ordered.map((table) => table.name)
}
