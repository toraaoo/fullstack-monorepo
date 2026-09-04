import { UnprocessableEntityException } from "@nestjs/common"
import { I18nContext } from "nestjs-i18n"
import { createZodValidationPipe } from "nestjs-zod"
import { z } from "zod"
import type { $ZodIssue } from "zod/v4/core"

/* Installing the global error map at import time means anything that pulls in
   this pipe -- the app, a test, a script -- gets translated messages without a
   separate setup call. Schema-level messages still win: zod resolves
   issue-level, then schema-level, then this map, then its own English default. */
z.config({
  customError: (issue) => translateIssue(issue as $ZodIssue),
})

/* Validation pipe for nestjs-zod DTOs. A DTO is a zod schema wrapped in
   createZodDto:

     const CreateUserSchema = z.object({ email: z.email() })
     export class CreateUserDto extends createZodDto(CreateUserSchema) {}

   and a handler takes it as `@Body() body: CreateUserDto`, which the pipe
   parses and narrows.

   strictSchemaDeclaration is left off: with it on, the pipe throws for any
   parameter not typed with a zod DTO, which includes an ordinary
   `@Param("id") id: string`. Turn it on once every route's inputs have DTOs
   and you want unvalidated input to be a hard error. */
export const CustomValidationPipe = createZodValidationPipe({
  createValidationException: (error) => {
    const issues = (error as { issues?: $ZodIssue[] })?.issues ?? []
    const formattedErrors = formatIssues(issues)
    const fallback =
      I18nContext.current()?.t("message.common.unprocessable_entity") ??
      "Unprocessable Entity"
    const firstMessage = Object.values(formattedErrors)[0]?.[0] || fallback

    /* The shape ResponseHandler expects for a 422: the envelope fields plus a
       per-field `error` map. */
    return new UnprocessableEntityException({
      statusCode: 422,
      message: firstMessage,
      data: null,
      error: formattedErrors,
    })
  },
})

/* Flattens zod issues into a { field: [messages] } map, joining nested paths
   with a dot so `address.street` reads the way the request body looks. An
   issue with an empty path (a refinement on the object itself) is filed under
   "_". */
function formatIssues(issues: $ZodIssue[]): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {}

  for (const issue of issues) {
    const field = issue.path.length > 0 ? issue.path.join(".") : "_"
    const messages = formattedErrors[field] ?? []
    messages.push(issue.message)
    formattedErrors[field] = messages
  }

  return formattedErrors
}

/* Resolves an issue against the `validation` catalog in the active request
   language. Returns undefined when there is no request context or the catalog
   has no entry, which lets zod fall back to its own English message rather
   than surfacing a raw key to the caller. */
function translateIssue(issue: $ZodIssue): string | undefined {
  const i18n = I18nContext.current()
  if (!i18n) return undefined

  const key = `validation.${issueKey(issue)}`
  const message = i18n.t(key, { args: issueArgs(issue) })

  return typeof message === "string" && message !== key ? message : undefined
}

/* Maps a zod issue to a catalog key. A missing value arrives as an
   invalid_type issue whose input is undefined, which deserves "is required"
   rather than "must be a string"; invalid_format carries the specific format
   (email, url, uuid) and falls back to a generic entry for the rest. */
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
  const property = issue.path.length > 0 ? String(issue.path.at(-1)) : "value"

  return { ...issue, property, path: issue.path.join(".") }
}
