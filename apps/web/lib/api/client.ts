import { type ApiClient, createApiClient } from "@workspace/api-client"
import { env } from "@/lib/env"

const SERVER_TIMEOUT_MS = 2_000

const clients = new Map<string, ApiClient>()

function client(key: string, timeoutMs?: number, locale?: string): ApiClient {
  const existing = clients.get(key)

  if (existing) {
    return existing
  }

  const created = createApiClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    locale,
    timeoutMs,
  })

  clients.set(key, created)

  return created
}

export function getApiClient(locale?: string): ApiClient {
  return client(`browser:${locale ?? "default"}`, undefined, locale)
}

export function getServerApiClient(locale?: string): ApiClient {
  return client(`server:${locale ?? "default"}`, SERVER_TIMEOUT_MS, locale)
}
