import { Reflector } from "@nestjs/core"
import {
  isRawResponse,
  RawResponse,
  ResponseMessage,
} from "@shared/decorators/response.decorator"
import { ResponseInterceptor } from "@shared/interceptors/response.interceptor"
import { errorResponse, successResponse } from "@shared/response"
import { I18nContext } from "nestjs-i18n"
import { afterEach, describe, expect, it, vi } from "vitest"
import { stubI18n, stubNoI18n } from "../../support/i18n"
import { callHandler, executionContext } from "../../support/nest"

class PlainController {
  handler() {}
}

class MessagedController {
  @ResponseMessage("app.created")
  handler() {}
}

@RawResponse()
class RawController {
  handler() {}
}

function intercept(
  controller: new () => { handler: () => void },
  value: unknown,
  request: unknown = {}
): Promise<unknown> {
  const interceptor = new ResponseInterceptor(new Reflector())

  const context = executionContext({
    handler: controller.prototype.handler,
    controller,
    request,
  })

  return new Promise((resolve, reject) => {
    interceptor
      .intercept(context, callHandler(value))
      .subscribe({ next: resolve, error: reject })
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("envelope wrapping", () => {
  it("wraps a bare value with the translated default message", async () => {
    stubI18n({ "common.success": "Success" })

    await expect(intercept(PlainController, { id: 1 })).resolves.toEqual({
      success: true,
      message: "Success",
      data: { id: 1 },
    })
  })

  it("falls back to Success when there is no i18n context", async () => {
    stubNoI18n()

    await expect(intercept(PlainController, { id: 1 })).resolves.toEqual({
      success: true,
      message: "Success",
      data: { id: 1 },
    })
  })

  it("falls back to Success when the key has no translation", async () => {
    stubI18n({})

    await expect(intercept(PlainController, 1)).resolves.toEqual({
      success: true,
      message: "Success",
      data: 1,
    })
  })

  it("uses the key from @ResponseMessage", async () => {
    stubI18n({ "app.created": "Created", "common.success": "Success" })

    await expect(intercept(MessagedController, { id: 1 })).resolves.toEqual({
      success: true,
      message: "Created",
      data: { id: 1 },
    })
  })

  it("wraps undefined as a data-less envelope", async () => {
    stubI18n({ "common.success": "Success" })

    await expect(intercept(PlainController, undefined)).resolves.toEqual({
      success: true,
      message: "Success",
    })
  })
})

describe("values that are already envelopes", () => {
  it("leaves a handler-built success envelope alone", async () => {
    stubI18n({ "common.success": "Success" })

    const value = successResponse("Welcome", { appName: "API" })

    await expect(intercept(PlainController, value)).resolves.toBe(value)
  })

  it("leaves an error envelope alone", async () => {
    stubI18n({ "common.success": "Success" })

    const value = errorResponse("NOT_FOUND", "Missing", { message: "Missing" })

    await expect(intercept(PlainController, value)).resolves.toBe(value)
  })
})

describe("@RawResponse", () => {
  it("passes the handler value straight through", async () => {
    const value = { status: "ok", info: {} }

    await expect(intercept(RawController, value)).resolves.toBe(value)
  })

  it("marks the request so the exception filter also stays raw", async () => {
    const request = {}

    await intercept(RawController, { status: "ok" }, request)

    expect(isRawResponse(request)).toBe(true)
  })

  it("never reaches for a translation", async () => {
    const current = vi.spyOn(I18nContext, "current")

    await intercept(RawController, { status: "ok" })

    expect(current).not.toHaveBeenCalled()
  })
})
