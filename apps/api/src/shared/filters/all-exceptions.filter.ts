import { getEnv } from "@core/config"
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common"
import {
  type ApiErrorDetail,
  type ErrorCode,
  errorCodeForStatus,
  errorCodes,
} from "@workspace/schemas/http"
import type { Response } from "express"
import { ClsService } from "nestjs-cls"
import { I18nContext } from "nestjs-i18n"
import { isRawResponse } from "../decorators/response.decorator"
import { errorResponse } from "../response"

const MESSAGE_KEYS: Record<ErrorCode, string> = {
  BAD_REQUEST: "common.bad_request",
  VALIDATION_FAILED: "common.unprocessable_entity",
  UNAUTHORIZED: "common.unauthorized",
  FORBIDDEN: "common.forbidden",
  NOT_FOUND: "common.not_found",
  NOT_ACCEPTABLE: "common.not_acceptable",
  CONFLICT: "common.conflict",
  TOO_MANY_REQUESTS: "common.too_many_requests",
  INTERNAL_ERROR: "common.internal_error",
  SERVICE_UNAVAILABLE: "common.service_unavailable",
}

const FALLBACK_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: "Bad Request",
  VALIDATION_FAILED: "Unprocessable Entity",
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "Resource not found",
  NOT_ACCEPTABLE: "Not Acceptable",
  CONFLICT: "Conflict",
  TOO_MANY_REQUESTS: "Too Many Requests",
  INTERNAL_ERROR: "Internal Server Error",
  SERVICE_UNAVAILABLE: "Service Unavailable",
}

const KNOWN_CODES = new Set<string>(Object.values(errorCodes))

type ExceptionDetail = {
  code?: ErrorCode
  message?: string
  messageKey?: string
  fields?: Record<string, string[]>
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const response = http.getResponse<Response>()
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500

    if (
      exception instanceof HttpException &&
      isRawResponse(http.getRequest())
    ) {
      response.status(status).json(exception.getResponse())
      return
    }

    const detail = readDetail(
      exception instanceof HttpException ? exception.getResponse() : null
    )
    const code = detail.code ?? errorCodeForStatus(status)
    const message = resolveMessage(code, detail)

    const error: ApiErrorDetail = { message }

    if (detail.fields) {
      error.fields = detail.fields
    }

    if (status >= 500) {
      error.requestId = this.cls.getId()

      this.logger.error(
        { err: exception, requestId: error.requestId },
        "Request failed"
      )

      if (getEnv().API_DEBUG_ERRORS && exception instanceof Error) {
        error.message = exception.message
        error.stacktrace = exception.stack
          ?.split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      }
    }

    response.status(status).json(errorResponse(code, message, error))
  }
}

function resolveMessage(code: ErrorCode, detail: ExceptionDetail): string {
  if (detail.message && detail.code) {
    return detail.message
  }

  const i18n = I18nContext.current()
  const key = detail.messageKey ?? MESSAGE_KEYS[code]
  const translated = i18n?.t(key)

  return typeof translated === "string" && translated !== key
    ? translated
    : FALLBACK_MESSAGES[code]
}

function readDetail(payload: unknown): ExceptionDetail {
  if (typeof payload !== "object" || payload === null) {
    return {}
  }

  const record = payload as Record<string, unknown>

  return {
    code:
      typeof record.code === "string" && KNOWN_CODES.has(record.code)
        ? (record.code as ErrorCode)
        : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    messageKey:
      typeof record.messageKey === "string" ? record.messageKey : undefined,
    fields: isFields(record.fields) ? record.fields : undefined,
  }
}

function isFields(value: unknown): value is Record<string, string[]> {
  if (typeof value !== "object" || value === null) {
    return false
  }

  return Object.values(value).every(
    (entry) =>
      Array.isArray(entry) && entry.every((item) => typeof item === "string")
  )
}
