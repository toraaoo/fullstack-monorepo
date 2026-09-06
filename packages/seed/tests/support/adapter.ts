import type {
  DatabaseMetadata,
  SeedAdapter,
  SeedExecutor,
} from "#src/adapter/index"
import { defineAdapter } from "#src/adapter/index"
import { postgresDialect } from "#src/dialect/postgres"
import { RecordingExecutor, type Responder } from "./executor"

export interface MemoryAdapter extends SeedAdapter {
  readonly executor: RecordingExecutor
  readonly closed: () => number
}

export interface MemoryAdapterOptions {
  metadata: DatabaseMetadata
  respond?: Responder
  onTransaction?: (executor: SeedExecutor) => void
}

export function memoryAdapter(options: MemoryAdapterOptions): MemoryAdapter {
  const executor = new RecordingExecutor(options.respond)

  let closes = 0

  const adapter = defineAdapter({
    dialect: postgresDialect,

    async metadata(): Promise<DatabaseMetadata> {
      return options.metadata
    },

    async transaction<T>(run: (tx: SeedExecutor) => Promise<T>): Promise<T> {
      options.onTransaction?.(executor)

      return run(executor)
    },

    async close(): Promise<void> {
      closes += 1
    },
  })

  return Object.assign(adapter, { executor, closed: () => closes })
}
