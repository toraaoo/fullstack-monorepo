import { Test } from "@nestjs/testing"
import { I18nService } from "nestjs-i18n"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { AppController } from "../../src/app.controller"

const NOW = "2026-03-15T12:34:56.000Z"

const i18n = {
  t: vi.fn(
    (key: string, options?: { args?: Record<string, unknown> }) =>
      `${key}:${options?.args?.appName}`
  ),
}

async function controller(): Promise<AppController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [AppController],
    providers: [{ provide: I18nService, useValue: i18n }],
  }).compile()

  return moduleRef.get(AppController)
}

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterAll(() => {
  vi.useRealTimers()
})

describe("GET /", () => {
  it("returns a success envelope the interceptor will leave alone", async () => {
    const response = (await controller()).getHello()

    expect(response.success).toBe(true)
  })

  it("reports the configured app name and version", async () => {
    const response = (await controller()).getHello()

    expect(response.data).toMatchObject({
      appName: "API",
      appVersion: "1.0.0",
    })
  })

  it("stamps the current instant", async () => {
    const response = (await controller()).getHello()

    expect(response.data?.timestamp).toBe(NOW)
  })

  it("translates the welcome message with the app name as an argument", async () => {
    const response = (await controller()).getHello()

    expect(i18n.t).toHaveBeenCalledWith("app.welcome", {
      args: { appName: "API" },
    })
    expect(response.message).toBe("app.welcome:API")
  })
})
