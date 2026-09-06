import { fixtureLabel } from "#src/authoring/types"
import type { SeedResult } from "#src/engine/index"

function preview(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return `<${value.byteLength} bytes>`

  const text = typeof value === "object" ? JSON.stringify(value) : String(value)

  return text.length > 60 ? `${text.slice(0, 57)}…` : text
}

export function formatDiff(result: SeedResult): string {
  const lines: string[] = []

  let inserts = 0
  let updates = 0
  let unchanged = 0

  for (const entry of result.results) {
    const changed = entry.changes.filter(
      (change) => change.kind !== "unchanged"
    )

    unchanged += entry.changes.length - changed.length

    if (changed.length === 0) continue

    lines.push(`${fixtureLabel(entry.fixture)}  ${entry.fixture.table}`)

    for (const change of changed) {
      if (change.kind === "insert") {
        inserts += 1
        lines.push(`  + ${change.key}`)
        continue
      }

      updates += 1
      lines.push(`  ~ ${change.key}`)

      for (const column of change.columns) {
        lines.push(
          `      ${column.column}: ${preview(column.before)} → ${preview(column.after)}`
        )
      }
    }

    lines.push("")
  }

  if (lines.length === 0) lines.push("no changes", "")

  const summary = [
    `${inserts} to insert`,
    `${updates} to update`,
    `${unchanged} unchanged`,
    "nothing committed",
    `${result.elapsedMs}ms`,
  ]

  return [...lines, summary.join(", ")].join("\n")
}
