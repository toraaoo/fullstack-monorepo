import type { SeedExecutor, TableMetadata } from "#src/adapter/index"
import type { Dialect } from "#src/dialect/index"
import type { SeedPlan } from "#src/engine/plan/build"

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
