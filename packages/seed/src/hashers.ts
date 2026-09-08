import { scryptSync } from "node:crypto"
import { fail } from "#src/errors"

export type HashRandomSource = (bytes: number) => Buffer

export type Hasher = (plaintext: string, random: HashRandomSource) => string

export type HasherRegistry = Readonly<Record<string, Hasher>>

export const DEFAULT_HASHER = "scrypt"

const SCRYPT = {
  N: 16_384,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
}

const BETTER_AUTH = {
  N: 16_384,
  r: 16,
  p: 1,
  keyLength: 64,
}

function scryptHasher(plaintext: string, random: HashRandomSource): string {
  const salt = random(16)

  const derived = scryptSync(plaintext, salt, SCRYPT.keyLength, {
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

function betterAuthHasher(plaintext: string, random: HashRandomSource): string {
  const salt = random(16).toString("hex")

  const derived = scryptSync(
    plaintext.normalize("NFKC"),
    salt,
    BETTER_AUTH.keyLength,
    {
      N: BETTER_AUTH.N,
      r: BETTER_AUTH.r,
      p: BETTER_AUTH.p,
      maxmem: 128 * BETTER_AUTH.N * BETTER_AUTH.r * 2,
    }
  )

  return `${salt}:${derived.toString("hex")}`
}

export const builtinHashers: HasherRegistry = {
  [DEFAULT_HASHER]: scryptHasher,
  "better-auth": betterAuthHasher,
}

export function resolveHashers(
  custom?: Record<string, Hasher>
): HasherRegistry {
  if (!custom) return builtinHashers

  for (const [name, hasher] of Object.entries(custom)) {
    if (!name) fail("hashers has an entry with an empty name")

    if (typeof hasher !== "function") {
      fail(`hashers["${name}"] is not a function`)
    }
  }

  return { ...builtinHashers, ...custom }
}

export function selectHasher(
  format: string,
  hashers: HasherRegistry = builtinHashers
): Hasher {
  const hasher = hashers[format]

  if (!hasher) {
    fail(
      `hash(..., "${format}") — unknown format. Available: ${Object.keys(hashers).sort().join(", ")}. Register your own with the hashers option in seed.config.ts`
    )
  }

  return hasher
}
