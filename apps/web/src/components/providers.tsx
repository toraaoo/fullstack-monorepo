"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import type * as React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { LocaleProvider } from "@/lib/i18n/client"
import type { Locale } from "@/lib/paraglide/runtime"
import { getQueryClient } from "@/lib/query/client"

export function Providers({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  const queryClient = getQueryClient()

  return (
    <LocaleProvider locale={locale}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </LocaleProvider>
  )
}
