import { DatabaseHealth } from "@modules/health/database.health"
import { HealthController } from "@modules/health/health.controller"
import { Reflector } from "@nestjs/core"
import { HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus"
import { Test } from "@nestjs/testing"
import { RAW_RESPONSE_KEY } from "@shared/decorators/response.decorator"
import { beforeEach, describe, expect, it, vi } from "vitest"

const REPORT = { status: "ok", info: {}, error: {}, details: {} }

type Indicator = () => Promise<unknown>

const check = vi.fn(async (_indicators: Indicator[]) => REPORT)
const checkHeap = vi.fn(async () => ({ memory_heap: { status: "up" } }))
const isHealthy = vi.fn(async () => ({ database: { status: "up" } }))

async function controller(): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: HealthCheckService, useValue: { check } },
      { provide: MemoryHealthIndicator, useValue: { checkHeap } },
      { provide: DatabaseHealth, useValue: { isHealthy } },
    ],
  }).compile()

  return moduleRef.get(HealthController)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /health", () => {
  it("returns Terminus's own report untouched", async () => {
    await expect((await controller()).check()).resolves.toBe(REPORT)
  })

  it("checks the database and the heap, in that order", async () => {
    await (await controller()).check()

    const indicators = check.mock.calls[0][0]

    expect(indicators).toHaveLength(2)

    await Promise.all(indicators.map((indicator) => indicator()))

    expect(isHealthy).toHaveBeenCalledWith("database")
    expect(checkHeap).toHaveBeenCalledWith("memory_heap", 150 * 1024 * 1024)
  })
})

describe("GET /health/live", () => {
  it("answers without touching any dependency", async () => {
    expect((await controller()).liveness()).toEqual({ status: "ok" })
    expect(check).not.toHaveBeenCalled()
    expect(isHealthy).not.toHaveBeenCalled()
  })
})

describe("response shape", () => {
  it("opts the whole controller out of the envelope", () => {
    expect(
      new Reflector().getAllAndOverride(RAW_RESPONSE_KEY, [
        HealthController.prototype.check,
        HealthController,
      ])
    ).toBe(true)
  })

  it("opts the liveness probe out too", () => {
    expect(
      new Reflector().getAllAndOverride(RAW_RESPONSE_KEY, [
        HealthController.prototype.liveness,
        HealthController,
      ])
    ).toBe(true)
  })
})
