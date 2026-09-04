import { cn } from "@workspace/ui/lib/utils"
import { m } from "@/lib/paraglide/messages"
import type { Locale } from "@/lib/paraglide/runtime"
import { MICRO_LABEL } from "@/lib/typography"

const ROWS = [
  { role: "stack_role_web", parts: ["Next.js 16", "React 19"] },
  { role: "stack_role_api", parts: ["NestJS 12", "Fastify 5"] },
  { role: "stack_role_data", parts: ["Drizzle ORM", "PostgreSQL"] },
  { role: "stack_role_i18n", parts: ["Paraglide JS", "nestjs-i18n"] },
  { role: "stack_role_state", parts: ["TanStack Query"] },
  { role: "stack_role_forms", parts: ["TanStack Form", "Zod 4"] },
  { role: "stack_role_ui", parts: ["Tailwind CSS 4", "shadcn/ui", "Phosphor"] },
  { role: "stack_role_tooling", parts: ["Turborepo", "Bun", "Biome"] },
] as const

export function StackManifest({ locale }: { locale: Locale }) {
  return (
    <section
      aria-labelledby="stack-heading"
      className="scroll-mt-20"
      id="stack"
    >
      <h2
        id="stack-heading"
        className={cn("text-muted-foreground", MICRO_LABEL)}
      >
        {m.stack_heading({}, { locale })}
      </h2>

      <dl className="mt-5 grid gap-x-12 border-border/70 border-t sm:grid-cols-2">
        {ROWS.map((row) => (
          <div
            key={row.role}
            className="flex flex-col gap-1 border-border/60 border-b py-3 sm:flex-row sm:items-baseline sm:gap-5"
          >
            <dt
              className={cn(
                "text-muted-foreground sm:w-36 sm:shrink-0",
                MICRO_LABEL
              )}
            >
              {m[row.role]({}, { locale })}
            </dt>
            <dd className="min-w-0 flex-1 text-[0.9375rem]">
              {row.parts.map((part, index) => (
                <span key={part} className="whitespace-nowrap">
                  {index > 0 ? (
                    <span aria-hidden className="px-1.5 text-border">
                      /
                    </span>
                  ) : null}
                  {part}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
