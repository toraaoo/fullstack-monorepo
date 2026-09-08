import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from "@nestjs/common"
import { ApiVersionMiddleware } from "./api-version.middleware"

@Module({})
export class VersioningModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ApiVersionMiddleware)
      .forRoutes({ path: "/{*path}", method: RequestMethod.ALL })
  }
}
