"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import type * as React from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { getQueryClient } from "@/lib/query/client"

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  )
}
