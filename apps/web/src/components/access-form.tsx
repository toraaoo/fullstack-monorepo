"use client"

import { ArrowUpRightIcon, CheckCircleIcon } from "@phosphor-icons/react"
import { useForm } from "@tanstack/react-form"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import * as React from "react"
import { z } from "zod"
import { m } from "@/lib/paraglide/messages"
import type { Locale } from "@/lib/paraglide/runtime"

function accessSchema(locale: Locale) {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, m["access.error.required"]({}, { locale }))
      .pipe(z.email(m["access.error.invalid"]({}, { locale }))),
  })
}

export function AccessForm({ locale }: { locale: Locale }) {
  const [accepted, setAccepted] = React.useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: accessSchema(locale) },
    onSubmit: ({ value }) => {
      setAccepted(value.email)
    },
  })

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
      className="space-y-3"
    >
      <form.Field name="email">
        {(field) => {
          const error = field.state.meta.errors.at(0)
          const errorId = `${field.name}-error`

          return (
            <div className="space-y-1.5">
              <Label htmlFor={field.name} className="text-muted-foreground">
                {m["access.email.label"]({}, { locale })}
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={m["access.email.placeholder"]({}, { locale })}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    setAccepted(null)
                    field.handleChange(event.target.value)
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="h-9 sm:flex-1"
                />
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isSubmitting]) => (
                    <Button
                      type="submit"
                      size="lg"
                      disabled={!canSubmit}
                      className="shrink-0"
                    >
                      {isSubmitting
                        ? m["access.submitting"]({}, { locale })
                        : m["access.submit"]({}, { locale })}
                      <ArrowUpRightIcon weight="bold" />
                    </Button>
                  )}
                </form.Subscribe>
              </div>
              {error ? (
                <p
                  id={errorId}
                  role="alert"
                  className="text-destructive text-xs"
                >
                  {typeof error === "string" ? error : error.message}
                </p>
              ) : null}
            </div>
          )
        }}
      </form.Field>

      {accepted ? (
        <p className="flex items-center gap-1.5 text-emerald-600 text-xs dark:text-emerald-400">
          <CheckCircleIcon weight="fill" className="size-3.5" />
          {m["access.accepted"]({ email: accepted }, { locale })}
        </p>
      ) : (
        <p className="text-muted-foreground/80 text-xs">
          {m["access.notice"]({}, { locale })}
        </p>
      )}
    </form>
  )
}
