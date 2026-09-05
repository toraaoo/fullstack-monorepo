import type { LoadedFixture, SeedRunResult } from "./types"

function pad(value: string, width: number): string {
  return value.padEnd(width)
}

export function formatRun(result: SeedRunResult, verbose = false): string {
  const width = Math.max(
    ...result.results.map((file) => `${file.tier}/${file.file}`.length)
  )

  const lines: string[] = []

  for (const file of result.results) {
    const source = pad(`${file.tier}/${file.file}`, width)

    lines.push(
      `${source}  ${file.table}: ${file.inserted} inserted, ${file.updated} updated`
    )

    if (!verbose) continue

    lines.push(
      file.updatedColumns.length === 0
        ? "    on conflict: nothing overwritten"
        : `    on conflict: ${file.updatedColumns.join(", ")}`
    )
  }

  const inserted = result.results.reduce((sum, file) => sum + file.inserted, 0)
  const updated = result.results.reduce((sum, file) => sum + file.updated, 0)

  const summary = [
    `${result.results.length} fixture(s)`,
    `${inserted} inserted`,
    `${updated} updated`,
    result.skipped.length > 0 ? `${result.skipped.length} skipped` : "",
    result.dryRun ? "rolled back (--dry-run)" : "",
    `${result.elapsedMs}ms`,
  ].filter(Boolean)

  return [...lines, "", summary.join(", ")].join("\n")
}

export function formatList(tiers: string[], fixtures: LoadedFixture[]): string {
  const lines = [`tiers: ${tiers.join(", ") || "none"}`, ""]

  if (fixtures.length === 0) return `${lines[0]}\nno fixtures`

  const width = Math.max(
    ...fixtures.map((fixture) => `${fixture.tier}/${fixture.file}`.length)
  )

  for (const fixture of fixtures) {
    const source = pad(`${fixture.tier}/${fixture.file}`, width)
    const key = fixture.conflictTarget.join(", ")

    lines.push(
      `${source}  ${fixture.table}  (${fixture.rows.length} rows, key: ${key})`
    )
  }

  return lines.join("\n")
}
