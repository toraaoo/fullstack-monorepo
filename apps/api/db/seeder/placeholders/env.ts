import { fail } from "../errors"
import type { ResolvedValue } from "../types"

export function env(argument: string | undefined): ResolvedValue {
  if (!argument) {
    fail("env needs a variable name, e.g. {{env:SEED_OWNER_EMAIL}}")
  }

  const separator = argument.indexOf(":")
  const name = (
    separator === -1 ? argument : argument.slice(0, separator)
  ).trim()
  const fallback = separator === -1 ? undefined : argument.slice(separator + 1)

  const value = process.env[name] ?? fallback

  if (value === undefined) fail(`env ${name} is unset and has no default`)

  return { value, deterministic: true }
}
