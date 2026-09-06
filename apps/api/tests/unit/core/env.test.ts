import { getEnv, isDevelopment } from "@core/config/env"
import { afterEach, describe, expect, it, vi } from "vitest"

type EnvModule = typeof import("@core/config/env")

const ENV = { ...process.env }

async function reload(
  overrides: Record<string, string | undefined>
): Promise<EnvModule> {
  vi.resetModules()

  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }

  return import("../../../src/core/config/env.js")
}

afterEach(() => {
  process.env = { ...ENV }
})

describe("isDevelopment", () => {
  it.each([
    ["development", true],
    ["dev", true],
    ["test", true],
    ["staging", false],
    ["production", false],
    ["", false],
  ])("reads %s as development: %s", (nodeEnv, expected) => {
    expect(isDevelopment(nodeEnv)).toBe(expected)
  })
})

describe("getEnv", () => {
  it("caches, so later callers share one object", () => {
    expect(getEnv()).toBe(getEnv())
  })

  it("reads the values the process was started with", () => {
    expect(getEnv()).toMatchObject({
      APP_NAME: "API",
      APP_VERSION: "1.0.0",
      APP_TIMEZONE: "UTC",
      NODE_ENV: "test",
      DATABASE_URL: "postgres://api:api@localhost:5432/api_test",
    })
  })

  it("applies documented defaults for anything unset", async () => {
    const env = (
      await reload({ APP_PORT: undefined, DATABASE_POOL_MAX: undefined })
    ).getEnv()

    expect(env).toMatchObject({
      APP_PORT: 8000,
      DATABASE_POOL_MAX: 10,
      DATABASE_SSL: false,
      DATABASE_PREPARE: true,
      THROTTLER_TTL: 60,
      THROTTLER_LIMIT: 60,
      MAX_AGE: 3600,
      CREDENTIALS: false,
    })
  })
})

describe("comma-separated lists", () => {
  it("splits, trims and drops empty entries", async () => {
    const env = (
      await reload({
        ALLOWED_ORIGINS: " https://a.test , ,https://b.test ",
        ALLOWED_METHODS: "GET, POST ,",
        ALLOWED_HEADERS: "Content-Type , X-Lang",
      })
    ).getEnv()

    expect(env.ALLOWED_ORIGINS).toEqual(["https://a.test", "https://b.test"])
    expect(env.ALLOWED_METHODS).toEqual(["GET", "POST"])
    expect(env.ALLOWED_HEADERS).toEqual(["Content-Type", "X-Lang"])
  })
})

describe("the wildcard origin guard", () => {
  it.each(["production", "staging"])("refuses * under %s", async (nodeEnv) => {
    const { getEnv: load } = await reload({
      NODE_ENV: nodeEnv,
      ALLOWED_ORIGINS: "*",
    })

    expect(load).toThrow(/ALLOWED_ORIGINS is "\*" with NODE_ENV=/)
  })

  it.each(["development", "dev", "test"])(
    "allows * under %s",
    async (nodeEnv) => {
      const { getEnv: load } = await reload({
        NODE_ENV: nodeEnv,
        ALLOWED_ORIGINS: "*",
      })

      expect(load().ALLOWED_ORIGINS).toEqual(["*"])
    }
  )

  it("allows a wildcard listed among real origins only in development", async () => {
    const { getEnv: load } = await reload({
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://a.test,*",
    })

    expect(load).toThrow()
  })
})

describe("API_DEBUG_ERRORS", () => {
  it("defaults on in development", async () => {
    const env = (
      await reload({ NODE_ENV: "development", API_DEBUG_ERRORS: undefined })
    ).getEnv()

    expect(env.API_DEBUG_ERRORS).toBe(true)
  })

  it("defaults off in production", async () => {
    const env = (
      await reload({
        NODE_ENV: "production",
        ALLOWED_ORIGINS: "https://a.test",
        API_DEBUG_ERRORS: undefined,
      })
    ).getEnv()

    expect(env.API_DEBUG_ERRORS).toBe(false)
  })

  it("takes an explicit value over the default", async () => {
    const env = (
      await reload({
        NODE_ENV: "production",
        ALLOWED_ORIGINS: "https://a.test",
        API_DEBUG_ERRORS: "true",
      })
    ).getEnv()

    expect(env.API_DEBUG_ERRORS).toBe(true)
  })
})
