import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { I18nContext } from "nestjs-i18n"
import { map, type Observable } from "rxjs"
import {
  markRawResponse,
  RAW_RESPONSE_KEY,
  RESPONSE_MESSAGE_KEY,
} from "../decorators/response.decorator"
import { isApiResponse, successResponse } from "../response"

const DEFAULT_MESSAGE_KEY = "message.common.success"

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (raw) {
      markRawResponse(context.switchToHttp().getRequest())
      return next.handle()
    }

    const messageKey =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_MESSAGE_KEY

    return next.handle().pipe(
      map((value) => {
        if (isApiResponse(value)) {
          return value
        }

        const i18n = I18nContext.current()
        const translated = i18n?.t(messageKey)
        const message =
          typeof translated === "string" && translated !== messageKey
            ? translated
            : "Success"

        return successResponse(message, value)
      })
    )
  }
}
