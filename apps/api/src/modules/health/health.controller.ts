import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus"
import { RawResponse } from "@shared"
import { DatabaseHealth } from "./database.health"

@Controller({ path: "health", version: VERSION_NEUTRAL })
@ApiTags("Health")
@RawResponse()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private database: DatabaseHealth
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.database.isHealthy("database"),
      () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024),
    ])
  }

  @Get("live")
  liveness() {
    return { status: "ok" }
  }
}
