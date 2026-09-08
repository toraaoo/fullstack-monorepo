import { type Descriptor, descriptor } from "#src/authoring/types"
import { fail } from "#src/errors"
import { DEFAULT_HASHER } from "#src/hashers"

const MAX_RANDOM_LENGTH = 512

export function now(offset?: string): Descriptor {
  return descriptor({ kind: "now", offset })
}

export function uuid(key?: string): Descriptor {
  return descriptor({ kind: "uuid", key })
}

export function random(length = 32): Descriptor {
  if (!Number.isInteger(length) || length < 1 || length > MAX_RANDOM_LENGTH) {
    fail(
      `random(${length}) — length must be an integer 1..${MAX_RANDOM_LENGTH}`
    )
  }

  return descriptor({ kind: "random", length })
}

export function hash(
  plaintext: string,
  format: string = DEFAULT_HASHER
): Descriptor {
  if (!plaintext) fail("hash() needs a plaintext")
  if (!format) fail("hash() needs a format name")

  return descriptor({ kind: "hash", plaintext, format })
}

export function env(name: string, fallback?: string): Descriptor {
  if (!name) fail("env() needs a variable name")

  return descriptor({ kind: "env", name, fallback })
}

export function sql(expression: string): Descriptor {
  if (!expression) fail("sql() needs an expression")

  return descriptor({ kind: "sql", expression })
}

export function file(path: string, encoding?: BufferEncoding): Descriptor {
  if (!path) fail("file() needs a path")

  return descriptor({ kind: "file", path, encoding })
}

export function once(value: unknown): Descriptor {
  return descriptor({ kind: "once", value })
}
