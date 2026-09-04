import { type NextRequest, NextResponse } from "next/server"
import {
  cookieMaxAge,
  cookieName,
  extractLocaleFromRequest,
  isLocale,
} from "@/lib/paraglide/runtime"

export function proxy(request: NextRequest) {
  const response = NextResponse.next()
  const current = request.cookies.get(cookieName)?.value

  if (current && isLocale(current)) {
    return response
  }

  response.cookies.set(cookieName, extractLocaleFromRequest(request), {
    path: "/",
    maxAge: cookieMaxAge,
    sameSite: "lax",
  })

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.\\w+$).*)"],
}
