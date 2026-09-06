import { describe, expect, it } from "vitest"
import { formatDiff } from "#src/cli/render/diff"
import { formatList } from "#src/cli/render/list"
import { formatSummary } from "#src/cli/render/summary"
import { loaded } from "../../support/fixtures"
import {
  fixtureResult,
  plan,
  planResult,
  seedResult,
  step,
} from "../../support/results"

describe("formatList", () => {
  it("numbers each step with its table, row count and key", () => {
    const output = formatList(
      planResult({
        tiers: ["base", "local"],
        plan: plan([
          step({ table: "categories", rows: 3, key: ["slug"] }),
          step({ table: "items", rows: 50, key: ["reference"] }),
        ]),
      })
    )

    expect(output).toBe(
      [
        "tiers: base, local",
        "",
        " 1. base/categories.ts  categories  (3 rows, key: slug)",
        " 2. base/items.ts       items  (50 rows, key: reference)",
      ].join("\n")
    )
  })

  it("pads the source column to the widest label", () => {
    const output = formatList(
      planResult({
        plan: plan([
          step({ table: "a", file: "a.ts" }),
          step({ table: "b", file: "a-much-longer-name.ts" }),
        ]),
      })
    )

    const [, , first, second] = output.split("\n")

    expect(first?.indexOf("  a  ")).toBe(second?.indexOf("  b  "))
  })

  it("notes when rows had to be split into waves", () => {
    const output = formatList(
      planResult({
        plan: plan([step({ table: "nodes", rows: 3, waves: [[2], [1], [0]] })]),
      })
    )

    expect(output).toContain("    3 waves — rows reference each other")
  })

  it("says nothing about waves when there is only one", () => {
    const output = formatList(
      planResult({ plan: plan([step({ table: "nodes", waves: [[0, 1]] })]) })
    )

    expect(output).not.toContain("waves")
  })

  it("names the columns pushed into a backfill", () => {
    const output = formatList(
      planResult({
        plan: plan([step({ table: "teams", deferredColumns: ["owner_id"] })]),
      })
    )

    expect(output).toContain("    deferred to a backfill: owner_id")
  })

  it("lists the fixtures --only filtered out", () => {
    const output = formatList(
      planResult({
        plan: plan(
          [step({ table: "items" })],
          [loaded({ table: "categories", rows: [{}] })]
        ),
      })
    )

    expect(output).toContain("skipped: base/categories.ts")
  })

  it("reports an empty plan without a trailing blank line", () => {
    expect(formatList(planResult({ plan: plan([]) }))).toBe(
      "tiers: base\nno fixtures"
    )
  })

  it("says none when no tier resolved", () => {
    expect(formatList(planResult({ tiers: [], plan: plan([]) }))).toBe(
      "tiers: none\nno fixtures"
    )
  })
})

describe("formatSummary", () => {
  it("reports inserts and updates per fixture and in total", () => {
    const output = formatSummary(
      seedResult({
        results: [
          fixtureResult({ table: "categories", inserted: 3 }),
          fixtureResult({ table: "items", inserted: 1, updated: 49 }),
        ],
      })
    )

    expect(output).toBe(
      [
        "base/categories.ts  categories: 3 inserted, 0 updated",
        "base/items.ts       items: 1 inserted, 49 updated",
        "",
        "2 fixture(s), 4 inserted, 49 updated, 12ms",
      ].join("\n")
    )
  })

  it("lists truncated tables first", () => {
    const output = formatSummary(
      seedResult({
        truncated: ["items", "categories"],
        results: [fixtureResult({ table: "categories", inserted: 1 })],
      })
    )

    expect(output.split("\n")[0]).toBe("truncated: items, categories")
  })

  it("says nothing about truncation in run mode", () => {
    expect(formatSummary(seedResult())).not.toContain("truncated")
  })

  it("notes a rollback", () => {
    expect(formatSummary(seedResult({ rolledBack: true }))).toContain(
      "rolled back"
    )
  })

  it("counts skipped fixtures only when there are some", () => {
    const skipped = formatSummary(
      seedResult({
        plan: plan([], [loaded({ table: "items", rows: [{}] })]),
      })
    )

    expect(skipped).toContain("1 skipped")
    expect(formatSummary(seedResult())).not.toContain("skipped")
  })

  describe("verbose", () => {
    it("names the columns each fixture overwrites", () => {
      const output = formatSummary(
        seedResult({
          results: [
            fixtureResult({
              table: "items",
              updateColumns: ["title", "owner_email"],
            }),
          ],
        }),
        true
      )

      expect(output).toContain("    on conflict: title, owner_email")
    })

    it("says so when a fixture overwrites nothing", () => {
      const output = formatSummary(
        seedResult({ results: [fixtureResult({ table: "items" })] }),
        true
      )

      expect(output).toContain("    on conflict: nothing overwritten")
    })

    it("names backfilled columns", () => {
      const output = formatSummary(
        seedResult({
          results: [
            fixtureResult({ table: "teams", deferredColumns: ["owner_id"] }),
          ],
        }),
        true
      )

      expect(output).toContain("    backfilled: owner_id")
    })

    it("stays quiet by default", () => {
      const output = formatSummary(
        seedResult({
          results: [
            fixtureResult({ table: "items", updateColumns: ["title"] }),
          ],
        })
      )

      expect(output).not.toContain("on conflict")
    })
  })
})

