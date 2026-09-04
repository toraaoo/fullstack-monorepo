import { Module } from "@nestjs/common"
import { DatabaseModule } from "./database/database.module"
import { I18nModule } from "./i18n/i18n.module"
import { LoggerModule } from "./logger/logger.module"
import { RequestContextModule } from "./request-context/request-context.module"
import { ThrottlerModule } from "./throttler/throttler.module"

@Module({
  imports: [
    RequestContextModule,
    LoggerModule,
    DatabaseModule,
    I18nModule,
    ThrottlerModule,
  ],
  exports: [DatabaseModule],
})
export class CoreModule {}
