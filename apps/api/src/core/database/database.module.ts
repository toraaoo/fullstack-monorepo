import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common"
import { PinoLogger } from "nestjs-pino"
import { getEnv } from "../config"
import { createDatabaseClient, type DrizzleDatabase } from "./client"

export const DRIZZLE = Symbol("DRIZZLE")

@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [PinoLogger],
      useFactory: (logger: PinoLogger): DrizzleDatabase => {
        const env = getEnv()

        return createDatabaseClient({
          url: env.DATABASE_URL,
          max: env.DATABASE_POOL_MAX,
          ssl: env.DATABASE_SSL,
          prepare: env.DATABASE_PREPARE,
          onQuery: (query, params) =>
            logger.debug({ query, params }, "drizzle query"),
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
