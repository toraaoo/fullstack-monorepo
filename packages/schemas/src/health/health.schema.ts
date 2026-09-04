import { z } from "zod"

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
