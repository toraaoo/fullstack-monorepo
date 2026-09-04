import { Controller, Get } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from "@nestjs/terminus"

@Controller("health")
@ApiTags("Health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator
  ) {}

  /* Readiness: every dependency the app needs to serve traffic. A database
     probe belongs here once src/core/database is wired --
     HealthIndicatorService.attempt() builds a typed result and marks the
     indicator down when the probe throws, instead of failing the whole check. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024),
    ])
  }

  /* Liveness: is the process up at all. Deliberately probes nothing, so a
     degraded dependency never gets the container restarted. */
  @Get("live")
  liveness() {
    return { status: "ok" }
  }
}
