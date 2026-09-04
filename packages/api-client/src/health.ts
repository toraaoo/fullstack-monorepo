import { z } from "zod"
import type { ApiClient } from "./client"

export const healthIndicatorSchema = z.looseObject({
  status: z.enum(["up", "down"]),
})

export const healthReportSchema = z.object({
  status: z.enum(["ok", "error", "shutting_down"]),
  info: z.record(z.string(), healthIndicatorSchema).nullish(),
  error: z.record(z.string(), healthIndicatorSchema).nullish(),
  details: z.record(z.string(), healthIndicatorSchema),
})

export const livenessSchema = z.object({
  status: z.literal("ok"),
})

export type HealthIndicator = z.infer<typeof healthIndicatorSchema>
export type HealthReport = z.infer<typeof healthReportSchema>
export type Liveness = z.infer<typeof livenessSchema>

export function getHealth(
  client: ApiClient,
  options: { signal?: AbortSignal } = {}
) {
  return client.request({
    path: "/health",
    schema: healthReportSchema,
    acceptStatus: [503],
    signal: options.signal,
  })
}

export function getLiveness(
  client: ApiClient,
  options: { signal?: AbortSignal } = {}
) {
  return client.request({
    path: "/health/live",
    schema: livenessSchema,
    signal: options.signal,
  })
}
