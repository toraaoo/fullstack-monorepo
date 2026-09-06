import { REQUEST_ID_HEADER } from "@core/request-context/request-context.module"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createApp, type TestApp } from "./support/app"

let api: TestApp

beforeAll(async () => {
  api = await createApp()
})

afterAll(async () => {
  await api.close()
})

describe("GET /health", () => {
  it("reports up against the real database", async () => {
    const response = await api.http.get("/health")

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: "ok",
      info: {
        database: { status: "up" },
        memory_heap: { status: "up" },
      },
      error: {},
    })
  })

  it("stays outside the envelope, as orchestrators expect", async () => {
    const response = await api.http.get("/health")

    expect(response.body).not.toHaveProperty("success")
    expect(response.body).not.toHaveProperty("data")
  })
})

describe("GET /health/live", () => {
  it("answers without touching the database", async () => {
    const response = await api.http.get("/health/live")

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: "ok" })
  })
})

describe("request correlation", () => {
  it("returns a generated request id", async () => {
    const response = await api.http.get("/health/live")

    expect(response.headers[REQUEST_ID_HEADER]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("keeps a request id the caller supplied", async () => {
    const response = await api.http
      .get("/health/live")
      .set(REQUEST_ID_HEADER, "trace-me")

    expect(response.headers[REQUEST_ID_HEADER]).toBe("trace-me")
  })
})
