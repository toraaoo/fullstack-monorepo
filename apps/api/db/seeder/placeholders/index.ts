import { fail } from "../errors"
import type { Placeholder, PlaceholderContext, ResolvedValue } from "../types"
import { date, now } from "./dates"
import { env } from "./env"
import { int, pick, random, uuid } from "./ids"
import { ref } from "./refs"
import { hash } from "./secrets"

const PATTERN = /\{\{\s*([a-zA-Z]+)(?::([^}]*))?\s*\}\}/g

const placeholders: Record<string, Placeholder> = {
  now,
  date,
  uuid,
  random,
  int,
  pick,
  env,
  hash,
  ref,
}

export const placeholderNames = Object.keys(placeholders)

export { scryptHash } from "./secrets"

function render(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

async function resolveString(
  value: string,
  context: PlaceholderContext
): Promise<ResolvedValue> {
  const matches = [...value.matchAll(PATTERN)]

  if (matches.length === 0) return { value, deterministic: true }

  const resolved: ResolvedValue[] = []

  for (const [, name, argument] of matches) {
    const placeholder = placeholders[name.toLowerCase()]

    if (!placeholder) {
      fail(
        `unknown placeholder "${name}" — known: ${placeholderNames.join(", ")}`
      )
    }

    resolved.push(await placeholder(argument, context))
  }

  const deterministic = resolved.every((entry) => entry.deterministic)

  if (matches.length === 1 && matches[0][0] === value) {
    return { value: resolved[0].value, deterministic }
  }

  let index = 0

  return {
    value: value.replace(PATTERN, () => render(resolved[index++].value)),
    deterministic,
  }
}

async function resolveArray(
  value: unknown[],
  context: PlaceholderContext
): Promise<ResolvedValue> {
  const entries = await Promise.all(
    value.map((entry) => resolveValue(entry, context))
  )

  return {
    value: entries.map((entry) => entry.value),
    deterministic: entries.every((entry) => entry.deterministic),
  }
}

async function resolveObject(
  value: Record<string, unknown>,
  context: PlaceholderContext
): Promise<ResolvedValue> {
  const entries = await Promise.all(
    Object.entries(value).map(
      async ([key, entry]) => [key, await resolveValue(entry, context)] as const
    )
  )

  return {
    value: Object.fromEntries(
      entries.map(([key, entry]) => [key, entry.value])
    ),
    deterministic: entries.every(([, entry]) => entry.deterministic),
  }
}

export async function resolveValue(
  value: unknown,
  context: PlaceholderContext
): Promise<ResolvedValue> {
  if (typeof value === "string") return resolveString(value, context)

  if (Array.isArray(value)) return resolveArray(value, context)

  if (value !== null && typeof value === "object") {
    return resolveObject(value as Record<string, unknown>, context)
  }

  return { value, deterministic: true }
}
