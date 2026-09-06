import { Reflector } from "@nestjs/core"
import {
  isRawResponse,
  markRawResponse,
  RAW_RESPONSE_FLAG,
  RAW_RESPONSE_KEY,
  RawResponse,
  RESPONSE_MESSAGE_KEY,
  ResponseMessage,
} from "@shared/decorators/response.decorator"
import { describe, expect, it } from "vitest"

@RawResponse()
class RawController {
  handler() {}
}

class MessagedController {
  @ResponseMessage("app.created")
  handler() {}
}

class PlainController {
  handler() {}
}

const reflector = new Reflector()

describe("@RawResponse", () => {
  it("marks the class so the interceptor can opt out of the envelope", () => {
    expect(
      reflector.getAllAndOverride(RAW_RESPONSE_KEY, [
        RawController.prototype.handler,
        RawController,
      ])
    ).toBe(true)
  })

  it("leaves an undecorated class unmarked", () => {
    expect(
      reflector.getAllAndOverride(RAW_RESPONSE_KEY, [
        PlainController.prototype.handler,
        PlainController,
      ])
    ).toBeUndefined()
  })
})

describe("@ResponseMessage", () => {
  it("stores the message key on the handler", () => {
    expect(
      reflector.getAllAndOverride(RESPONSE_MESSAGE_KEY, [
        MessagedController.prototype.handler,
        MessagedController,
      ])
    ).toBe("app.created")
  })

  it("does not leak onto a sibling handler", () => {
    expect(
      reflector.getAllAndOverride(RESPONSE_MESSAGE_KEY, [
        PlainController.prototype.handler,
        PlainController,
      ])
    ).toBeUndefined()
  })
})

describe("request marking", () => {
  it("round-trips the flag through a request object", () => {
    const request = {}

    expect(isRawResponse(request)).toBe(false)

    markRawResponse(request)

    expect(isRawResponse(request)).toBe(true)
  })

  it("uses a registered symbol, so separate module copies agree", () => {
    const request: Record<symbol, unknown> = {}

    markRawResponse(request)

    expect(request[Symbol.for("app.raw-response")]).toBe(true)
    expect(RAW_RESPONSE_FLAG).toBe(Symbol.for("app.raw-response"))
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "request"],
    ["a number", 1],
  ])("ignores %s rather than throwing", (_label, value) => {
    expect(() => markRawResponse(value)).not.toThrow()
    expect(isRawResponse(value)).toBe(false)
  })

  it("does not treat a truthy non-true flag as marked", () => {
    expect(isRawResponse({ [RAW_RESPONSE_FLAG]: "yes" })).toBe(false)
  })
})
