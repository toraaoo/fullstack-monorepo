import { DocumentBuilder } from "@nestjs/swagger"
import { getEnv } from "./env"

export const swaggerConfig = new DocumentBuilder()
  .setTitle(getEnv().APP_NAME)
  .setDescription(`The API docs for ${getEnv().APP_NAME}`)
  .setVersion(getEnv().APP_VERSION)
  .build()
