import { DRIZZLE, type DrizzleDatabase } from "@core/database"
import { Inject, Injectable } from "@nestjs/common"
import {
  type HealthIndicatorResult,
  HealthIndicatorService,
} from "@nestjs/terminus"
import { sql } from "drizzle-orm"

@Injectable()
export class DatabaseHealth {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly indicator: HealthIndicatorService
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    return this.indicator
      .check(key)
      .attempt(async () => {
        await this.db.execute(sql`select 1`)
      })
      .withTimeout(3000)
      .cacheFor(5000)
  }
}
