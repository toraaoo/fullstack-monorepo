import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { PinoLogger } from "nestjs-pino"
import postgres, { type Sql } from "postgres"
import { getEnv } from "../config"
import * as schema from "./database.schema"

export const DRIZZLE = Symbol("DRIZZLE")

export type DrizzleDatabase = PostgresJsDatabase<typeof schema> & {
  $client: Sql
}

export type DatabaseExecutor =
  | DrizzleDatabase
  | Parameters<Parameters<DrizzleDatabase["transaction"]>[0]>[0]

@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [PinoLogger],
      useFactory: (logger: PinoLogger): DrizzleDatabase => {
        const env = getEnv()

        const client = postgres(env.DATABASE_URL, {
          max: env.DATABASE_POOL_MAX,
          ssl: env.DATABASE_SSL,
          prepare: env.DATABASE_PREPARE,
        })

        return drizzle(client, {
          schema,
          casing: "snake_case",
          logger: {
            logQuery: (query, params) =>
              logger.debug({ query, params }, "drizzle query"),
          },
        })
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.$client.end({ timeout: 5 })
  }
}
