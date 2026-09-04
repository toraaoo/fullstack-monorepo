import { Module } from "@nestjs/common"
import { DatabaseModule } from "./database/database.module"
import { I18nModule } from "./i18n/i18n.module"
import { ThrottlerModule } from "./throttler/throttler.module"

/* Everything the app needs exactly once, wired in one place: the database
   connection, request-language resolution, and rate limiting. AppModule
   imports this and nothing else from core.

   A feature module never imports CoreModule -- it imports the specific module
   it depends on (DatabaseModule for the connection) so its dependencies stay
   readable from its own file. */
@Module({
  imports: [DatabaseModule, I18nModule, ThrottlerModule],
  exports: [DatabaseModule],
})
export class CoreModule {}
