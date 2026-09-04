import { getEnv } from "@core/config"
import { Controller, Get } from "@nestjs/common"
import { ApiOkResponse, ApiTags } from "@nestjs/swagger"
import { DateUtils, successResponse } from "@shared"
import { I18nService } from "nestjs-i18n"

@Controller()
@ApiTags("App")
export class AppController {
  constructor(private readonly i18n: I18nService) {}

  @Get()
  @ApiOkResponse({
    description: "Welcome message",
    schema: {
      example: {
        code: 200,
        success: true,
        message: "Welcome to API",
        data: {
          appName: "API",
          appVersion: "1.0.0",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      },
    },
  })
  getHello() {
    return successResponse(
      200,
      this.i18n.t("message.app.welcome", {
        args: { appName: getEnv().APP_NAME },
      }),
      {
        appName: getEnv().APP_NAME,
        appVersion: getEnv().APP_VERSION,
        timestamp: DateUtils.now().toISOString(),
      }
    )
  }
}
