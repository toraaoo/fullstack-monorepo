import type { AdapterRow, SeedExecutor } from "#src/adapter/index"
import type { Query, RenderedQuery } from "#src/dialect/index"
import { postgresDialect } from "#src/dialect/postgres"

export interface RecordedQuery extends RenderedQuery {
  query: Query
}

export type Responder = (
  recorded: RecordedQuery,
  index: number
) => AdapterRow[] | undefined

export class RecordingExecutor implements SeedExecutor {
  readonly queries: RecordedQuery[] = []

  constructor(private readonly responder: Responder = () => []) {}

  async run(query: Query): Promise<AdapterRow[]> {
    const recorded = { query, ...query.render(postgresDialect) }

    this.queries.push(recorded)

    return this.responder(recorded, this.queries.length - 1) ?? []
  }

  get statements(): string[] {
    return this.queries.map((recorded) => recorded.text)
  }

  matching(pattern: RegExp): RecordedQuery[] {
    return this.queries.filter((recorded) => pattern.test(recorded.text))
  }
}
