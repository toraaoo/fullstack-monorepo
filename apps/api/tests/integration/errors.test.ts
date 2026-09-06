import { REQUEST_ID_HEADER } from "@core/request-context/request-context.module"
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

describe("an unknown route", () => {
  it("answers with the error envelope", async () => {
    const response = await api.http.get("/nope")

    expect(response.status).toBe(404)
    expect(response.body).toEqual({
      success: false,
      code: "NOT_FOUND",
      message: "Resource not found",
      error: { message: "Resource not found" },
    })
  })

  it("carries no request id, because nothing failed on the server", async () => {
    const response = await api.http.get("/nope")

    expect(response.body.error).not.toHaveProperty("requestId")
  })
})

describe("a thrown ApiException", () => {
  it("maps the code and translates the message key", async () => {
    const response = await fixtures.http.get("/fixtures/conflict")

    expect(response.status).toBe(409)
    expect(response.body).toMatchObject({
      success: false,
      code: "CONFLICT",
      message: "Conflict",
    })
  })

  it("prefers an explicit message over the catalogue", async () => {
    const response = await fixtures.http.get("/fixtures/explicit-message")

    expect(response.body.message).toBe("That reference is already taken")
  })
})

describe("an unhandled error", () => {
  it("becomes a 500 that leaks nothing", async () => {
    const response = await fixtures.http.get("/fixtures/boom")

    expect(response.status).toBe(500)
    expect(response.body).toMatchObject({
      success: false,
      code: "INTERNAL_ERROR",
      message: "Internal Server Error",
      error: { message: "Internal Server Error" },
    })
    expect(response.body.error).not.toHaveProperty("stacktrace")
  })

  it("returns a request id that matches the response header", async () => {
    const response = await fixtures.http.get("/fixtures/boom")

    expect(response.body.error.requestId).toBe(
      response.headers[REQUEST_ID_HEADER]
    )
  })

  it("correlates with the id the caller supplied", async () => {
    const response = await fixtures.http
      .get("/fixtures/boom")
      .set(REQUEST_ID_HEADER, "trace-the-failure")

    expect(response.body.error.requestId).toBe("trace-the-failure")
  })
})

describe("body validation", () => {
  it("rejects a missing body with a field map", async () => {
    const response = await fixtures.http.post("/fixtures/sign-up").send({})

    expect(response.status).toBe(422)
    expect(response.body).toMatchObject({
      success: false,
      code: "VALIDATION_FAILED",
      error: {
        fields: {
          email: ["The email field is required."],
          age: ["The age field is required."],
        },
      },
    })
  })

  it("repeats the first field message at the top level", async () => {
    const response = await fixtures.http.post("/fixtures/sign-up").send({})

    expect(response.body.message).toBe(response.body.error.fields.email[0])
  })

  it("reports a bad format against the format catalogue", async () => {
    const response = await fixtures.http
      .post("/fixtures/sign-up")
      .send({ email: "nope", age: 30 })

    expect(response.body.error.fields.email).toEqual([
      "The email field must be a valid email address.",
    ])
  })

  it("reports a bound breach", async () => {
    const response = await fixtures.http
      .post("/fixtures/sign-up")
      .send({ email: "a@b.com", age: 12 })

    expect(response.body.error.fields.age).toEqual([
      "The age field is too small.",
    ])
  })

  it("keys a nested field by its dotted path", async () => {
    const response = await fixtures.http
      .post("/fixtures/sign-up")
      .send({ email: "a@b.com", age: 30, profile: { name: "x" } })

    expect(response.body.error.fields).toHaveProperty(["profile.name"])
  })

  it("accepts a valid body", async () => {
    const response = await fixtures.http
      .post("/fixtures/sign-up")
      .send({ email: "a@b.com", age: 30 })

    expect(response.status).toBe(201)
    expect(response.body.data).toEqual({ email: "a@b.com", age: 30 })
  })
})

describe("query validation", () => {
  it("rejects a query that breaks its schema", async () => {
    const response = await fixtures.http
      .get("/fixtures/search")
      .query({ term: "ab" })

    expect(response.status).toBe(422)
    expect(response.body.error.fields.term).toEqual([
      "The term field is too small.",
    ])
  })
})
