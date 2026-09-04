import type { ApiErrorDetail, ErrorCode } from "@workspace/schemas/http"

export type SuccessResponse<T> = {
  success: true
  message: string
  data?: T
}

export type ErrorResponse = {
  success: false
  message: string
  code: ErrorCode
  error: ApiErrorDetail
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse

export function successResponse<T>(
  message: string,
  data?: T
): SuccessResponse<T> {
  return data === undefined
    ? { success: true, message }
    : { success: true, message, data }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  error: ApiErrorDetail
): ErrorResponse {
  return { success: false, message, code, error }
}

export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const candidate = value as { success?: unknown; message?: unknown }

  return (
    typeof candidate.success === "boolean" &&
    typeof candidate.message === "string"
  )
}
