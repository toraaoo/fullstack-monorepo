import {
  API_VERSION_HEADER,
  acceptForVersion,
  LATEST_API_VERSION,
} from "@core/versioning"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createApp, type TestApp } from "./support/app"

const LATEST_ACCEPT = acceptForVersion(LATEST_API_VERSION)

let api: TestApp

beforeAll(async () => {
  api = await createApp()
})

afterAll(async () => {
  await api.close()
})

describe("choosing a version through Accept", () => {
  it("serves the version the client asked for", async () => {
    const response = await api.http.get("/").set("accept", LATEST_ACCEPT)

    expect(response.status).toBe(200)
    expect(response.headers[API_VERSION_HEADER]).toBe(LATEST_API_VERSION)
  })

  it("falls back to the latest when the client names none", async () => {
    const response = await api.http.get("/").set("accept", "*/*")

    expect(response.status).toBe(200)
    expect(response.headers[API_VERSION_HEADER]).toBe(LATEST_API_VERSION)
  })

  it("tells caches the answer depends on Accept", async () => {
    const response = await api.http.get("/").set("accept", LATEST_ACCEPT)

    expect(response.headers.vary).toContain("Accept")
  })
})

describe("a version the API does not serve", () => {
  it("is refused with 406 in the standard envelope", async () => {
    const response = await api.http
      .get("/")
      .set("accept", "application/json;v=99")

    expect(response.status).toBe(406)
    expect(response.body).toMatchObject({
      success: false,
      code: "NOT_ACCEPTABLE",
    })
  })

  it("is refused on every route, not just the ones that exist", async () => {
    const response = await api.http
      .get("/nothing-here")
      .set("accept", "application/json;v=99")

    expect(response.status).toBe(406)
  })
})

describe("health probes", () => {
  it("stay reachable for a client that sends no version", async () => {
    const response = await api.http.get("/health/live").set("accept", "*/*")

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: "ok" })
  })
})
