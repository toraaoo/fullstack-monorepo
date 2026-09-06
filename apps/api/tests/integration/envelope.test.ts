import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createApp, createFixtureApp, type TestApp } from "./support/app"

let api: TestApp
let fixtures: TestApp

beforeAll(async () => {
  api = await createApp()
  fixtures = await createFixtureApp()
})

afterAll(async () => {
  await Promise.all([api.close(), fixtures.close()])
})

describe("GET /", () => {
  it("wraps the handler's value in the success envelope", async () => {
    const response = await api.http.get("/")

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      success: true,
      message: "Welcome to API",
      data: { appName: "API", appVersion: "1.0.0" },
    })
  })

  it("stamps an ISO timestamp", async () => {
    const response = await api.http.get("/")

    expect(response.body.data.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    )
  })
})

describe("the interceptor", () => {
  it("translates the key from @ResponseMessage", async () => {
    const response = await fixtures.http.get("/fixtures/translated")

    expect(response.body).toEqual({
      success: true,
      message: "Resource not found",
      data: { ok: true },
    })
  })

  it("defaults to the success message", async () => {
    const response = await fixtures.http
      .get("/fixtures/search")
      .query({ term: "abc" })

    expect(response.body).toMatchObject({
      success: true,
      message: "Success",
      data: { term: "abc" },
    })
  })

  it("sends an envelope with no data when the handler returns nothing", async () => {
    const response = await fixtures.http.get("/fixtures/no-content")

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true, message: "Success" })
  })

  it("leaves a @RawResponse handler alone", async () => {
    const response = await fixtures.http.get("/fixtures/raw")

    expect(response.body).toEqual({ untouched: true })
  })
})
