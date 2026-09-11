import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { healthQueries } from "@workspace/client/react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { AccessForm } from "@/components/access-form"
import { StackManifest } from "@/components/stack-manifest"
import { SystemStatus } from "@/components/system-status"
import { getServerApiClient } from "@/lib/api/client"
import { publicApiOrigin } from "@/lib/env"
import { getServerLocale } from "@/lib/i18n/server"
import { m } from "@/lib/paraglide/messages"
import { getQueryClient } from "@/lib/query/client"
import { DISPLAY_TEXT, MICRO_LABEL } from "@/lib/typography"

export default async function Page() {
  const locale = await getServerLocale()
  const queryClient = getQueryClient()

  await queryClient.prefetchQuery(
    healthQueries.check(getServerApiClient(locale))
  )

  return (
    <>
      <section className="pt-16 pb-12 sm:pt-24 sm:pb-16">
        <p
          className={cn(
            "flex items-center gap-3 text-muted-foreground",
            MICRO_LABEL
          )}
        >
          <span aria-hidden className="h-px w-6 bg-border" />
          {m["home.eyebrow"]()}
        </p>

        <h1
          className={cn(
            "mt-6 max-w-3xl font-semibold text-4xl leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.25rem]",
            DISPLAY_TEXT
          )}
        >
          {m["home.title"]()}
        </h1>

        <p className="mt-6 max-w-2xl text-pretty break-keep text-base text-muted-foreground leading-relaxed sm:text-lg">
          {m["home.lede"]()}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          <Button
            size="lg"
            nativeButton={false}
            render={
              <a
                href={`${publicApiOrigin()}/docs`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            {m["home.cta.docs"]()}
            <ArrowUpRightIcon weight="bold" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            nativeButton={false}
            render={<a href="#stack" />}
          >
            {m["home.cta.repo"]()}
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <div className="lg:col-span-3">
            <SystemStatus />
          </div>
        </HydrationBoundary>

        <section
          aria-labelledby="access-heading"
          className="flex flex-col justify-between gap-5 rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm lg:col-span-2"
        >
          <div className="space-y-2">
            <h2 id="access-heading" className="font-medium text-sm">
              {m["access.heading"]()}
            </h2>
            <p className="break-keep text-muted-foreground text-sm leading-relaxed">
              {m["access.lede"]()}
            </p>
          </div>

          <AccessForm />
        </section>
      </div>

      <div className="pt-16">
        <StackManifest />
      </div>
    </>
  )
}
