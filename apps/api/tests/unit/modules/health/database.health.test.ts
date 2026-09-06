import { DRIZZLE } from "@core/database"
import { DatabaseHealth } from "@modules/health/database.health"
import { HealthIndicatorService } from "@nestjs/terminus"
import { Test } from "@nestjs/testing"
import { sql } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

const VERDICT = { database: { status: "up" } }

const execute = vi.fn()
const probes: Array<() => Promise<void>> = []

const attempt = {
  withTimeout: vi.fn(() => attempt),
  cacheFor: vi.fn(() => VERDICT),
}

const indicator = {
  check: vi.fn(() => ({
    attempt: (probe: () => Promise<void>) => {
      probes.push(probe)
      return attempt
    },
  })),
}

async function health(): Promise<DatabaseHealth> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      DatabaseHealth,
      { provide: DRIZZLE, useValue: { execute } },
      { provide: HealthIndicatorService, useValue: indicator },
    ],
  }).compile()

  return moduleRef.get(DatabaseHealth)
}

beforeEach(() => {
  vi.clearAllMocks()
  probes.length = 0
})

describe("isHealthy", () => {
  it("names the indicator with the key it is given", async () => {
    await (await health()).isHealthy("database")

    expect(indicator.check).toHaveBeenCalledWith("database")
  })

  it("bounds the probe and caches the verdict", async () => {
    await (await health()).isHealthy("database")

    expect(attempt.withTimeout).toHaveBeenCalledWith(3000)
    expect(attempt.cacheFor).toHaveBeenCalledWith(5000)
  })

  it("returns whatever the indicator reports", async () => {
    await expect((await health()).isHealthy("database")).resolves.toEqual(
      VERDICT
    )
  })

  it("defers the query until the indicator runs the probe", async () => {
    await (await health()).isHealthy("database")

    expect(execute).not.toHaveBeenCalled()
  })

  it("probes the connection with a trivial query", async () => {
    await (await health()).isHealthy("database")
    await probes[0]()

    expect(execute).toHaveBeenCalledExactlyOnceWith(sql`select 1`)
  })

  it("lets a connection failure surface to the indicator", async () => {
    execute.mockRejectedValueOnce(new Error("connection refused"))

    await (await health()).isHealthy("database")

    await expect(probes[0]()).rejects.toThrow("connection refused")
  })
})
