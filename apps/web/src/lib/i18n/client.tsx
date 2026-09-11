"use client"

import * as React from "react"
import type { Locale } from "@/lib/paraglide/runtime"

const LocaleContext = React.createContext<Locale | null>(null)

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return <LocaleContext value={locale}>{children}</LocaleContext>
}

export function useLocale(): Locale {
  const locale = React.use(LocaleContext)

  if (!locale) {
    throw new Error(
      "useLocale() needs a <LocaleProvider> above it. The root layout renders one through <Providers>."
    )
  }

  return locale
}