describe("formatDiff", () => {
  it("marks inserts and updates, showing each changed column", () => {
    const output = formatDiff(
      seedResult({
        results: [
          fixtureResult({
            table: "categories",
            changes: [
              { key: "tools", kind: "insert", columns: [] },
              {
                key: "toys",
                kind: "update",
                columns: [
                  { column: "name", before: "Toys", after: "Playthings" },
                ],
              },
              { key: "misc", kind: "unchanged", columns: [] },
            ],
          }),
        ],
      })
    )

    expect(output).toBe(
      [
        "base/categories.ts  categories",
        "  + tools",
        "  ~ toys",
        "      name: Toys → Playthings",
        "",
        "1 to insert, 1 to update, 1 unchanged, nothing committed, 12ms",
      ].join("\n")
    )
  })

  it("says so when nothing would change", () => {
    const output = formatDiff(
      seedResult({
        results: [
          fixtureResult({
            table: "categories",
            changes: [{ key: "tools", kind: "unchanged", columns: [] }],
          }),
        ],
      })
    )

    expect(output).toBe(
      "no changes\n\n0 to insert, 0 to update, 1 unchanged, nothing committed, 12ms"
    )
  })

  it("omits a fixture with no changes but still counts it", () => {
    const output = formatDiff(
      seedResult({
        results: [
          fixtureResult({
            table: "quiet",
            changes: [{ key: "a", kind: "unchanged", columns: [] }],
          }),
          fixtureResult({
            table: "loud",
            changes: [{ key: "b", kind: "insert", columns: [] }],
          }),
        ],
      })
    )

    expect(output).not.toContain("quiet")
    expect(output).toContain("1 unchanged")
  })

  describe("value previews", () => {
    function preview(before: unknown, after: unknown) {
      const output = formatDiff(
        seedResult({
          results: [
            fixtureResult({
              table: "t",
              changes: [
                {
                  key: "k",
                  kind: "update",
                  columns: [{ column: "c", before, after }],
                },
              ],
            }),
          ],
        })
      )

      return output
        .split("\n")
        .find((line) => line.includes("c:"))
        ?.trim()
    }

    it("renders null and undefined as null", () => {
      expect(preview(null, undefined)).toBe("c: null → null")
    })

    it("renders a date as an iso string", () => {
      expect(preview(new Date("2024-01-01"), "x")).toBe(
        "c: 2024-01-01T00:00:00.000Z → x"
      )
    })

    it("renders a buffer as a byte count", () => {
      expect(preview(Buffer.alloc(1024), "x")).toBe("c: <1024 bytes> → x")
    })

    it("renders an object as json", () => {
      expect(preview({ a: 1 }, [1, 2])).toBe('c: {"a":1} → [1,2]')
    })

    it("truncates a long value with an ellipsis", () => {
      const line = preview("x".repeat(100), "y")

      expect(line).toContain(`${"x".repeat(57)}…`)
      expect(line).not.toContain("x".repeat(58))
    })

    it("leaves a value of exactly the limit intact", () => {
      expect(preview("x".repeat(60), "y")).toBe(`c: ${"x".repeat(60)} → y`)
    })
  })
})
