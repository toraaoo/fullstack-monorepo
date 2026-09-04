import { randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { Module } from "@nestjs/common"
import { ClsModule, type ClsService } from "nestjs-cls"

export const REQUEST_ID_HEADER = "x-request-id"

const REQUEST_ID_KEY = Symbol.for("app.requestId")

type RequestWithId = IncomingMessage & { [REQUEST_ID_KEY]?: string }

export function resolveRequestId(request: RequestWithId): string {
  const existing = request[REQUEST_ID_KEY]
  if (existing) return existing

  const header = request.headers[REQUEST_ID_HEADER]
  const id =
    typeof header === "string" && header.length > 0 ? header : randomUUID()

  request[REQUEST_ID_KEY] = id
  return id
}

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (request: IncomingMessage) => resolveRequestId(request),
        setup: (cls: ClsService, _request, response: ServerResponse) => {
          response.setHeader(REQUEST_ID_HEADER, cls.getId())
        },
      },
    }),
  ],
})
export class RequestContextModule {}
