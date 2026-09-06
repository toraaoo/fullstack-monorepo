import {
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common"
import { markRawResponse } from "@shared/decorators/response.decorator"
import { ApiException } from "@shared/exceptions/api.exception"
import { AllExceptionsFilter } from "@shared/filters/all-exceptions.filter"
import type { ClsService } from "nestjs-cls"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { stubI18n, stubNoI18n } from "../../support/i18n"
import { argumentsHost, recordingResponse } from "../../support/nest"

const config = vi.hoisted(() => ({ debugErrors: false }))

vi.mock("@core/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@core/config")>()

  return {
    ...actual,
    getEnv: () => ({
      ...actual.getEnv(),
      API_DEBUG_ERRORS: config.debugErrors,
    }),
  }
})

const cls = { getId: () => "req-42" } as unknown as ClsService

function build() {
  const response = recordingResponse()
  const request = {}
  const filter = new AllExceptionsFilter(cls)

  return {
    response,
    request,
    catch: (exception: unknown) =>
      filter.catch(exception, argumentsHost({ request, response })),
  }
}

beforeEach(() => {
  config.debugErrors = false
  vi.spyOn(Logger.prototype, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("status and code mapping", () => {
  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [409, "CONFLICT"],
    [422, "VALIDATION_FAILED"],
    [429, "TOO_MANY_REQUESTS"],
    [503, "SERVICE_UNAVAILABLE"],
  ])("maps %i to %s", (status, code) => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new HttpException("boom", status))

    expect(scenario.response.statusCode).toBe(status)
    expect(scenario.response.body).toMatchObject({ success: false, code })
  })

  it("falls back to BAD_REQUEST for an unmapped 4xx", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new HttpException("teapot", 418))

    expect(scenario.response.statusCode).toBe(418)
    expect(scenario.response.body).toMatchObject({ code: "BAD_REQUEST" })
  })

  it("treats a non-HttpException as a 500", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new Error("kaboom"))

    expect(scenario.response.statusCode).toBe(500)
    expect(scenario.response.body).toMatchObject({ code: "INTERNAL_ERROR" })
  })
})

describe("messages", () => {
  it("uses the translation for the code's message key", () => {
    stubI18n({ "common.not_found": "Rien trouvé" })

    const scenario = build()
    scenario.catch(new NotFoundException())

    expect(scenario.response.body).toMatchObject({
      message: "Rien trouvé",
      error: { message: "Rien trouvé" },
    })
  })

  it("falls back to English when the key is untranslated", () => {
    stubI18n({})

    const scenario = build()
    scenario.catch(new ForbiddenException())

    expect(scenario.response.body).toMatchObject({ message: "Forbidden" })
  })

  it("falls back to English when there is no i18n context", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new NotFoundException())

    expect(scenario.response.body).toMatchObject({
      message: "Resource not found",
    })
  })

  it("prefers an explicit message paired with an explicit code", () => {
    stubI18n({ "common.conflict": "Conflit" })

    const scenario = build()
    scenario.catch(
      new ApiException(409, { code: "CONFLICT", message: "Email taken" })
    )

    expect(scenario.response.body).toMatchObject({ message: "Email taken" })
  })

  it("ignores a message that arrives without a code", () => {
    stubI18n({ "common.not_found": "Rien trouvé" })

    const scenario = build()
    scenario.catch(new NotFoundException("Nest's own default message"))

    expect(scenario.response.body).toMatchObject({ message: "Rien trouvé" })
  })

  it("honours a custom message key", () => {
    stubI18n({ "app.gone": "That is gone" })

    const scenario = build()
    scenario.catch(
      new ApiException(404, { code: "NOT_FOUND", messageKey: "app.gone" })
    )

    expect(scenario.response.body).toMatchObject({ message: "That is gone" })
  })
})

describe("validation fields", () => {
  it("passes a well-formed field map through", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(
      new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        message: "Email is required",
        fields: { email: ["Email is required"] },
      })
    )

    expect(scenario.response.body).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Email is required",
      error: { fields: { email: ["Email is required"] } },
    })
  })

  it("drops a field map whose values are not string arrays", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(
      new UnprocessableEntityException({
        code: "VALIDATION_FAILED",
        fields: { email: "required" },
      })
    )

    expect(scenario.response.body).not.toHaveProperty("error.fields")
  })

  it("adds no fields key for a plain error", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new NotFoundException())

    expect(Object.hasOwn(scenario.response.body as object, "fields")).toBe(
      false
    )
  })
})

describe("server errors", () => {
  it("attaches the request id from the CLS context", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new Error("kaboom"))

    expect(scenario.response.body).toMatchObject({
      error: { requestId: "req-42" },
    })
  })

  it("logs the exception with its request id", () => {
    stubNoI18n()

    const scenario = build()
    const exception = new Error("kaboom")
    scenario.catch(exception)

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      { err: exception, requestId: "req-42" },
      "Request failed"
    )
  })

  it("adds no request id to a 4xx", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new NotFoundException())

    expect(scenario.response.body).not.toHaveProperty("error.requestId")
  })

  it("hides the underlying message while debug errors are off", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new Error("connection string leaked here"))

    expect(scenario.response.body).toMatchObject({
      error: { message: "Internal Server Error" },
    })
    expect(scenario.response.body).not.toHaveProperty("error.stacktrace")
  })
})

describe("with API_DEBUG_ERRORS on", () => {
  beforeEach(() => {
    config.debugErrors = true
  })

  it("exposes the real message and a trimmed stacktrace", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new Error("kaboom"))

    const body = scenario.response.body as {
      error: { message: string; stacktrace: string[] }
    }

    expect(body.error.message).toBe("kaboom")
    expect(body.error.stacktrace[0]).toBe("Error: kaboom")
    expect(body.error.stacktrace.every((line) => line === line.trim())).toBe(
      true
    )
  })

  it("leaves a non-Error throwable's message alone", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch("just a string")

    expect(scenario.response.body).toMatchObject({
      error: { message: "Internal Server Error" },
    })
  })

  it("stays quiet on a 4xx", () => {
    stubNoI18n()

    const scenario = build()
    scenario.catch(new NotFoundException())

    expect(scenario.response.body).not.toHaveProperty("error.stacktrace")
  })
})

describe("raw responses", () => {
  it("returns the exception body untouched at its own status", () => {
    stubNoI18n()

    const response = recordingResponse()
    const request = {}
    markRawResponse(request)

    const body = { status: "error", info: {}, details: {} }

    new AllExceptionsFilter(cls).catch(
      new HttpException(body, 503),
      argumentsHost({ request, response })
    )

    expect(response.statusCode).toBe(503)
    expect(response.body).toBe(body)
  })

  it("still wraps a non-HttpException on a raw route", () => {
    stubNoI18n()

    const response = recordingResponse()
    const request = {}
    markRawResponse(request)

    new AllExceptionsFilter(cls).catch(
      new Error("kaboom"),
      argumentsHost({ request, response })
    )

    expect(response.statusCode).toBe(500)
    expect(response.body).toMatchObject({
      success: false,
      code: "INTERNAL_ERROR",
    })
  })
})
