import type { z } from "zod"
import { errorEnvelopeSchema, successEnvelopeSchema } from "./envelope"
import { ApiError } from "./error"

export type ApiClientOptions = {
  baseUrl: string
  locale?: string
  headers?: Record<string, string>
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

export type RequestOptions<TSchema extends z.ZodType> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
  signal?: AbortSignal
  schema: TSchema
  acceptStatus?: number[]
}

export interface ApiClient {
  readonly origin: string
  readonly locale?: string
  request<TSchema extends z.ZodType>(
    init: RequestOptions<TSchema>
  ): Promise<z.infer<TSchema>>
  requestData<TSchema extends z.ZodType>(
    init: RequestOptions<TSchema>
  ): Promise<z.infer<TSchema>>
  withLocale(next: string): ApiClient
}

const DEFAULT_TIMEOUT_MS = 10_000

export function createApiClient(options: ApiClientOptions): ApiClient {
  const {
    baseUrl,
    locale,
    headers: baseHeaders,
    fetch: fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options

  const origin = baseUrl.replace(/\/+$/, "")

  async function request<TSchema extends z.ZodType>(
    init: RequestOptions<TSchema>
  ): Promise<z.infer<TSchema>> {
    const url = new URL(`${origin}${init.path}`)

    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }

    const headers = new Headers({
      accept: "application/json",
      ...baseHeaders,
      ...init.headers,
    })

    if (locale) {
      headers.set("x-lang", locale)
    }

    if (init.body !== undefined) {
      headers.set("content-type", "application/json")
    }

    const timeout = AbortSignal.timeout(timeoutMs)
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout

    let response: Response

    try {
      response = await fetchImpl(url, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal,
      })
    } catch (cause) {
      if (timeout.aborted) {
        throw new ApiError(
          "timeout",
          `${init.path} timed out after ${timeoutMs}ms`,
          { cause }
        )
      }

      throw new ApiError("network", `Could not reach ${origin}`, { cause })
    }

    const payload = await readJson(response)

    if (!response.ok && !init.acceptStatus?.includes(response.status)) {
      const envelope = errorEnvelopeSchema.safeParse(payload)

      throw new ApiError(
        "http",
        envelope.success
          ? envelope.data.message
          : `${init.method ?? "GET"} ${init.path} failed with ${response.status}`,
        { status: response.status, body: payload }
      )
    }

    const parsed = init.schema.safeParse(payload)

    if (!parsed.success) {
      throw new ApiError(
        "invalid-response",
        `${init.path} returned a body this client does not understand`,
        { status: response.status, body: payload, cause: parsed.error }
      )
    }

    return parsed.data
  }

  async function requestData<TSchema extends z.ZodType>(
    init: RequestOptions<TSchema>
  ): Promise<z.infer<TSchema>> {
    const envelope = await request({ ...init, schema: successEnvelopeSchema })
    const parsed = init.schema.safeParse(envelope.data)

    if (!parsed.success) {
      throw new ApiError(
        "invalid-response",
        `${init.path} returned a payload this client does not understand`,
        { body: envelope.data, cause: parsed.error }
      )
    }

    return parsed.data
  }

  return {
    origin,
    locale,
    request,
    requestData,
    withLocale: (next: string) => createApiClient({ ...options, locale: next }),
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
