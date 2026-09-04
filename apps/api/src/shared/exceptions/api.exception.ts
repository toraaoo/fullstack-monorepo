import { HttpException } from "@nestjs/common"
import type { ErrorCode } from "@workspace/schemas/http"

export type ApiExceptionDetail = {
  code: ErrorCode
  message?: string
  messageKey?: string
  fields?: Record<string, string[]>
}

export class ApiException extends HttpException {
  constructor(status: number, detail: ApiExceptionDetail) {
    super(detail, status)
  }
}
