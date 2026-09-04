"use client"

import { ArrowsClockwiseIcon } from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { ApiError, healthQueries } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { getApiClient } from "@/lib/api/client"
import { m } from "@/lib/paraglide/messages"
import type { Locale } from "@/lib/paraglide/runtime"
import { MICRO_LABEL } from "@/lib/typography"

type ProbeState = "checking" | "up" | "down" | "unknown"

const STATE_TONE: Record<ProbeState, string> = {
  checking: "bg-muted-foreground/50",
  up: "bg-emerald-500",
  down: "bg-rose-500",
  unknown: "bg-amber-500",
}

export function SystemStatus({ locale }: { locale: Locale }) {
  const client = getApiClient(locale)
  const query = useQuery(healthQueries.readiness(client))
  const [refreshing, setRefreshing] = React.useState(false)

  const unreachable =
    query.isError &&
    ApiError.isApiError(query.error) &&
    (query.error.kind === "network" || query.error.kind === "timeout")

  const report = query.data
  const probe = (key: string): ProbeState => {
    if (query.isPending) return "checking"
    if (!report) return "unknown"
    return report.details[key]?.status === "up" ? "up" : "down"
  }

  const overall: ProbeState = query.isPending
    ? "checking"
    : unreachable || !report
      ? "unknown"
      : report.status === "ok"
        ? "up"
        : "down"

  const summary = query.isPending
    ? m.status_summary_checking({}, { locale })
    : unreachable || !report
      ? m.status_summary_unreachable({}, { locale })
      : report.status === "ok"
        ? m.status_summary_ok({}, { locale })
        : m.status_summary_degraded({}, { locale })

  const rows: Array<{ label: string; state: ProbeState }> = [
    {
      label: m.status_probe_api({}, { locale }),
      state: query.isPending ? "checking" : report ? "up" : "unknown",
    },
    {
      label: m.status_probe_database({}, { locale }),
      state: probe("database"),
    },
    {
      label: m.status_probe_memory({}, { locale }),
      state: probe("memory_heap"),
    },
  ]

  return (
    <section
      aria-labelledby="system-status-heading"
      className="rounded-xl border border-border bg-card/60 backdrop-blur-sm"
    >
      <header className="flex items-center justify-between gap-4 border-border/70 border-b px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <StateDot state={overall} />
          <h2
            id="system-status-heading"
            className="truncate font-medium text-sm"
          >
            {m.status_heading({}, { locale })}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            setRefreshing(true)
            query.refetch().finally(() => setRefreshing(false))
          }}
          className={cn("text-muted-foreground", MICRO_LABEL)}
        >
          <ArrowsClockwiseIcon
            weight="bold"
            className={cn(refreshing && "animate-spin")}
          />
          {m.status_refresh({}, { locale })}
        </Button>
      </header>

      <dl className="divide-y divide-border/60">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline gap-4 px-5 py-3 text-sm"
          >
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <span
              aria-hidden
              className="h-px min-w-6 flex-1 translate-y-[-0.2em] bg-border"
            />
            <dd className={cn("flex shrink-0 items-center gap-2", MICRO_LABEL)}>
              <StateDot state={row.state} />
              {stateLabel(row.state, locale)}
            </dd>
          </div>
        ))}
      </dl>

      <footer className="space-y-1 border-border/70 border-t px-5 py-3.5">
        <p className="text-muted-foreground text-sm">{summary}</p>
        {unreachable ? (
          <p className="text-muted-foreground/80 text-xs">
            {m.status_hint_unreachable({}, { locale })}
          </p>
        ) : null}
        <p className="pt-1 font-mono text-[0.6875rem] text-muted-foreground/70 tracking-wide">
          {m.status_endpoint({ path: `${client.origin}/health` }, { locale })}
          {query.dataUpdatedAt ? (
            <>
              {" · "}
              <time
                dateTime={new Date(query.dataUpdatedAt).toISOString()}
                suppressHydrationWarning
              >
                {m.status_checked_at(
                  {
                    time: new Intl.DateTimeFormat(locale, {
                      timeStyle: "medium",
                    }).format(query.dataUpdatedAt),
                  },
                  { locale }
                )}
              </time>
            </>
          ) : null}
        </p>
      </footer>
    </section>
  )
}

function StateDot({ state }: { state: ProbeState }) {
  return (
    <span className="relative flex size-1.5 shrink-0">
      {state === "checking" ? (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-muted-foreground/60" />
      ) : null}
      <span
        className={cn(
          "relative inline-flex size-1.5 rounded-full",
          STATE_TONE[state]
        )}
      />
    </span>
  )
}

function stateLabel(state: ProbeState, locale: Locale) {
  switch (state) {
    case "checking":
      return m.status_state_checking({}, { locale })
    case "up":
      return m.status_state_up({}, { locale })
    case "down":
      return m.status_state_down({}, { locale })
    default:
      return m.status_state_unknown({}, { locale })
  }
}
