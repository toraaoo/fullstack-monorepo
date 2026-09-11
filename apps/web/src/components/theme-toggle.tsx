"use client"

import { MoonIcon, SunIcon } from "@phosphor-icons/react"
import { Button } from "@workspace/ui/components/button"
import { useTheme } from "next-themes"
import { useLocale } from "@/lib/i18n/client"
import { m } from "@/lib/paraglide/messages"

export function ThemeToggle() {
  const locale = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const label = m["nav.theme"]({}, { locale })

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <MoonIcon weight="bold" className="block dark:hidden" />
      <SunIcon weight="bold" className="hidden dark:block" />
    </Button>
  )
}
