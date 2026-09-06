import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import diff from "#src/cli/commands/diff"
import list from "#src/cli/commands/list"
import reset from "#src/cli/commands/reset"
import run from "#src/cli/commands/run"
import type { CommonArgs } from "#src/cli/options"
import { tempTree } from "../../support/temp"

const ADAPTER = `{
  dialect: dialect,
  metadata: async () => ({
    tables: [
      {
        name: "categories",
        columns: [
          { name: "id", property: "id", nullable: false, hasDefault: true },
          { name: "slug", property: "slug", nullable: false, hasDefault: false },
          { name: "name", property: "name", nullable: true, hasDefault: false },
        ],
        primaryKey: ["id"],
        uniqueKeys: [["id"], ["slug"]],
        foreignKeys: [],
      },
    ],
  }),
  transaction: async (work) => work({
    run: async (query) => {
      const { text } = query.render(dialect)

      return text.startsWith("INSERT")
        ? [{ id: "c1", slug: "tools", __seed_inserted: true }]
        : []
    },
  }),
  close: async () => {},
}`

async function project(rows = '[{ slug: "tools", name: "Tools" }]') {
  return tempTree({
    "seed.config.ts": `
      import { postgresDialect as dialect } from "#src/dialect/postgres"

      export default { fixtures: "fixtures", adapter: ${ADAPTER} }
    `,
    "fixtures/base/categories.ts": `
      export default { table: "categories", rows: ${rows} }
    `,
  })
}

type Command = { run?: (context: { args: CommonArgs }) => unknown }

const invoke = (command: unknown, args: CommonArgs) =>
  (command as Command).run?.({ args })

let logged: string[]
let warned: string[]

beforeEach(() => {
  logged = []
  warned = []

  vi.spyOn(console, "log").mockImplementation((line: string) => {
    logged.push(line)
  })

  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    warned.push(line)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("run", () => {
  it("prints a summary of what it applied", async () => {
    const root = await project()

    await invoke(run, { config: `${root}/seed.config.ts` })

    expect(logged.join("\n")).toContain(
      "base/categories.ts  categories: 1 inserted, 0 updated"
    )

    expect(logged.join("\n")).toContain("1 fixture(s), 1 inserted, 0 updated")
  })

  it("prints only the summary line with --quiet", async () => {
    const root = await project()

    await invoke(run, { config: `${root}/seed.config.ts`, quiet: true })

    expect(logged).toHaveLength(1)
    expect(logged[0]).toMatch(/^1 fixture\(s\), 1 inserted, 0 updated/)
  })

  it("names the overwritten columns with --verbose", async () => {
    const root = await project()

    await invoke(run, { config: `${root}/seed.config.ts`, verbose: true })

    expect(logged.join("\n")).toContain("on conflict: name")
  })

  it("says so when the tier has no fixtures", async () => {
    const root = await tempTree({
      "seed.config.ts": `
        import { postgresDialect as dialect } from "#src/dialect/postgres"

        export default { fixtures: "fixtures", adapter: ${ADAPTER} }
      `,
    })

    await invoke(run, { config: `${root}/seed.config.ts` })

    expect(logged).toEqual(["no fixtures for base"])
  })

  it("warns about a tier with no directory", async () => {
    const root = await project()

    await invoke(run, {
      config: `${root}/seed.config.ts`,
      environment: "local",
      force: true,
    })

    expect(warned).toEqual(['note: no fixtures directory for tier "local"'])
  })

  it("passes --only through to the planner", async () => {
    const root = await project()

    await expect(
      invoke(run, { config: `${root}/seed.config.ts`, only: "nope" })
    ).rejects.toThrow(/matched no fixtures/)
  })

  it("rejects a non-numeric --seed before touching the database", async () => {
    const root = await project()

    await expect(
      invoke(run, { config: `${root}/seed.config.ts`, seed: "abc" })
    ).rejects.toThrow(/--seed must be a whole number/)
  })
})

describe("diff", () => {
  it("prints the changes and says nothing was committed", async () => {
    const root = await project()

    await invoke(diff, { config: `${root}/seed.config.ts` })

    const output = logged.join("\n")

    expect(output).toContain("+ tools")
    expect(output).toContain("1 to insert, 0 to update, 0 unchanged")
    expect(output).toContain("nothing committed")
  })
})

describe("list", () => {
  it("prints the resolved order without applying anything", async () => {
    const root = await project()

    await invoke(list, { config: `${root}/seed.config.ts` })

    const output = logged.join("\n")

    expect(output).toContain("tiers: base")
    expect(output).toContain(
      "1. base/categories.ts  categories  (1 rows, key: slug)"
    )
  })

  it("reports an empty plan", async () => {
    const root = await tempTree({
      "seed.config.ts": `
        import { postgresDialect as dialect } from "#src/dialect/postgres"

        export default { fixtures: "fixtures", adapter: ${ADAPTER} }
      `,
    })

    await invoke(list, { config: `${root}/seed.config.ts` })

    expect(logged.join("\n")).toContain("no fixtures")
  })
})

describe("reset", () => {
  it("reports the truncated tables alongside the summary", async () => {
    const root = await project()

    await invoke(reset, { config: `${root}/seed.config.ts` })

    const output = logged.join("\n")

    expect(output).toContain("truncated: categories")
    expect(output).toContain("categories: 1 inserted, 0 updated")
  })

  it("says so when the tier has no fixtures", async () => {
    const root = await tempTree({
      "seed.config.ts": `
        import { postgresDialect as dialect } from "#src/dialect/postgres"

        export default { fixtures: "fixtures", adapter: ${ADAPTER} }
      `,
    })

    await invoke(reset, { config: `${root}/seed.config.ts` })

    expect(logged).toEqual(["no fixtures for base"])
  })
})
