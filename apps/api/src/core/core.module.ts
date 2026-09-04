import { Module } from "@nestjs/common"
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core"
import { AllExceptionsFilter } from "@shared/filters/all-exceptions.filter"
import { ResponseInterceptor } from "@shared/interceptors/response.interceptor"
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
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
  ],
  exports: [DatabaseModule],
})
export class CoreModule {}
