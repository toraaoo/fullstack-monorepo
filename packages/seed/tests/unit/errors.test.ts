import { describe, expect, it } from "vitest"
import { fail, locate, SeedError } from "#src/errors"

describe("SeedError", () => {
  it("is an Error carrying its own name", () => {
    const error = new SeedError("something went wrong")

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("SeedError")
    expect(error.message).toBe("something went wrong")
  })

  it("survives instanceof across catch", () => {
    try {
      fail("boom")
    } catch (error) {
      expect(error).toBeInstanceOf(SeedError)
    }

    expect.assertions(1)
  })
})

describe("fail", () => {
  it("throws a SeedError with the message verbatim", () => {
    expect(() => fail("no adapter")).toThrowError(new SeedError("no adapter"))
  })
})

describe("locate", () => {
  it("prefixes the message with where it happened", () => {
    expect(() => locate("base/users.ts", "has no rows")).toThrow(
      "base/users.ts — has no rows"
    )
  })
})
