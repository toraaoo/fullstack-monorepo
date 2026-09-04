export const MESSAGE_KEY_PREFIX = "validation:"

export type MessageKey<K extends string = string> =
  `${typeof MESSAGE_KEY_PREFIX}${K}`

export function key<const K extends string>(name: K): MessageKey<K> {
  return `${MESSAGE_KEY_PREFIX}${name}`
}

export function isMessageKey(value: unknown): value is MessageKey {
  return typeof value === "string" && value.startsWith(MESSAGE_KEY_PREFIX)
}

export function unwrapMessageKey(value: string): string | undefined {
  return isMessageKey(value)
    ? value.slice(MESSAGE_KEY_PREFIX.length)
    : undefined
}
