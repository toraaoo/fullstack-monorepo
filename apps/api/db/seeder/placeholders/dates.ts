import { fail } from "../errors"
import type { PlaceholderContext, ResolvedValue } from "../types"

const OFFSET = /^([+-]?\d+)\s*(ms|s|m|h|d|w|M|y)$/

const MILLISECONDS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

function shift(base: Date, offset: string): Date {
  const match = OFFSET.exec(offset.trim())

  if (!match) {
    fail(`invalid offset "${offset}" — expected e.g. -30d, +2h, +1M`)
  }

  const [, amount, unit] = match
  const count = Number.parseInt(amount, 10)

  if (unit !== "M" && unit !== "y") {
    return new Date(base.getTime() + count * MILLISECONDS[unit])
  }

  const shifted = new Date(base.getTime())

  if (unit === "M") shifted.setUTCMonth(shifted.getUTCMonth() + count)
  else shifted.setUTCFullYear(shifted.getUTCFullYear() + count)

  return shifted
}

export function now(
  argument: string | undefined,
  context: PlaceholderContext
): ResolvedValue {
  return {
    value: argument ? shift(context.now, argument) : context.now,
    deterministic: false,
  }
}

export function date(argument: string | undefined): ResolvedValue {
  const parsed = new Date((argument ?? "").trim())

  if (!argument || Number.isNaN(parsed.getTime())) {
    fail(`invalid date "${argument}" — expected e.g. {{date:2024-01-15}}`)
  }

  return { value: parsed, deterministic: true }
}
