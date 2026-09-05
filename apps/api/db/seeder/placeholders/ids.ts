import { createHash, randomBytes, randomInt } from "node:crypto"
import { fail } from "../errors"
import type { ResolvedValue } from "../types"

const NAMESPACE = "0f9c4a2e-8a5d-4b53-9a6f-2f9b1c7d4e10"

const MAX_LENGTH = 512

const RANGE = /^(-?\d+)\.\.(-?\d+)$/

function fromKey(key: string): string {
  const digest = createHash("sha1").update(NAMESPACE).update(key).digest()

  digest[6] = (digest[6] & 0x0f) | 0x50
  digest[8] = (digest[8] & 0x3f) | 0x80

  const hex = digest.subarray(0, 16).toString("hex")

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-")
}

export function uuid(argument: string | undefined): ResolvedValue {
  if (!argument) return { value: crypto.randomUUID(), deterministic: false }

  return { value: fromKey(argument), deterministic: true }
}

export function random(argument: string | undefined): ResolvedValue {
  const length = argument ? Number.parseInt(argument, 10) : 32

  if (!Number.isInteger(length) || length < 1 || length > MAX_LENGTH) {
    fail(`random length must be between 1 and ${MAX_LENGTH}, got "${argument}"`)
  }

  const hex = randomBytes(Math.ceil(length / 2)).toString("hex")

  return { value: hex.slice(0, length), deterministic: false }
}

export function int(argument: string | undefined): ResolvedValue {
  const match = RANGE.exec((argument ?? "").trim())

  if (!match) {
    fail(`int needs a range, e.g. {{int:1..100}}, got "${argument}"`)
  }

  const min = Number.parseInt(match[1], 10)
  const max = Number.parseInt(match[2], 10)

  if (min > max) fail(`int range "${argument}" is inverted`)

  return { value: randomInt(min, max + 1), deterministic: false }
}

export function pick(argument: string | undefined): ResolvedValue {
  const options = (argument ?? "").split("|").filter(Boolean)

  if (options.length === 0) {
    fail("pick needs options, e.g. {{pick:alpha|beta|gamma}}")
  }

  return { value: options[randomInt(options.length)], deterministic: false }
}
