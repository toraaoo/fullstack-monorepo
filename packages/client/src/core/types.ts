import type {
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios"
import type { z } from "zod"
import type { ApiError } from "./error"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined | Array<string | number>
>

export type HeaderSource =
  | Record<string, string>
  | (() => Record<string, string> | Promise<Record<string, string>>)

export type ClientHooks = {
  onRequest?: (config: InternalAxiosRequestConfig) => void | Promise<void>
  onResponse?: (response: AxiosResponse) => void | Promise<void>
  onError?: (error: ApiError) => void | Promise<void>
}

export type RetryOptions = {
  attempts?: number
  delayMs?: number | ((attempt: number) => number)
  methods?: HttpMethod[]
  statuses?: number[]
}

export type ClientOptions = {
  baseUrl: string
  scope?: string
  locale?: string
  headers?: HeaderSource
  timeout?: number
  retry?: RetryOptions | false
  hooks?: ClientHooks
}

export type RequestOptions = {
  signal?: AbortSignal
  headers?: Record<string, string>
  timeout?: number
}

export type FetchConfig<TSchema extends z.ZodType> = RequestOptions & {
  path: string
  method?: HttpMethod
  body?: unknown
  query?: QueryParams
  schema: TSchema
  envelope?: boolean
  acceptStatus?: number[]
}

export type SendConfig = RequestOptions & {
  path: string
  method?: HttpMethod
  body?: unknown
  query?: QueryParams
  envelope?: boolean
  acceptStatus?: number[]
}

export type RequestContext = {
  readonly baseUrl: string
  readonly scope: string
  readonly locale?: string
  readonly http: AxiosInstance
  fetch<TSchema extends z.ZodType>(
    config: FetchConfig<TSchema>
  ): Promise<z.infer<TSchema>>
  send(config: SendConfig): Promise<void>
}

export type ResourceFactory<TResource> = (context: RequestContext) => TResource
