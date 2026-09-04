import {
  errorResponseSchema,
  successResponseSchema,
} from "@workspace/schemas/http"
import type { AxiosInstance, AxiosResponse } from "axios"
import type { z } from "zod"
import { ApiError, toApiError } from "./error"
import type {
  ClientHooks,
  FetchConfig,
  HttpMethod,
  RetryOptions,
  SendConfig,
} from "./types"

const DEFAULT_RETRY = {
  attempts: 2,
  delayMs: (attempt: number) => 2 ** attempt * 150,
  methods: ["GET"] as HttpMethod[],
  statuses: [408, 429, 500, 502, 503, 504],
}

export type RequesterOptions = {
  http: AxiosInstance
  baseUrl: string
  timeout: number
  retry: RetryOptions | false
  hooks?: ClientHooks
}

export function createRequester(options: RequesterOptions) {
  const retry =
    options.retry === false
      ? { ...DEFAULT_RETRY, attempts: 0 }
      : { ...DEFAULT_RETRY, ...options.retry }

  async function perform(config: SendConfig): Promise<AxiosResponse> {
    const method = config.method ?? "GET"
    const timeout = config.timeout ?? options.timeout
    const retryable = retry.attempts > 0 && retry.methods.includes(method)

    for (let attempt = 0; ; attempt++) {
      let response: AxiosResponse

      try {
        response = await options.http.request({
          url: config.path,
          method,
          data: config.body,
          params: config.query,
          headers: config.headers,
          signal: config.signal,
          timeout: config.timeout,
        })
      } catch (cause) {
        const error = toApiError(cause, {
          baseUrl: options.baseUrl,
          path: config.path,
          timeout,
        })

        if (error.retryable && retryable && attempt < retry.attempts) {
          await wait(retry.delayMs, attempt)
          continue
        }

        throw error
      }

      if (
        retryable &&
        attempt < retry.attempts &&
        retry.statuses.includes(response.status) &&
        !accepts(response.status, config.acceptStatus)
      ) {
        await wait(retry.delayMs, attempt)
        continue
      }

      return response
    }
  }

  async function run<TResult>(
    config: SendConfig,
    read: (response: AxiosResponse) => TResult
  ): Promise<TResult> {
    try {
      const response = await perform(config)

      if (!accepts(response.status, config.acceptStatus)) {
        throw httpError(response, config)
      }

      return read(response)
    } catch (cause) {
      const error = toApiError(cause, {
        baseUrl: options.baseUrl,
        path: config.path,
        timeout: config.timeout ?? options.timeout,
      })

      await options.hooks?.onError?.(error)

      throw error
    }
  }

  function fetch<TSchema extends z.ZodType>(
    config: FetchConfig<TSchema>
  ): Promise<z.infer<TSchema>> {
    return run(config, (response) => {
      const payload =
        config.envelope === false ? response.data : unwrap(response, config)
      const parsed = config.schema.safeParse(payload)

      if (!parsed.success) {
        throw new ApiError(
          "invalid-response",
          `${config.path} returned a body this client does not understand`,
          { status: response.status, body: response.data, cause: parsed.error }
        )
      }

      return parsed.data
    })
  }

  function send(config: SendConfig): Promise<void> {
    return run(config, (response) => {
      if (config.envelope !== false) {
        unwrap(response, config)
      }
    })
  }

  return { fetch, send }
}

function accepts(status: number, acceptStatus?: number[]): boolean {
  return status < 400 || (acceptStatus?.includes(status) ?? false)
}

function unwrap(response: AxiosResponse, config: SendConfig): unknown {
  const envelope = successResponseSchema.safeParse(response.data)

  if (!envelope.success) {
    throw new ApiError(
      "invalid-response",
      `${config.path} did not return an API envelope`,
      { status: response.status, body: response.data, cause: envelope.error }
    )
  }

  return envelope.data.data
}

function httpError(response: AxiosResponse, config: SendConfig): ApiError {
  const envelope = errorResponseSchema.safeParse(response.data)

  if (envelope.success) {
    return new ApiError("http", envelope.data.message, {
      status: response.status,
      code: envelope.data.code,
      detail: envelope.data.error,
      body: response.data,
    })
  }

  return new ApiError(
    "http",
    `${config.method ?? "GET"} ${config.path} failed with ${response.status}`,
    { status: response.status, body: response.data }
  )
}

function wait(
  delayMs: number | ((attempt: number) => number),
  attempt: number
): Promise<void> {
  const ms = typeof delayMs === "function" ? delayMs(attempt) : delayMs

  return new Promise((resolve) => setTimeout(resolve, ms))
}
