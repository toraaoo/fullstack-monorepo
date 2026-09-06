import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createApp, createFixtureApp, type TestApp } from "./support/app"

const WELCOME_EN = "Welcome to API"
const WELCOME_KO = "API에 오신 것을 환영합니다"

let api: TestApp
let fixtures: TestApp

beforeAll(async () => {
  api = await createApp()
  fixtures = await createFixtureApp()
})

afterAll(async () => {
  await Promise.all([api.close(), fixtures.close()])
})

describe("resolving the language", () => {
  it("defaults to the fallback", async () => {
    expect((await api.http.get("/")).body.message).toBe(WELCOME_EN)
  })

  it.each(["x-lang", "x-custom-lang"])(
    "reads the %s header",
    async (header) => {
      const response = await api.http.get("/").set(header, "ko")

      expect(response.body.message).toBe(WELCOME_KO)
    }
  )

  it.each(["lang", "locale"])("reads the %s query parameter", async (param) => {
    const response = await api.http.get("/").query({ [param]: "ko" })

    expect(response.body.message).toBe(WELCOME_KO)
  })

  it("reads Accept-Language", async () => {
    const response = await api.http.get("/").set("accept-language", "ko")

    expect(response.body.message).toBe(WELCOME_KO)
  })

  it("resolves a regional tag through the configured fallback", async () => {
    const response = await api.http.get("/").set("x-lang", "ko-KR")

    expect(response.body.message).toBe(WELCOME_KO)
  })

  it("falls back to en for an unknown language", async () => {
    const response = await api.http.get("/").set("x-lang", "fr")

    expect(response.body.message).toBe(WELCOME_EN)
  })

  it("interpolates the app name into the translation", async () => {
    const response = await api.http.get("/").set("x-lang", "ko")

    expect(response.body.message).toContain("API")
  })
})

describe("translated errors", () => {
  it("localises a 404", async () => {
    const response = await api.http.get("/nope").set("x-lang", "ko")

    expect(response.body).toMatchObject({
      code: "NOT_FOUND",
      message: "리소스를 찾을 수 없습니다",
    })
  })

  it("localises an ApiException message key", async () => {
    const response = await fixtures.http
      .get("/fixtures/conflict")
      .set("x-lang", "ko")

    expect(response.body.message).toBe("충돌이 발생했습니다")
  })

  it("localises a 500 without leaking the cause", async () => {
    const response = await fixtures.http
      .get("/fixtures/boom")
      .set("x-lang", "ko")

    expect(response.body.message).toBe("서버 내부 오류")
  })
})

describe("translated validation", () => {
  it("localises field messages", async () => {
    const response = await fixtures.http
      .post("/fixtures/sign-up")
      .set("x-lang", "ko")
      .send({})

    expect(response.body.error.fields.email).toEqual([
      "email 항목은 필수입니다.",
    ])
  })

  it("localises a format failure", async () => {
    const response = await fixtures.http
      .post("/fixtures/sign-up")
      .set("x-lang", "ko")
      .send({ email: "nope", age: 30 })

    expect(response.body.error.fields.email).toEqual([
      "email 항목은 올바른 이메일 주소여야 합니다.",
    ])
  })
})
