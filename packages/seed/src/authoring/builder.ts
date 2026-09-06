import {
  type Descriptor,
  descriptor,
  type Fixture,
  type FixtureSpec,
} from "#src/authoring/types"

export type TableTypeMap = Record<string, Record<string, unknown>>

export interface Builder<M extends TableTypeMap> {
  defineFixture<K extends keyof M & string>(
    table: K,
    spec: FixtureSpec<M[K]>
  ): Fixture
  ref<K extends keyof M & string>(
    table: K,
    key: string | string[],
    column?: keyof M[K] & string
  ): Descriptor
}

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value]
}

export function createBuilder<M extends TableTypeMap = TableTypeMap>(
  _tables?: M
): Builder<M> {
  return {
    defineFixture(table, spec) {
      return {
        table,
        description: spec.description,
        key: spec.key === undefined ? undefined : toArray(spec.key),
        update: spec.update,
        rows: spec.rows as Record<string, unknown>[],
      }
    },
    ref(table, key, column) {
      return descriptor({
        kind: "ref",
        table,
        key: toArray(key),
        column: column as string | undefined,
      })
    },
  }
}
