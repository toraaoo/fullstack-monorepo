import { type Client, createClient } from "@workspace/client"
import { apiOrigin, publicApiOrigin } from "@/lib/env"

const SERVER_TIMEOUT_MS = 2_000
const API_SCOPE = "api"

const clients = new Map<string, Client>()

function client(
  key: string,
  baseUrl: string,
  timeout?: number,
  locale?: string
): Client {
  const existing = clients.get(key)

  if (existing) {
    return existing
  }

  const created = createClient({
    baseUrl,
    scope: API_SCOPE,
    locale,
    timeout,
  })

  clients.set(key, created)

  return created
}

export function getApiClient(locale?: string): Client {
  return client(
    `browser:${locale ?? "default"}`,
    publicApiOrigin(),
    undefined,
    locale
  )
}

export function getServerApiClient(locale?: string): Client {
  return client(
    `server:${locale ?? "default"}`,
    apiOrigin(),
    SERVER_TIMEOUT_MS,
    locale
  )
}
