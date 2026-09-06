import { createHash, randomBytes, scryptSync } from "node:crypto"
import { readFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { type Descriptor, isDescriptor } from "#src/authoring/types"
import { raw, type SeedRow } from "#src/dialect/index"
import { fail } from "#src/errors"

const UUID_NAMESPACE = "0f9c4a2e-8a5d-4b53-9a6f-2f9b1c7d4e10"

const OFFSET_PATTERN = /^([+-]?\d+)\s*(ms|s|m|h|d|w|M|y)$/

const MILLISECONDS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

const SCRYPT = {
  N: 16_384,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
}

export type RandomSource = (bytes: number) => Buffer

export function createRandomSource(seed?: number): RandomSource {
  if (seed === undefined) return randomBytes

  let state = seed >>> 0

  return (bytes: number) => {
    const buffer = Buffer.alloc(bytes)

    for (let index = 0; index < bytes; index += 1) {
      state = (state + 0x6d2b79f5) >>> 0

      let value = Math.imul(state ^ (state >>> 15), 1 | state)

      value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
      buffer[index] = ((value ^ (value >>> 14)) >>> 0) & 0xff
    }

    return buffer
  }
}

function shift(base: Date, offset: string): Date {
  const match = OFFSET_PATTERN.exec(offset.trim())

  if (!match)
    fail(`now("${offset}") — expected an offset such as -30d, +2h, +1M`)

  const amount = Number.parseInt(match[1] as string, 10)
  const unit = match[2] as string

  const scale = MILLISECONDS[unit]

  if (scale !== undefined) return new Date(base.getTime() + amount * scale)

  const shifted = new Date(base.getTime())

  if (unit === "M") shifted.setUTCMonth(shifted.getUTCMonth() + amount)
  else shifted.setUTCFullYear(shifted.getUTCFullYear() + amount)

  return shifted
}

function uuidFrom(bytes: Buffer, version: number): string {
  const digest = Buffer.from(bytes.subarray(0, 16))

  digest[6] = ((digest[6] as number) & 0x0f) | (version << 4)
  digest[8] = ((digest[8] as number) & 0x3f) | 0x80

  const hex = digest.toString("hex")

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-")
}

export interface RefRequest {
  table: string
  key: string[]
  column?: string
  from?: { table: string; column: string }
}

export interface ResolveContext {
  now: Date
  directory: string
  random: RandomSource
  from?: { table: string; column: string }
  lookupRef(request: RefRequest): Promise<unknown>
}

async function resolveDescriptor(
  value: Descriptor,
  context: ResolveContext
): Promise<unknown> {
  switch (value.kind) {
    case "ref":
      return context.lookupRef({
        table: value.table,
        key: value.key,
        column: value.column,
        from: context.from,
      })

    case "now":
      return value.offset ? shift(context.now, value.offset) : context.now

    case "uuid":
      return value.key === undefined
        ? uuidFrom(context.random(16), 4)
        : uuidFrom(
            createHash("sha1")
              .update(UUID_NAMESPACE)
              .update(value.key)
              .digest(),
            5
          )

    case "random":
      return context
        .random(Math.ceil(value.length / 2))
        .toString("hex")
        .slice(0, value.length)

    case "hash": {
      const salt = context.random(16)

      const derived = scryptSync(value.plaintext, salt, SCRYPT.keyLength, {
        N: SCRYPT.N,
        r: SCRYPT.r,
        p: SCRYPT.p,
        maxmem: SCRYPT.maxmem,
      })

      return [
        "scrypt",
        SCRYPT.N,
        SCRYPT.r,
        SCRYPT.p,
        salt.toString("base64"),
        derived.toString("base64"),
      ].join("$")
    }

    case "env": {
      const found = process.env[value.name] ?? value.fallback

      if (found === undefined) {
        fail(`env("${value.name}") is unset and has no fallback`)
      }

      return found
    }

    case "sql":
      return raw(value.expression)

    case "file": {
      const path = isAbsolute(value.path)
        ? value.path
        : join(context.directory, value.path)

      const contents = await readFile(path)

      return value.encoding ? contents.toString(value.encoding) : contents
    }

    case "once":
      return resolveValue(value.value, context)
  }
}

export async function resolveValue(
  value: unknown,
  context: ResolveContext
): Promise<unknown> {
  if (isDescriptor(value)) return resolveDescriptor(value, context)

  if (Array.isArray(value)) {
    return Promise.all(value.map((entry) => resolveValue(entry, context)))
  }

  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    if (Buffer.isBuffer(value)) return value

    const entries = await Promise.all(
      Object.entries(value).map(
        async ([key, entry]) =>
          [key, await resolveValue(entry, context)] as const
      )
    )

    return Object.fromEntries(entries)
  }

  return value
}

export async function resolveRow(
  row: SeedRow,
  columns: readonly string[],
  table: string,
  context: ResolveContext
): Promise<SeedRow> {
  const resolved: SeedRow = {}

  for (const column of columns) {
    if (!(column in row)) continue

    resolved[column] = await resolveValue(row[column], {
      ...context,
      from: { table, column },
    })
  }

  return resolved
}
