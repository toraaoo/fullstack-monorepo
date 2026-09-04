import { cn } from "@workspace/ui/lib/utils"
import type * as React from "react"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { ThemeToggle } from "@/components/theme-toggle"
import { m } from "@/lib/paraglide/messages"
import type { Locale } from "@/lib/paraglide/runtime"
import { MICRO_LABEL } from "@/lib/typography"

export function SiteShell({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-svh flex-col">
      <Backdrop />

      <header className="sticky top-0 z-10 border-border/60 border-b bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center">
            <span className="truncate font-semibold text-[0.9375rem] tracking-tight">
              {m["app.name"]({}, { locale })}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <LocaleSwitcher locale={locale} />
            <ThemeToggle locale={locale} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">{children}</main>

      <footer className="mx-auto w-full max-w-5xl px-6 pt-16 pb-10">
        <div className="border-border/60 border-t pt-6">
          <p className={cn("text-muted-foreground/70", MICRO_LABEL)}>
            {m["app.footer.note"]({}, { locale })}
          </p>
        </div>
      </footer>
    </div>
  )
}

function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-70 dark:opacity-45"
        style={{
          backgroundImage:
            "linear-gradient(to right, color-mix(in oklch, var(--foreground) 9%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 9%, transparent) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(120% 70% at 50% 0%, black 10%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(120% 70% at 50% 0%, black 10%, transparent 70%)",
        }}
      />
    </div>
  )
}
