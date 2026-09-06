import {
  ApiErrorResponse,
  ApiStandardResponses,
  ApiSuccessResponse,
  DefaultApiNotFoundResponse,
} from "@shared/decorators/api-response.decorator"
import { describe, expect, it } from "vitest"
import { z } from "zod"

const SWAGGER_RESPONSE = "swagger/apiResponse"

type Documented = {
  description: string
  schema: { example?: Record<string, unknown> }
}

function responsesOf(handler: object): Record<string, Documented> {
  return Reflect.getMetadata(SWAGGER_RESPONSE, handler) ?? {}
}

describe("ApiErrorResponse", () => {
  class Controller {
    @ApiErrorResponse("notFound")
    handler() {}
  }

  const responses = responsesOf(Controller.prototype.handler)

  it("documents the status the error maps to", () => {
    expect(Object.keys(responses)).toEqual(["404"])
  })

  it("describes the error", () => {
    expect(responses["404"].description).toBe("Resource not found")
  })

  it("carries an example that matches the error envelope", () => {
    expect(responses["404"].schema.example).toEqual({
      success: false,
      code: "NOT_FOUND",
      message: "Resource not found",
      error: { message: "Resource not found" },
    })
  })
})

describe("ApiErrorResponse for validation", () => {
  class Controller {
    @ApiErrorResponse("validation")
    handler() {}
  }

  it("shows a field map in the example, which other errors omit", () => {
    const example = responsesOf(Controller.prototype.handler)["422"].schema
      .example as { error: { fields?: unknown } }

    expect(example.error.fields).toEqual({
      email: ["The email field is required."],
    })
  })
})

describe("ApiStandardResponses", () => {
  class Defaults {
    @ApiStandardResponses()
    handler() {}
  }

  class WithNotFound {
    @ApiStandardResponses({ notFound: true })
    handler() {}
  }

  class WithoutThrottling {
    @ApiStandardResponses({ tooManyRequests: false })
    handler() {}
  }

  it("documents the errors every route can return", () => {
    expect(Object.keys(responsesOf(Defaults.prototype.handler)).sort()).toEqual(
      ["400", "401", "403", "422", "429", "500"]
    )
  })

  it("leaves the route-specific errors out by default", () => {
    const documented = Object.keys(responsesOf(Defaults.prototype.handler))

    expect(documented).not.toContain("404")
    expect(documented).not.toContain("409")
    expect(documented).not.toContain("503")
  })

  it("opts one in", () => {
    expect(Object.keys(responsesOf(WithNotFound.prototype.handler))).toContain(
      "404"
    )
  })

  it("opts one out", () => {
    expect(
      Object.keys(responsesOf(WithoutThrottling.prototype.handler))
    ).not.toContain("429")
  })
})

describe("ApiSuccessResponse", () => {
  const data = z.object({ id: z.string() })

  class Controller {
    @ApiSuccessResponse(201, "Created", data, { id: "abc" })
    created() {}

    @ApiSuccessResponse(200, "Fetched", data)
    fetched() {}
  }

  it("documents the status and description it is given", () => {
    const responses = responsesOf(Controller.prototype.created)

    expect(responses["201"].description).toBe("Created")
  })

  it("builds an example around the data it is given", () => {
    const responses = responsesOf(Controller.prototype.created)

    expect(responses["201"].schema.example).toEqual({
      success: true,
      message: "Created",
      data: { id: "abc" },
    })
  })

  it("omits the example when given none", () => {
    const responses = responsesOf(Controller.prototype.fetched)

    expect(responses["200"].schema.example).toBeUndefined()
  })

  it("generates an OpenAPI 3.0 schema for the envelope", () => {
    const schema = responsesOf(Controller.prototype.fetched)["200"].schema as {
      properties: Record<string, unknown>
      required: string[]
    }

    expect(Object.keys(schema.properties)).toEqual([
      "success",
      "message",
      "data",
    ])
    expect(schema.required).toContain("data")
  })
})

describe("DefaultApiNotFoundResponse", () => {
  class Controller {
    @DefaultApiNotFoundResponse("User")
    named() {}

    @DefaultApiNotFoundResponse()
    anonymous() {}
  }

  it("names the entity in the description and example", () => {
    const responses = responsesOf(Controller.prototype.named)

    expect(responses["404"].description).toBe("User not found")
    expect(responses["404"].schema.example).toMatchObject({
      code: "NOT_FOUND",
      message: "User not found",
      error: { message: "User not found" },
    })
  })

  it("falls back to Entity", () => {
    expect(responsesOf(Controller.prototype.anonymous)["404"].description).toBe(
      "Entity not found"
    )
  })
})
