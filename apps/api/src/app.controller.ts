import { getEnv } from "@core/config"
import { API_VERSIONS, LATEST_API_VERSION } from "@core/versioning"
import { Controller, Get } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { ApiSuccessResponse, DateUtils, successResponse } from "@shared"
import { I18nService } from "nestjs-i18n"
import { z } from "zod"

const welcomeSchema = z.object({
  appName: z.string(),
  appVersion: z.string(),
  apiVersion: z.string(),
  apiVersions: z.array(z.string()),
  timestamp: z.string(),
})

@Controller()
@ApiTags("App")
export class AppController {
  constructor(private readonly i18n: I18nService) {}

  @Get()
  @ApiSuccessResponse(200, "Welcome message", welcomeSchema, {
    appName: "API",
    appVersion: "1.0.0",
    apiVersion: LATEST_API_VERSION,
    apiVersions: [...API_VERSIONS],
    timestamp: "2026-01-01T00:00:00.000Z",
  })
  getHello() {
    return successResponse(
      this.i18n.t("app.welcome", {
        args: { appName: getEnv().APP_NAME },
      }),
      {
        appName: getEnv().APP_NAME,
        appVersion: getEnv().APP_VERSION,
        apiVersion: LATEST_API_VERSION,
        apiVersions: [...API_VERSIONS],
        timestamp: DateUtils.now().toISOString(),
      }
    )
  }
}
