import type { Fixture, LoadedFixture } from "#src/authoring/types"

export interface FixtureInput extends Partial<Fixture> {
  table: string
  rows: Record<string, unknown>[]
}

export function loaded(
  input: FixtureInput,
  where: { tier?: string; file?: string; directory?: string } = {}
): LoadedFixture {
  const tier = where.tier ?? "base"

  return {
    table: input.table,
    description: input.description,
    key: input.key,
    update: input.update,
    rows: input.rows,
    tier,
    file: where.file ?? `${input.table}.ts`,
    directory: where.directory ?? `/fixtures/${tier}`,
  }
}
