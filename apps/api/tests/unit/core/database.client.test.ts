import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  createDatabaseClient,
  DATABASE_CASING,
} from "../../../src/core/database/client"

vi.mock("postgres", () => ({
  default: vi.fn(() => ({ marker: "sql" })),
}))

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn((client, config) => ({ client, config })),
}))

const URL = "postgres://api:api@localhost:5432/api"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("createDatabaseClient", () => {
  it("opens the pool with the options it is given", () => {
    createDatabaseClient({ url: URL, max: 25, ssl: true, prepare: false })

    expect(postgres).toHaveBeenCalledWith(URL, {
      max: 25,
      ssl: true,
      prepare: false,
    })
  })

  it("leaves unset options to postgres.js rather than inventing defaults", () => {
    createDatabaseClient({ url: URL })

    expect(postgres).toHaveBeenCalledWith(URL, {
      max: undefined,
      ssl: undefined,
      prepare: undefined,
    })
  })

  it("hands drizzle the pool it just opened", () => {
    createDatabaseClient({ url: URL })

    expect(vi.mocked(drizzle).mock.calls[0][0]).toEqual({ marker: "sql" })
  })

  it("uses snake_case, so column names come from the property key", () => {
    createDatabaseClient({ url: URL })

    expect(vi.mocked(drizzle).mock.calls[0][1]).toMatchObject({
      casing: DATABASE_CASING,
    })
    expect(DATABASE_CASING).toBe("snake_case")
  })

  it("passes the schema so db.query and the seeder see the same tables", () => {
    createDatabaseClient({ url: URL })

    const config = vi.mocked(drizzle).mock.calls[0][1] as {
      schema: Record<string, unknown>
    }

    expect(Object.keys(config.schema).length).toBeGreaterThan(0)
  })
})

describe("query logging", () => {
  it("stays off when no handler is given", () => {
    createDatabaseClient({ url: URL })

    expect(vi.mocked(drizzle).mock.calls[0][1]).toMatchObject({ logger: false })
  })

  it("routes queries to the handler when one is given", () => {
    const onQuery = vi.fn()

    createDatabaseClient({ url: URL, onQuery })

    const config = vi.mocked(drizzle).mock.calls[0][1] as {
      logger: { logQuery: (query: string, params: unknown[]) => void }
    }

    config.logger.logQuery("select 1", [])

    expect(onQuery).toHaveBeenCalledWith("select 1", [])
  })
})
