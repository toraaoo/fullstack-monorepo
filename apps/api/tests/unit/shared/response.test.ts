import { errorResponse, isApiResponse, successResponse } from "@shared/response"
import { describe, expect, it } from "vitest"

describe("successResponse", () => {
  it("omits data entirely when none is given", () => {
    expect(successResponse("Success")).toEqual({
      success: true,
      message: "Success",
    })
  })

  it("omits data when it is explicitly undefined", () => {
    expect(Object.hasOwn(successResponse("Success", undefined), "data")).toBe(
      false
    )
  })

  it("keeps null, which is a value rather than an absence", () => {
    expect(successResponse("Success", null)).toEqual({
      success: true,
      message: "Success",
      data: null,
    })
  })

  it("carries the payload through untouched", () => {
    const data = { id: 1, nested: { ok: true } }

    expect(successResponse("Created", data).data).toBe(data)
  })
})

describe("errorResponse", () => {
  it("builds the documented error envelope", () => {
    expect(
      errorResponse("NOT_FOUND", "Resource not found", {
        message: "Resource not found",
      })
    ).toEqual({
      success: false,
      message: "Resource not found",
      code: "NOT_FOUND",
      error: { message: "Resource not found" },
    })
  })

  it("keeps field errors and the request id on the detail", () => {
    const response = errorResponse("VALIDATION_FAILED", "Unprocessable", {
      message: "Unprocessable",
      fields: { email: ["required"] },
      requestId: "req-1",
    })

    expect(response.error.fields).toEqual({ email: ["required"] })
    expect(response.error.requestId).toBe("req-1")
  })
})

describe("isApiResponse", () => {
  it("accepts a success envelope", () => {
    expect(isApiResponse(successResponse("Success", 1))).toBe(true)
  })

  it("accepts an error envelope", () => {
    expect(
      isApiResponse(errorResponse("CONFLICT", "Conflict", { message: "x" }))
    ).toBe(true)
  })

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "success"],
    ["a number", 1],
    ["an array", []],
    ["an object without success", { message: "Success" }],
    ["an object without message", { success: true }],
    ["a non-boolean success", { success: "true", message: "Success" }],
    ["a non-string message", { success: true, message: 1 }],
  ])("rejects %s", (_label, value) => {
    expect(isApiResponse(value)).toBe(false)
  })
})
