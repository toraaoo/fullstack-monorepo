import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createApp, type TestApp } from "./support/app"

const ALLOWED_ORIGIN = "http://localhost:3000"

let api: TestApp

beforeAll(async () => {
  api = await createApp()
})

afterAll(async () => {
  await api.close()
})

describe("helmet", () => {
  it("sends a content security policy", async () => {
    const response = await api.http.get("/")

    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'"
    )
    expect(response.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'"
    )
  })

  it("asks browsers not to sniff the content type", async () => {
    const response = await api.http.get("/")

    expect(response.headers["x-content-type-options"]).toBe("nosniff")
  })

  it("sends HSTS with a year and subdomains", async () => {
    const response = await api.http.get("/")

    expect(response.headers["strict-transport-security"]).toBe(
      "max-age=31536000; includeSubDomains; preload"
    )
  })

  it("sets a referrer policy", async () => {
    const response = await api.http.get("/")

    expect(response.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    )
  })

  it("hides the framework", async () => {
    const response = await api.http.get("/")

    expect(response.headers).not.toHaveProperty("x-powered-by")
  })
})

describe("CORS", () => {
  it("allows the configured origin", async () => {
    const response = await api.http.get("/").set("origin", ALLOWED_ORIGIN)

    expect(response.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN)
  })

  it("does not answer for an origin that is not listed", async () => {
    const response = await api.http.get("/").set("origin", "https://evil.test")

    expect(response.headers).not.toHaveProperty("access-control-allow-origin")
  })

  it("answers a preflight with the configured methods", async () => {
    const response = await api.http
      .options("/")
      .set("origin", ALLOWED_ORIGIN)
      .set("access-control-request-method", "POST")

    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    )
  })

  it("allows the language headers the client needs", async () => {
    const response = await api.http
      .options("/")
      .set("origin", ALLOWED_ORIGIN)
      .set("access-control-request-method", "GET")

    const allowed = response.headers["access-control-allow-headers"]

    expect(allowed).toContain("Content-Type")
    expect(allowed).toContain("x-lang")
    expect(allowed).toContain("x-custom-lang")
  })
})
