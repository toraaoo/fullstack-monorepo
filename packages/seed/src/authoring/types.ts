export const DESCRIPTOR = Symbol.for("workspace.seed.descriptor")

export interface RefBody {
  kind: "ref"
  table: string
  key: string[]
  column?: string
}

export interface NowBody {
  kind: "now"
  offset?: string
}

export interface UuidBody {
  kind: "uuid"
  key?: string
}

export interface RandomBody {
  kind: "random"
  length: number
}

export interface HashBody {
  kind: "hash"
  plaintext: string
}

export interface EnvBody {
  kind: "env"
  name: string
  fallback?: string
}

export interface SqlBody {
  kind: "sql"
  expression: string
}

export interface FileBody {
  kind: "file"
  path: string
  encoding?: BufferEncoding
}

export interface OnceBody {
  kind: "once"
  value: unknown
}

export type DescriptorBody =
  | RefBody
  | NowBody
  | UuidBody
  | RandomBody
  | HashBody
  | EnvBody
  | SqlBody
  | FileBody
  | OnceBody

export type Descriptor = DescriptorBody & { readonly [DESCRIPTOR]: true }

export function descriptor<T extends DescriptorBody>(body: T): Descriptor {
  return { ...body, [DESCRIPTOR]: true } as Descriptor
}

export function isDescriptor(value: unknown): value is Descriptor {
  return typeof value === "object" && value !== null && DESCRIPTOR in value
}

const DETERMINISTIC: Record<Descriptor["kind"], boolean> = {
  ref: true,
  env: true,
  sql: true,
  file: true,
  now: false,
  uuid: false,
  random: false,
  hash: false,
  once: false,
}

export function isDeterministic(value: Descriptor): boolean {
  if (value.kind === "uuid") return value.key !== undefined

  return DETERMINISTIC[value.kind]
}

export type FixtureRow<T> = { [K in keyof T]?: T[K] | Descriptor }

export interface FixtureSpec<T> {
  description?: string
  key?: (keyof T & string) | (keyof T & string)[]
  update?: (keyof T & string)[]
  rows: FixtureRow<T>[]
}

export interface Fixture {
  table: string
  description?: string
  key?: string[]
  update?: string[]
  rows: Record<string, unknown>[]
}

export interface LoadedFixture extends Fixture {
  tier: string
  file: string
  directory: string
}

export function fixtureLabel(fixture: LoadedFixture): string {
  return `${fixture.tier}/${fixture.file}`
}
