import { z } from "zod"

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8000"),
})

const serverEnvSchema = z.object({
  API_URL: z.url().optional(),
})

type PublicEnv = z.infer<typeof publicEnvSchema>
type ServerEnv = z.infer<typeof serverEnvSchema>

let publicCached: PublicEnv | undefined
let serverCached: ServerEnv | undefined

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

export function publicEnv(): PublicEnv {
  if (publicCached) {
    return publicCached
  }

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment:\n${z.prettifyError(parsed.error)}`
    )
  }

  publicCached = parsed.data

  return publicCached
}

export function serverEnv(): ServerEnv {
  if (serverCached) {
    return serverCached
  }

  const parsed = serverEnvSchema.safeParse({ API_URL: process.env.API_URL })

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment:\n${z.prettifyError(parsed.error)}`
    )
  }

  serverCached = parsed.data

  return serverCached
}

export function publicApiOrigin(): string {
  return withoutTrailingSlash(publicEnv().NEXT_PUBLIC_API_URL)
}

export function apiOrigin(): string {
  const internal = serverEnv().API_URL

  return internal ? withoutTrailingSlash(internal) : publicApiOrigin()
}
