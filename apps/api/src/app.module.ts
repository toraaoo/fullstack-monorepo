import { CoreModule } from "@core"
import { HealthModule } from "@modules/health/health.module"
import { Module } from "@nestjs/common"
import { AppController } from "./app.controller"

@Module({
  imports: [CoreModule, HealthModule],
  controllers: [AppController],
})
export class AppModule {}
