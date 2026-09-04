export const errorCodes = {
  badRequest: "BAD_REQUEST",
  validationFailed: "VALIDATION_FAILED",
  unauthorized: "UNAUTHORIZED",
  forbidden: "FORBIDDEN",
  notFound: "NOT_FOUND",
  conflict: "CONFLICT",
  tooManyRequests: "TOO_MANY_REQUESTS",
  internalError: "INTERNAL_ERROR",
  serviceUnavailable: "SERVICE_UNAVAILABLE",
} as const

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes]

const STATUS_CODES: Record<number, ErrorCode> = {
  400: errorCodes.badRequest,
  401: errorCodes.unauthorized,
  403: errorCodes.forbidden,
  404: errorCodes.notFound,
  409: errorCodes.conflict,
  422: errorCodes.validationFailed,
  429: errorCodes.tooManyRequests,
  500: errorCodes.internalError,
  503: errorCodes.serviceUnavailable,
}

export function errorCodeForStatus(status: number): ErrorCode {
  return (
    STATUS_CODES[status] ??
    (status >= 500 ? errorCodes.internalError : errorCodes.badRequest)
  )
}
