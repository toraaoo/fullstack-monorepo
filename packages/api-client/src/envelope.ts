import { z } from "zod"

export const successEnvelopeSchema = z.object({
  code: z.number(),
  success: z.literal(true),
  message: z.string(),
  data: z.unknown(),
})

export const errorEnvelopeSchema = z.object({
  code: z.number(),
  success: z.literal(false),
  message: z.string(),
  data: z.null().optional(),
})

export type SuccessEnvelope = z.infer<typeof successEnvelopeSchema>
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>
