import { UnprocessableEntityException } from "@nestjs/common"
import { errorCodes } from "@workspace/schemas/http"
import { unwrapMessageKey } from "@workspace/schemas/i18n"
import { I18nContext } from "nestjs-i18n"
import { createZodValidationPipe } from "nestjs-zod"
import { z } from "zod"
import type { $ZodIssue } from "zod/v4/core"

z.config({
  customError: (issue) => translateIssue(issue as $ZodIssue),
})

export const CustomValidationPipe = createZodValidationPipe({
  createValidationException: (error) => {
    const issues = (error as { issues?: $ZodIssue[] })?.issues ?? []
    const fields = formatIssues(issues)
    const firstMessage = Object.values(fields)[0]?.[0]

    return new UnprocessableEntityException({
      code: errorCodes.validationFailed,
      message: firstMessage,
      fields,
    })
  },
})

function formatIssues(issues: $ZodIssue[]): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {}

  for (const issue of issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_"
    const messages = formattedErrors[field] ?? []
    messages.push(resolveMessage(issue.message))
    formattedErrors[field] = messages
  }

  return formattedErrors
}

function resolveMessage(message: string): string {
  const key = unwrapMessageKey(message)

  if (!key) {
    return message
  }

  const i18n = I18nContext.current()

  if (!i18n) {
    return message
  }

  const path = `validation.${key}`
  const translated = i18n.t(path)

  return typeof translated === "string" && translated !== path
    ? translated
    : message
}

function translateIssue(issue: $ZodIssue): string | undefined {
  const i18n = I18nContext.current()
  if (!i18n) return undefined

  const key = `validation.${issueKey(issue)}`
  const message = i18n.t(key, { args: issueArgs(issue) })

  return typeof message === "string" && message !== key ? message : undefined
}

function issueKey(issue: $ZodIssue): string {
  if (issue.code === "invalid_type" && issue.input === undefined) {
    return "required"
  }

  if (issue.code === "invalid_format") {
    return `format.${issue.format}`
  }

  return issue.code
}

function issueArgs(issue: $ZodIssue): Record<string, unknown> {
  const path = issue.path ?? []
  const property = path.length > 0 ? String(path.at(-1)) : "value"

  return { ...issue, property, path: path.join(".") }
}
