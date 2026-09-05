import { randomBytes, scryptSync } from "node:crypto"
import { fail } from "../errors"
import type { ResolvedValue } from "../types"

const COST = 16384
const BLOCK_SIZE = 8
const PARALLELISM = 1
const KEY_LENGTH = 64
const MAX_MEMORY = 64 * 1024 * 1024

export function scryptHash(plaintext: string): string {
  const salt = randomBytes(16)

  const derived = scryptSync(plaintext, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEMORY,
  })

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$")
}

export function hash(argument: string | undefined): ResolvedValue {
  if (!argument) fail("hash needs a plaintext, e.g. {{hash:changeme}}")

  return { value: scryptHash(argument), deterministic: false }
}
