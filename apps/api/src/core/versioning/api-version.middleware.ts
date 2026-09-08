import { Injectable, type NestMiddleware } from "@nestjs/common"
import { ApiException } from "@shared/exceptions/api.exception"
import { errorCodes } from "@workspace/schemas/http"
import type { NextFunction, Request, Response } from "express"
import { negotiateApiVersion } from "./accept-version"
import { API_VERSION_HEADER, API_VERSIONS } from "./versioning.constants"

@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    response.vary("Accept")

    const version = negotiateApiVersion(request.headers.accept)

    if (version === null) {
      throw new ApiException(406, {
        code: errorCodes.notAcceptable,
        messageKey: "common.not_acceptable",
        fields: { accept: [`Supported versions: ${API_VERSIONS.join(", ")}`] },
      })
    }

    response.setHeader(API_VERSION_HEADER, version)

    next()
  }
}
