import { z } from "zod"

const clientEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8001"),
})

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
})

if (!parsed.success) {
  throw new Error(
    `Invalid public environment:\n${z.prettifyError(parsed.error)}`
  )
}

export const env = parsed.data
