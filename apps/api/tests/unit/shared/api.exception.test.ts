import { HttpException } from "@nestjs/common"
import { ApiException } from "@shared/exceptions/api.exception"
import { describe, expect, it } from "vitest"

describe("ApiException", () => {
  it("is an HttpException, so the framework handles it as one", () => {
    expect(new ApiException(404, { code: "NOT_FOUND" })).toBeInstanceOf(
      HttpException
    )
  })

  it("keeps the status it was given", () => {
    expect(new ApiException(409, { code: "CONFLICT" }).getStatus()).toBe(409)
  })

  it("exposes the detail as the response body for the filter to read", () => {
    const detail = {
      code: "VALIDATION_FAILED" as const,
      message: "Unprocessable",
      fields: { email: ["required"] },
    }

    expect(new ApiException(422, detail).getResponse()).toEqual(detail)
  })

  it("carries a message key instead of a literal message", () => {
    expect(
      new ApiException(403, {
        code: "FORBIDDEN",
        messageKey: "common.forbidden",
      }).getResponse()
    ).toEqual({ code: "FORBIDDEN", messageKey: "common.forbidden" })
  })
})
