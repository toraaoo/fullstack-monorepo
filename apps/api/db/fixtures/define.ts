import * as schema from "@core/database/schema"
import { createBuilder } from "@workspace/seed"
import { drizzleTables } from "@workspace/seed/drizzle"

export const { defineFixture, ref } = createBuilder(drizzleTables(schema))
