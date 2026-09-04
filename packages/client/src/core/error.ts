import type { ApiErrorDetail } from "@workspace/schemas/http"
import { isAxiosError, isCancel } from "axios"

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "canceled"
  | "http"
  | "invalid-response"

export type ApiErrorOptions = {
  status?: number
  code?: string
  detail?: ApiErrorDetail
  body?: unknown
  cause?: unknown
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly detail?: ApiErrorDetail
  readonly body?: unknown

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: ApiErrorOptions = {}
  ) {
    super(message, { cause: options.cause })
    this.name = "ApiError"
    this.kind = kind
    this.status = options.status
    this.code = options.code
    this.detail = options.detail
    this.body = options.body
  }

  get fields(): Record<string, string[]> | undefined {
    return this.detail?.fields
  }

  get requestId(): string | undefined {
    return this.detail?.requestId
  }

  get retryable(): boolean {
    return this.kind === "network" || this.kind === "timeout"
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError
  }
}

const TIMEOUT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT"])

export function toApiError(
  cause: unknown,
  context: { baseUrl: string; path: string; timeout: number }
): ApiError {
  if (ApiError.isApiError(cause)) {
    return cause
  }

  if (isCancel(cause)) {
    return new ApiError("canceled", `${context.path} was canceled`, { cause })
  }

  if (isAxiosError(cause) && cause.code && TIMEOUT_CODES.has(cause.code)) {
    return new ApiError(
      "timeout",
      `${context.path} timed out after ${context.timeout}ms`,
      { cause }
    )
  }

  return new ApiError("network", `Could not reach ${context.baseUrl}`, {
    cause,
  })
}
