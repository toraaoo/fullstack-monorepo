import axios, { type AxiosInstance } from "axios"
import type { ClientOptions } from "./types"

export const DEFAULT_TIMEOUT = 10_000

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "")
}

export function createHttp(options: ClientOptions): AxiosInstance {
  const http = axios.create({
    baseURL: normalizeBaseUrl(options.baseUrl),
    timeout: options.timeout ?? DEFAULT_TIMEOUT,
    headers: { accept: "application/json" },
    validateStatus: () => true,
  })

  http.interceptors.request.use(async (config) => {
    const resolved =
      typeof options.headers === "function"
        ? await options.headers()
        : options.headers

    for (const [name, value] of Object.entries(resolved ?? {})) {
      config.headers.set(name, value)
    }

    if (options.locale) {
      config.headers.set("x-lang", options.locale)
    }

    await options.hooks?.onRequest?.(config)

    return config
  })

  http.interceptors.response.use(async (response) => {
    await options.hooks?.onResponse?.(response)
    return response
  })

  return http
}
