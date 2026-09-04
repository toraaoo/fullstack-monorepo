import { queryOptions } from "@tanstack/react-query"
import type { ApiClient } from "./client"
import { ApiError } from "./error"
import { getHealth, getLiveness } from "./health"

const scope = (client: ApiClient) =>
  ["api", client.origin, client.locale ?? "default"] as const

export const healthQueries = {
  readiness: (client: ApiClient) =>
    queryOptions({
      queryKey: [...scope(client), "health", "readiness"] as const,
      queryFn: ({ signal }) => getHealth(client, { signal }),
      retry: (failureCount, error) =>
        ApiError.isApiError(error) && error.kind === "network"
          ? false
          : failureCount < 1,
      staleTime: 15_000,
    }),

  liveness: (client: ApiClient) =>
    queryOptions({
      queryKey: [...scope(client), "health", "liveness"] as const,
      queryFn: ({ signal }) => getLiveness(client, { signal }),
      retry: false,
      staleTime: 15_000,
    }),
}
