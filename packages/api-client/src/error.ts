export type ApiErrorKind = "network" | "timeout" | "http" | "invalid-response"

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly body?: unknown

  constructor(
    kind: ApiErrorKind,
    message: string,
    options: { status?: number; body?: unknown; cause?: unknown } = {}
  ) {
    super(message, { cause: options.cause })
    this.name = "ApiError"
    this.kind = kind
    this.status = options.status
    this.body = options.body
  }

  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError
  }
}
