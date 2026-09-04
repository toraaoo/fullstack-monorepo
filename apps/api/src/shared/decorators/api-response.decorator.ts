import { applyDecorators } from "@nestjs/common"
import { ApiResponse } from "@nestjs/swagger"
import {
  type ErrorCode,
  errorCodes,
  errorResponseSchema,
  successResponseOf,
} from "@workspace/schemas/http"
import type { z } from "zod"
import { z as zod } from "zod"

type ApiResponseSchema = Extract<
  NonNullable<Parameters<typeof ApiResponse>[0]>,
  { schema: unknown }
>["schema"]

const toSchema = (schema: z.ZodType): ApiResponseSchema =>
  zod.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "output",
  }) as ApiResponseSchema

const ERROR_SCHEMA = toSchema(errorResponseSchema)

type ErrorSpec = {
  status: number
  code: ErrorCode
  description: string
}

const ERRORS = {
  badRequest: {
    status: 400,
    code: errorCodes.badRequest,
    description: "Bad Request",
  },
  unauthorized: {
    status: 401,
    code: errorCodes.unauthorized,
    description: "Unauthorized",
  },
  forbidden: {
    status: 403,
    code: errorCodes.forbidden,
    description: "Forbidden",
  },
  notFound: {
    status: 404,
    code: errorCodes.notFound,
    description: "Resource not found",
  },
  conflict: {
    status: 409,
    code: errorCodes.conflict,
    description: "Conflict",
  },
  validation: {
    status: 422,
    code: errorCodes.validationFailed,
    description: "Validation failed",
  },
  tooManyRequests: {
    status: 429,
    code: errorCodes.tooManyRequests,
    description: "Too Many Requests",
  },
  internalServerError: {
    status: 500,
    code: errorCodes.internalError,
    description: "Internal Server Error",
  },
  serviceUnavailable: {
    status: 503,
    code: errorCodes.serviceUnavailable,
    description: "Service Unavailable",
  },
} satisfies Record<string, ErrorSpec>

type ErrorName = keyof typeof ERRORS

const DEFAULT_ERRORS: Record<ErrorName, boolean> = {
  badRequest: true,
  unauthorized: true,
  forbidden: true,
  notFound: false,
  conflict: false,
  validation: true,
  tooManyRequests: true,
  internalServerError: true,
  serviceUnavailable: false,
}

function errorExample(spec: ErrorSpec, message = spec.description) {
  return {
    success: false,
    code: spec.code,
    message,
    error:
      spec.code === errorCodes.validationFailed
        ? {
            message,
            fields: { email: ["The email field is required."] },
          }
        : { message },
  }
}

export const ApiErrorResponse = (name: ErrorName) => {
  const spec = ERRORS[name]

  return ApiResponse({
    status: spec.status,
    description: spec.description,
    schema: { ...ERROR_SCHEMA, example: errorExample(spec) },
  })
}

export const ApiStandardResponses = (
  options: Partial<Record<ErrorName, boolean>> = {}
) => {
  const enabled = { ...DEFAULT_ERRORS, ...options }
  const names = Object.keys(ERRORS) as ErrorName[]

  return applyDecorators(
    ...names.filter((name) => enabled[name]).map(ApiErrorResponse)
  )
}

export const ApiSuccessResponse = <TData extends z.ZodType>(
  status: number,
  description: string,
  data: TData,
  example?: z.infer<TData>
) => {
  const schema = toSchema(successResponseOf(data))

  return ApiResponse({
    status,
    description,
    schema:
      example === undefined
        ? schema
        : {
            ...schema,
            example: { success: true, message: description, data: example },
          },
  })
}

export const DefaultApiNotFoundResponse = (entityName?: string) => {
  const message = `${entityName ?? "Entity"} not found`

  return ApiResponse({
    status: 404,
    description: message,
    schema: {
      ...ERROR_SCHEMA,
      example: errorExample(ERRORS.notFound, message),
    },
  })
}
