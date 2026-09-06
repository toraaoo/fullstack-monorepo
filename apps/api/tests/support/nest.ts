import type {
  ArgumentsHost,
  CallHandler,
  ExecutionContext,
} from "@nestjs/common"
import { of } from "rxjs"

export interface RecordingResponse {
  statusCode?: number
  body?: unknown
  status(code: number): RecordingResponse
  json(payload: unknown): RecordingResponse
}

export function recordingResponse(): RecordingResponse {
  const response: RecordingResponse = {
    status(code) {
      response.statusCode = code
      return response
    },
    json(payload) {
      response.body = payload
      return response
    },
  }

  return response
}

export function argumentsHost(parts: {
  request?: unknown
  response?: unknown
}): ArgumentsHost {
  const http = {
    getRequest: () => parts.request ?? {},
    getResponse: () => parts.response ?? {},
    getNext: () => undefined,
  }

  return { switchToHttp: () => http } as unknown as ArgumentsHost
}

export function executionContext(parts: {
  handler?: (...args: never[]) => unknown
  controller?: new (...args: never[]) => unknown
  request?: unknown
}): ExecutionContext {
  const http = {
    getRequest: () => parts.request ?? {},
    getResponse: () => ({}),
    getNext: () => undefined,
  }

  return {
    getHandler: () => parts.handler ?? (() => undefined),
    getClass: () => parts.controller ?? Object,
    switchToHttp: () => http,
  } as unknown as ExecutionContext
}

export function callHandler(value: unknown): CallHandler {
  return { handle: () => of(value) }
}
