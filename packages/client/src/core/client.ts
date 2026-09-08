import type { AxiosInstance } from "axios"
import { type Resources, resourceRegistry } from "../resources"
import { createHttp, DEFAULT_TIMEOUT, normalizeBaseUrl } from "./http"
import { createRequester } from "./request"
import type { ClientOptions, RequestContext } from "./types"

export type Client = Resources & {
  readonly baseUrl: string
  readonly scope: string
  readonly locale?: string
  readonly apiVersion?: string
  readonly $http: AxiosInstance
  readonly $fetch: RequestContext["fetch"]
  readonly $send: RequestContext["send"]
  with(overrides: Partial<ClientOptions>): Client
}

export function createClient(options: ClientOptions): Client {
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const scope =
    options.scope ??
    (options.apiVersion ? `${baseUrl}#v${options.apiVersion}` : baseUrl)
  const http = createHttp(options)

  const { fetch, send } = createRequester({
    http,
    baseUrl,
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    retry: options.retry ?? {},
    hooks: options.hooks,
  })

  const context: RequestContext = {
    baseUrl,
    scope,
    locale: options.locale,
    http,
    fetch,
    send,
  }

  const resources = Object.fromEntries(
    Object.entries(resourceRegistry).map(([name, factory]) => [
      name,
      factory(context),
    ])
  ) as Resources

  return {
    ...resources,
    baseUrl,
    scope,
    locale: options.locale,
    apiVersion: options.apiVersion,
    $http: http,
    $fetch: fetch,
    $send: send,
    with: (overrides) => createClient({ ...options, ...overrides }),
  }
}
