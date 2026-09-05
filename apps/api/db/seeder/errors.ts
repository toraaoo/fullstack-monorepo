export class SeedError extends Error {}

export class SeedDirectiveError extends SeedError {}

export function fail(message: string): never {
  throw new SeedDirectiveError(message)
}
