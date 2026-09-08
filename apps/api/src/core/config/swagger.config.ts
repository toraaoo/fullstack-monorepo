import { DocumentBuilder } from "@nestjs/swagger"
import {
  API_VERSIONS,
  acceptForVersion,
  LATEST_API_VERSION,
} from "../versioning/versioning.constants"
import { getEnv } from "./env"

export const swaggerConfig = new DocumentBuilder()
  .setTitle(getEnv().APP_NAME)
  .setDescription(`The API docs for ${getEnv().APP_NAME}`)
  .setVersion(getEnv().APP_VERSION)
  .addGlobalParameters({
    name: "Accept",
    in: "header",
    required: false,
    description: `Selects the API version. Omit it to get the latest (${LATEST_API_VERSION}).`,
    schema: {
      type: "string",
      default: acceptForVersion(LATEST_API_VERSION),
      enum: API_VERSIONS.map(acceptForVersion),
    },
  })
  .build()
