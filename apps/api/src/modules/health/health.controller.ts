import { Controller, Get } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus"
import { RawResponse } from "@shared"
import { DatabaseHealth } from "./database.health"

@Controller("health")
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
