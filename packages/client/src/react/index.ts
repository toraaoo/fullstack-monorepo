import { queryOptions } from "@tanstack/react-query"
import type { Client } from "../core/client"

export function clientKey(client: Client) {
  return ["api", client.scope, client.locale ?? "default"] as const
}

export const healthKeys = {
  all: (client: Client) => [...clientKey(client), "health"] as const,
  check: (client: Client) => [...healthKeys.all(client), "check"] as const,
  live: (client: Client) => [...healthKeys.all(client), "live"] as const,
}

export const healthQueries = {
  check: (client: Client) =>
    queryOptions({
      queryKey: healthKeys.check(client),
      queryFn: ({ signal }) => client.health.check({ signal }),
      retry: false,
      staleTime: 15_000,
    }),

  live: (client: Client) =>
    queryOptions({
      queryKey: healthKeys.live(client),
      queryFn: ({ signal }) => client.health.live({ signal }),
      retry: false,
      staleTime: 15_000,
    }),
}
