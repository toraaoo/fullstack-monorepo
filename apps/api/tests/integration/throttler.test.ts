import { afterAll, beforeAll, describe, expect, it } from "vitest"
import type { TestApp } from "./support/app"

const LIMIT = 3

let api: TestApp

async function exhaust(path: string): Promise<void> {
  for (let attempt = 0; attempt < LIMIT; attempt++) {
    await api.http.get(path)
  }
}

beforeAll(async () => {
  process.env.THROTTLER_TTL = "60"
  process.env.THROTTLER_LIMIT = String(LIMIT)

  const { createFixtureApp } = await import("./support/app.js")

  api = await createFixtureApp()
})

afterAll(async () => {
  await api.close()
})

describe("within the limit", () => {
  it("serves every request", async () => {
    const statuses: number[] = []

    for (let attempt = 0; attempt < LIMIT; attempt++) {
      statuses.push((await api.http.get("/fixtures/translated")).status)
    }

    expect(statuses).toEqual([200, 200, 200])
  })

  it("counts down the remaining budget", async () => {
    const response = await api.http.get("/fixtures/no-content")

    expect(response.headers["x-ratelimit-limit"]).toBe(String(LIMIT))
    expect(response.headers["x-ratelimit-remaining"]).toBe(String(LIMIT - 1))
  })
})

describe("over the limit", () => {
  it("answers 429 in the error envelope", async () => {
    await exhaust("/fixtures/raw")

    const response = await api.http.get("/fixtures/raw")

    expect(response.status).toBe(429)
    expect(response.body).toMatchObject({
      success: false,
      code: "TOO_MANY_REQUESTS",
      message: "Too Many Requests",
    })
  })

  it("tells the caller when to retry", async () => {
    await exhaust("/fixtures/conflict")

    const response = await api.http.get("/fixtures/conflict")

    expect(response.status).toBe(429)
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0)
  })

  it("localises the refusal", async () => {
    await exhaust("/fixtures/explicit-message")

    const response = await api.http
      .get("/fixtures/explicit-message")
      .set("x-lang", "ko")

    expect(response.status).toBe(429)
    expect(response.body.message).toBe("요청이 너무 많습니다")
  })
})

describe("budgets are per route", () => {
  it("leaves an untouched route servable", async () => {
    await exhaust("/fixtures/ping-a")

    expect((await api.http.get("/fixtures/ping-a")).status).toBe(429)
    expect((await api.http.get("/fixtures/ping-b")).status).toBe(200)
  })
})
