import { fixtureLabel } from "#src/authoring/types"
import type { SeedResult } from "#src/engine/index"

function pad(value: string, width: number): string {
  return value.padEnd(width)
}

export function formatSummary(result: SeedResult, verbose = false): string {
  const lines: string[] = []

  if (result.truncated.length > 0) {
    lines.push(`truncated: ${result.truncated.join(", ")}`, "")
  }

  const width = Math.max(
    0,
    ...result.results.map((entry) => fixtureLabel(entry.fixture).length)
  )

  for (const entry of result.results) {
    const source = pad(fixtureLabel(entry.fixture), width)

    lines.push(
      `${source}  ${entry.fixture.table}: ${entry.inserted} inserted, ${entry.updated} updated`
    )

    if (!verbose) continue

    lines.push(
      entry.updateColumns.length === 0
        ? "    on conflict: nothing overwritten"
        : `    on conflict: ${entry.updateColumns.join(", ")}`
    )

    if (entry.deferredColumns.length > 0) {
      lines.push(`    backfilled: ${entry.deferredColumns.join(", ")}`)
    }
  }

  const inserted = result.results.reduce((sum, e) => sum + e.inserted, 0)
  const updated = result.results.reduce((sum, e) => sum + e.updated, 0)

  const summary = [
    `${result.results.length} fixture(s)`,
    `${inserted} inserted`,
    `${updated} updated`,
    result.plan.skipped.length > 0
      ? `${result.plan.skipped.length} skipped`
      : "",
    result.rolledBack ? "rolled back" : "",
    `${result.elapsedMs}ms`,
  ].filter(Boolean)

  return [...lines, "", summary.join(", ")].join("\n")
}
