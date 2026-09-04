"use client"

import { cn } from "@workspace/ui/lib/utils"
import { m } from "@/lib/paraglide/messages"
import { type Locale, locales, setLocale } from "@/lib/paraglide/runtime"

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  ko: "한국어",
}

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  return (
    <fieldset className="flex min-w-0 items-center gap-0.5 rounded-lg border border-border/70 p-0.5">
      <legend className="sr-only">{m.nav_language({}, { locale })}</legend>
      {locales.map((candidate) => {
        const active = candidate === locale

        return (
          <button
            key={candidate}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) {
                setLocale(candidate)
              }
            }}
            className={cn(
              "rounded-[min(var(--radius-md),10px)] px-2 py-1 font-medium font-mono text-[0.6875rem] uppercase tracking-widest transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {LOCALE_LABELS[candidate]}
          </button>
        )
      })}
    </fieldset>
  )
}
