import { fixtureLabel } from "#src/authoring/types"
import type { SeedPlanResult } from "#src/engine/index"

function pad(value: string, width: number): string {
  return value.padEnd(width)
}

export function formatList(result: SeedPlanResult): string {
  const lines = [`tiers: ${result.tiers.join(", ") || "none"}`, ""]

  const steps = result.plan.steps

  if (steps.length === 0) return `${lines[0]}\nno fixtures`

  const width = Math.max(
    ...steps.map((step) => fixtureLabel(step.fixture).length)
  )

  steps.forEach((step, index) => {
    const order = String(index + 1).padStart(2, " ")
    const source = pad(fixtureLabel(step.fixture), width)

    lines.push(
      `${order}. ${source}  ${step.table.name}  (${step.rows.length} rows, key: ${step.key.join(", ")})`
    )

    if (step.waves.length > 1) {
      lines.push(`    ${step.waves.length} waves — rows reference each other`)
    }

    if (step.deferredColumns.length > 0) {
      lines.push(
        `    deferred to a backfill: ${step.deferredColumns.join(", ")}`
      )
    }
  })

  if (result.plan.skipped.length > 0) {
    lines.push(
      "",
      `skipped: ${result.plan.skipped.map(fixtureLabel).join(", ")}`
    )
  }

  return lines.join("\n")
}
