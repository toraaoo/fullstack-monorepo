import "server-only"
import { headers } from "next/headers"
import { cache } from "react"
import { extractLocaleFromRequest, type Locale } from "@/lib/paraglide/runtime"

export const getServerLocale = cache(async (): Promise<Locale> => {
  const requestHeaders = await headers()

  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http"

  const forwarded = new Headers()
  for (const name of ["cookie", "accept-language"]) {
    const value = requestHeaders.get(name)
    if (value) {
      forwarded.set(name, value)
    }
  }

  return extractLocaleFromRequest(
    new Request(`${protocol}://${host ?? "localhost"}/`, {
      headers: forwarded,
    })
  )
})
