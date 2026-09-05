export class SeedError extends Error {
  override name = "SeedError"
}

export function fail(message: string): never {
  throw new SeedError(message)
}

export function locate(where: string, message: string): never {
  throw new SeedError(`${where} — ${message}`)
}
