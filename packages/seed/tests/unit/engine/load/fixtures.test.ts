import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { loadFixtures } from "#src/engine/load/fixtures"
import { SeedError } from "#src/errors"
import { tempTree } from "../../../support/temp"

const TREE = join(import.meta.dirname, "..", "..", "..", "support", "tree")

describe("loadFixtures", () => {
  it("loads every fixture module in a tier, sorted by filename", async () => {
    const loadedFixtures = await loadFixtures(TREE, ["base"])

    expect(loadedFixtures.map((fixture) => fixture.file)).toEqual([
      "a-first.ts",
      "b-second.ts",
    ])
  })

  it("records where each fixture came from", async () => {
    const [first] = await loadFixtures(TREE, ["base"])

    expect(first).toMatchObject({
      table: "categories",
      description: "first by name",
      tier: "base",
      file: "a-first.ts",
      directory: join(TREE, "base"),
    })
  })

  it("carries key and update through untouched", async () => {
    const [, second] = await loadFixtures(TREE, ["base"])

    expect(second).toMatchObject({ key: ["slug"], update: ["name"] })
  })

  it("skips underscore-prefixed modules, declarations and non-modules", async () => {
    const files = (await loadFixtures(TREE, ["base"])).map(
      (fixture) => fixture.file
    )

    expect(files).not.toContain("_helpers.ts")
    expect(files).not.toContain("types.d.ts")
    expect(files).not.toContain("notes.md")
  })

  it("loads tiers in the order given, not alphabetically", async () => {
    const loadedFixtures = await loadFixtures(TREE, ["local", "base"])

    expect(loadedFixtures.map((fixture) => fixture.tier)).toEqual([
      "local",
      "base",
      "base",
    ])
  })

  it("lets a fixture import a shared underscore module", async () => {
    const [items] = await loadFixtures(TREE, ["local"])

    expect(items?.rows[0]).toEqual({
      reference: "I-1",
      ownerEmail: "demo@example.com",
    })
  })

  it("treats a missing tier directory as empty", async () => {
    expect(await loadFixtures(TREE, ["nope"])).toEqual([])
  })

  it("returns nothing when no tiers are requested", async () => {
    expect(await loadFixtures(TREE, [])).toEqual([])
  })
})

describe("validation", () => {
  async function loadOne(source: string) {
    const root = await tempTree({ "base/broken.ts": source })

    return loadFixtures(root, ["base"])
  }

  it("rejects a module with no default export", async () => {
    await expect(loadOne("export const x = 1")).rejects.toThrow(
      /base\/broken\.ts — has no default export/
    )
  })

  it("rejects a default export that is not an object", async () => {
    await expect(loadOne("export default 42")).rejects.toThrow(
      /has no default export, or exports something that is not a fixture/
    )
  })

  it("rejects a fixture with no table name", async () => {
    await expect(loadOne("export default { rows: [] }")).rejects.toThrow(
      /missing a table name — use defineFixture\(\)/
    )
  })

  it("rejects an empty table name", async () => {
    await expect(
      loadOne('export default { table: "", rows: [] }')
    ).rejects.toThrow(/missing a table name/)
  })

  it("rejects a fixture with no rows array", async () => {
    await expect(loadOne('export default { table: "users" }')).rejects.toThrow(
      /has no rows array — use defineFixture\(\)/
    )
  })

  it("rejects rows that is not an array", async () => {
    await expect(
      loadOne('export default { table: "users", rows: {} }')
    ).rejects.toThrow(/has no rows array/)
  })

  it.each([
    ["null", "null"],
    ["an array", "[]"],
    ["a scalar", "7"],
  ])("rejects a row that is %s, naming its index", async (_label, row) => {
    await expect(
      loadOne(`export default { table: "users", rows: [{}, ${row}] }`)
    ).rejects.toThrow(/base\/broken\.ts — row 1 is not an object/)
  })

  it("throws a SeedError rather than a bare Error", async () => {
    await expect(loadOne("export const x = 1")).rejects.toBeInstanceOf(
      SeedError
    )
  })

  it("accepts an empty rows array, leaving that to the planner", async () => {
    const [fixture] = await loadOne(
      'export default { table: "users", rows: [] }'
    )

    expect(fixture?.rows).toEqual([])
  })
})
