import { type NextRequest, NextResponse } from "next/server"
import { LOCALE_HEADER } from "@/lib/i18n/header"
import { cookieMaxAge, cookieName } from "@/lib/paraglide/runtime"
import { paraglideMiddleware } from "@/lib/paraglide/server"

export function proxy(request: NextRequest) {
  return paraglideMiddleware(request, async ({ request: resolved, locale }) => {
    const headers = new Headers(resolved.headers)
    headers.set(LOCALE_HEADER, locale)

    const response = NextResponse.next({ request: { headers } })

    if (request.cookies.get(cookieName)?.value !== locale) {
      response.cookies.set(cookieName, locale, {
        path: "/",
        maxAge: cookieMaxAge,
        sameSite: "lax",
      })
    }

    return response
  })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|healthz|favicon.ico|.*\\.\\w+$).*)"],
}
