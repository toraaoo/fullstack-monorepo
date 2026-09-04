import { z } from "zod"

export const apiErrorSchema = z.object({
  message: z.string(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string().optional(),
  stacktrace: z.array(z.string()).optional(),
})

export const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string(),
  error: apiErrorSchema,
})

export const successResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.unknown().optional(),
})

export function successResponseOf<TData extends z.ZodType>(data: TData) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data,
  })
}

export function responseOf<TData extends z.ZodType>(data: TData) {
  return z.discriminatedUnion("success", [
    successResponseOf(data),
    errorResponseSchema,
  ])
}

export const apiResponseSchema = z.discriminatedUnion("success", [
  successResponseSchema,
  errorResponseSchema,
])

export type ApiErrorDetail = z.infer<typeof apiErrorSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
export type SuccessResponse<TData = unknown> = {
  success: true
  message: string
  data?: TData
}
export type ApiResponse<TData = unknown> =
  | SuccessResponse<TData>
  | ErrorResponse
