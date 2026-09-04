import { healthReportSchema, livenessSchema } from "@workspace/schemas/health"
import type { RequestContext, RequestOptions } from "../core/types"

export function healthResource(context: RequestContext) {
  return {
    check: (options: RequestOptions = {}) =>
      context.fetch({
        ...options,
        path: "/health",
        schema: healthReportSchema,
        envelope: false,
        acceptStatus: [503],
      }),

    live: (options: RequestOptions = {}) =>
      context.fetch({
        ...options,
        path: "/health/live",
        schema: livenessSchema,
        envelope: false,
      }),
  }
}
