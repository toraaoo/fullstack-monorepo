import { drizzleTables } from "#src/adapter/drizzle"
import { createBuilder } from "#src/authoring/builder"
import { schema } from "../setup/schema"

export const { defineFixture, ref } = createBuilder(drizzleTables(schema))
