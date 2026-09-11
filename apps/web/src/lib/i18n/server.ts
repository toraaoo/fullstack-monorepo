import "server-only"
import { headers } from "next/headers"
import { cache } from "react"
import { LOCALE_HEADER } from "@/lib/i18n/header"
import {
  baseLocale,
  isLocale,
  type Locale,
  overwriteGetLocale,
} from "@/lib/paraglide/runtime"

const requestLocale = cache((): { locale: Locale } => ({ locale: baseLocale }))

overwriteGetLocale(() => requestLocale().locale)

export const getServerLocale = cache(async (): Promise<Locale> => {
  const value = (await headers()).get(LOCALE_HEADER)
  const locale = value && isLocale(value) ? value : baseLocale

  requestLocale().locale = locale

  return locale
})
