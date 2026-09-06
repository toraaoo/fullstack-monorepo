import type { ArgumentMetadata } from "@nestjs/common"
import { UnprocessableEntityException } from "@nestjs/common"
import { CustomValidationPipe } from "@shared/pipes/custom-validation.pipe"
import { key } from "@workspace/schemas/i18n"
import { afterEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { stubI18n, stubNoI18n } from "../../support/i18n"

const BODY: ArgumentMetadata = { type: "body" }

const CATALOGUE = {
  "validation.required": "The {property} field is required.",
  "validation.invalid_type": "The {property} field must be of type {expected}.",
  "validation.too_small": "The {property} field is too small.",
  "validation.format.email":
    "The {property} field must be a valid email address.",
  "validation.access.email.required": "Enter an email address.",
}

function reject(
  schema: z.ZodType,
  value: unknown
): {
  code: string
  message: string
  fields: Record<string, string[]>
} {
  try {
    new CustomValidationPipe(schema).transform(value, BODY)
  } catch (error) {
    expect(error).toBeInstanceOf(UnprocessableEntityException)

    return (error as UnprocessableEntityException).getResponse() as {
      code: string
      message: string
      fields: Record<string, string[]>
    }
  }

  throw new Error("expected the pipe to reject the value")
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("valid input", () => {
  it("returns the parsed value", () => {
    stubNoI18n()

    const schema = z.object({ email: z.email(), age: z.coerce.number() })

    expect(
      new CustomValidationPipe(schema).transform(
        { email: "a@b.com", age: "30" },
        BODY
      )
    ).toEqual({ email: "a@b.com", age: 30 })
  })
})

describe("the rejection envelope", () => {
  it("is a 422 carrying VALIDATION_FAILED", () => {
    stubNoI18n()

    const failure = reject(z.object({ email: z.string() }), {})

    expect(failure.code).toBe("VALIDATION_FAILED")
  })

  it("repeats the first field message as the top-level message", () => {
    stubI18n(CATALOGUE)

    const failure = reject(z.object({ email: z.string() }), {})

    expect(failure.message).toBe("The email field is required.")
    expect(failure.fields.email).toEqual(["The email field is required."])
  })

  it("keys nested fields by their dotted path", () => {
    stubI18n(CATALOGUE)

    const schema = z.object({ profile: z.object({ name: z.string() }) })

    expect(reject(schema, { profile: {} }).fields).toHaveProperty(
      ["profile.name"],
      ["The name field is required."]
    )
  })

  it("keys a root-level issue as _", () => {
    stubI18n(CATALOGUE)

    const failure = reject(z.string(), 1)

    expect(Object.keys(failure.fields)).toEqual(["_"])
    expect(failure.fields._).toEqual([
      "The value field must be of type string.",
    ])
  })

  it("groups every issue for one field together", () => {
    stubNoI18n()

    const schema = z.object({ tags: z.array(z.string()) })
    const failure = reject(schema, { tags: [1, 2] })

    expect(failure.fields["tags.0"]).toHaveLength(1)
    expect(failure.fields["tags.1"]).toHaveLength(1)
  })
})

describe("issue keys", () => {
  it("reads a missing value as required rather than invalid_type", () => {
    stubI18n(CATALOGUE)

    expect(reject(z.object({ email: z.string() }), {}).fields.email).toEqual([
      "The email field is required.",
    ])
  })

  it("reads a present value of the wrong type as invalid_type", () => {
    stubI18n(CATALOGUE)

    expect(
      reject(z.object({ email: z.string() }), { email: 1 }).fields.email
    ).toEqual(["The email field must be of type string."])
  })

  it("namespaces a format issue under its format name", () => {
    stubI18n(CATALOGUE)

    expect(
      reject(z.object({ email: z.email() }), { email: "nope" }).fields.email
    ).toEqual(["The email field must be a valid email address."])
  })

  it("uses the issue code for everything else", () => {
    stubI18n(CATALOGUE)

    expect(
      reject(z.object({ name: z.string().min(3) }), { name: "ab" }).fields.name
    ).toEqual(["The name field is too small."])
  })
})

describe("schema-level message keys", () => {
  const schema = z.object({
    email: z.string({ error: key("access.email.required") }),
  })

  it("resolves the key against the validation catalogue", () => {
    stubI18n(CATALOGUE)

    expect(reject(schema, {}).fields.email).toEqual(["Enter an email address."])
  })

  it("keeps the raw key when there is no i18n context", () => {
    stubNoI18n()

    expect(reject(schema, {}).fields.email).toEqual([
      "validation:access.email.required",
    ])
  })

  it("keeps the raw key when the catalogue has no entry", () => {
    stubI18n({})

    expect(reject(schema, {}).fields.email).toEqual([
      "validation:access.email.required",
    ])
  })
})

describe("without i18n", () => {
  it("falls back to zod's own message", () => {
    stubNoI18n()

    expect(reject(z.object({ email: z.string() }), {}).fields.email[0]).toMatch(
      /invalid input|expected string/i
    )
  })
})
