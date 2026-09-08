import "dotenv/config"
import { CorsConfig, getEnv, HelmetConfig, swaggerConfig } from "@core/config"
import { versioningConfig } from "@core/versioning"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SwaggerModule } from "@nestjs/swagger"
import { apiReference } from "@scalar/nestjs-api-reference"
import { CustomValidationPipe } from "@shared"
import helmet from "helmet"
import { Logger } from "nestjs-pino"
import { cleanupOpenApiDoc } from "nestjs-zod"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  })

  app.useLogger(app.get(Logger))

  app.enableVersioning(versioningConfig)

  app.useGlobalPipes(new CustomValidationPipe())

  if (getEnv().API_DOCS_ENABLED) {
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(app, swaggerConfig, {
        deepScanRoutes: true,
      })
    )

    app.use(
      "/docs",
      apiReference({
        content: document,
        theme: "bluePlanet",
      })
    )
  }

  app.enableShutdownHooks()

  app.enableCors(CorsConfig)
  app.use(helmet(HelmetConfig))

  await app.listen(getEnv().APP_PORT, "0.0.0.0")

  app.get(Logger).log(`Application is running on: ${getEnv().APP_URL}`)
}

bootstrap().catch((err) => {
  console.error("Error during app bootstrap:", err)
  process.exit(1)
})
