import type { Sql } from "postgres"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { postgresAdapter } from "#src/adapter/postgres"
import { postgresDialect } from "#src/dialect/postgres"
import { SeedError } from "#src/errors"

interface Call {
  text: string
  params: unknown[]
}

function stubClient(rows: unknown[] = []) {
  const calls: Call[] = []

  const client = {
    unsafe: vi.fn(async (text: string, params: unknown[]) => {
      calls.push({ text, params })
      return rows
    }),
    begin: vi.fn(
      async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => run(client)
    ),
    end: vi.fn(async () => {}),
  }

  return { calls, client: client as unknown as Sql & typeof client }
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

describe("construction", () => {
  it("fails when it owns the client but has no url", () => {
    vi.stubEnv("DATABASE_URL", undefined)

    expect(() => postgresAdapter()).toThrow(SeedError)

    expect(() => postgresAdapter()).toThrow(
      "postgresAdapter() needs a url, or DATABASE_URL in the environment"
    )
  })

  it("accepts a caller-supplied client with no url at all", () => {
    vi.stubEnv("DATABASE_URL", undefined)

    const { client } = stubClient()

    expect(() => postgresAdapter({ client })).not.toThrow()
  })

  it("uses the postgres dialect", () => {
    const { client } = stubClient()

    expect(postgresAdapter({ client }).dialect).toBe(postgresDialect)
  })
})

describe("metadata", () => {
  it("introspects and shapes the result", async () => {
    const { calls, client } = stubClient([
      {
        tables: [
          {
            name: "categories",
            schema: "public",
            columns: [
              {
                name: "slug",
                property: "slug",
                nullable: false,
                hasDefault: false,
              },
            ],
            primaryKey: ["id"],
            uniqueKeys: [["id"], ["slug"]],
            foreignKeys: [
              { columns: ["x"], table: "y", foreignColumns: ["z"] },
            ],
          },
        ],
      },
    ])

    const { tables } = await postgresAdapter({ client }).metadata()

    expect(calls[0]?.text).toContain("CURRENT_SCHEMAS(FALSE)")

    expect(tables[0]).toEqual({
      name: "categories",
      schema: "public",
      columns: [
        { name: "slug", property: "slug", nullable: false, hasDefault: false },
      ],
      primaryKey: ["id"],
      uniqueKeys: [["id"], ["slug"]],
      foreignKeys: [{ columns: ["x"], table: "y", foreignColumns: ["z"] }],
    })
  })

  it("fills in defaults for a sparse row", async () => {
    const { client } = stubClient([{ tables: [{ name: "bare" }] }])

    const { tables } = await postgresAdapter({ client }).metadata()

    expect(tables[0]).toEqual({
      name: "bare",
      schema: undefined,
      columns: [],
      primaryKey: [],
      uniqueKeys: [],
      foreignKeys: [],
    })
  })

  it("drops unique keys that are empty or not arrays", async () => {
    const { client } = stubClient([
      {
        tables: [
          { name: "t", uniqueKeys: [["a"], [], null, "nope", ["b", "c"]] },
        ],
      },
    ])

    const { tables } = await postgresAdapter({ client }).metadata()

    expect(tables[0]?.uniqueKeys).toEqual([["a"], ["b", "c"]])
  })

  it("drops malformed foreign keys", async () => {
    const { client } = stubClient([
      {
        tables: [
          {
            name: "t",
            foreignKeys: [
              { columns: ["a"], table: "u", foreignColumns: ["b"] },
              { columns: null, table: "u", foreignColumns: ["b"] },
              { columns: ["a"], table: "u", foreignColumns: null },
            ],
          },
        ],
      },
    ])

    const { tables } = await postgresAdapter({ client }).metadata()

    expect(tables[0]?.foreignKeys).toEqual([
      { columns: ["a"], table: "u", foreignColumns: ["b"] },
    ])
  })

  it("yields no tables when the database returns nothing usable", async () => {
    for (const rows of [[], [{}], [{ tables: null }], [{ tables: "no" }]]) {
      const { client } = stubClient(rows)

      expect(await postgresAdapter({ client }).metadata()).toEqual({
        tables: [],
      })
    }
  })
})

describe("transaction", () => {
  it("renders each query to text and parameters for the driver", async () => {
    const { calls, client } = stubClient()

    await postgresAdapter({ client }).transaction(async (executor) => {
      await executor.run(
        postgresDialect.select({
          table: {
            name: "categories",
            columns: [],
            primaryKey: [],
            uniqueKeys: [],
            foreignKeys: [],
          },
          columns: ["id"],
          keyColumns: ["slug"],
          keys: [["tools"]],
        })
      )
    })

    expect(calls[0]).toEqual({
      text: 'SELECT "id" FROM "categories" WHERE "slug" IN ($1)',
      params: ["tools"],
    })
  })

  it("opens exactly one driver transaction", async () => {
    const { client } = stubClient()

    await postgresAdapter({ client }).transaction(async () => {})

    expect(client.begin).toHaveBeenCalledTimes(1)
  })

  it("returns what the callback returns", async () => {
    const { client } = stubClient()

    expect(
      await postgresAdapter({ client }).transaction(async () => "done")
    ).toBe("done")
  })
})

describe("close", () => {
  it("leaves a caller-supplied client open", async () => {
    const { client } = stubClient()

    await postgresAdapter({ client }).close()

    expect(client.end).not.toHaveBeenCalled()
  })
})
