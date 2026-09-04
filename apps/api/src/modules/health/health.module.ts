import { DatabaseModule } from "@core/database"
import { Module } from "@nestjs/common"
import { TerminusModule } from "@nestjs/terminus"
import { DatabaseHealth } from "./database.health"
import { HealthController } from "./health.controller"

@Module({
  imports: [TerminusModule, DatabaseModule],
  controllers: [HealthController],
  providers: [DatabaseHealth],
})
export class HealthModule {}
