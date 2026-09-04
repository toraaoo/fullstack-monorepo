import "dotenv/config"
import { CorsConfig, getEnv, HelmetConfig, swaggerConfig } from "@core/config"
import fastifyHelmet from "@fastify/helmet"
import { NestFactory } from "@nestjs/core"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { SwaggerModule } from "@nestjs/swagger"
import { apiReference } from "@scalar/nestjs-api-reference"
import { CustomValidationPipe } from "@shared"
import { cleanupOpenApiDoc } from "nestjs-zod"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  )

  app.useGlobalPipes(new CustomValidationPipe())

  if (getEnv().API_DOCS_ENABLED) {
    /* cleanupOpenApiDoc post-processes the schemas nestjs-zod generates from
       the DTOs -- resolving referenced schemas, naming them by their zod `id`,
       and emitting nullability the way the document's OpenAPI version wants. */
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(app, swaggerConfig, {
        deepScanRoutes: true,
      })
    )

    app.use(
      "/docs",
      apiReference({
        content: document,
        withFastify: true,
        theme: "bluePlanet",
      })
    )
  }

  app.enableCors(CorsConfig)
  await app.register(fastifyHelmet, HelmetConfig)

  /* "0.0.0.0" rather than the Fastify default of localhost: the default binds
     only the loopback interface, which is unreachable from another container
     or from the host when this runs in one. */
  await app.listen(getEnv().APP_PORT, "0.0.0.0")
}

bootstrap()
  .then(() => {
    console.log(`Application is running on: ${getEnv().APP_URL}`)
  })
  .catch((err) => {
    console.error("Error during app bootstrap:", err)
    process.exit(1)
  })
