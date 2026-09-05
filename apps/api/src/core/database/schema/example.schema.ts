import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { primaryId, timestamps } from "./columns"

export const exampleCategories = pgTable("example_categories", {
  id: primaryId(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  position: integer().notNull().default(0),
  ...timestamps,
})

export const exampleItems = pgTable(
  "example_items",
  {
    id: primaryId(),
    categoryId: uuid()
      .notNull()
      .references(() => exampleCategories.id, { onDelete: "cascade" }),
    reference: text().notNull().unique(),
    title: text().notNull(),
    ownerEmail: text().notNull(),
    secret: text(),
    token: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    publishedAt: timestamp({ withTimezone: true }),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (table) => [index("example_items_category_id_idx").on(table.categoryId)]
)

export const exampleCategoriesRelations = relations(
  exampleCategories,
  ({ many }) => ({
    items: many(exampleItems),
  })
)

export const exampleItemsRelations = relations(exampleItems, ({ one }) => ({
  category: one(exampleCategories, {
    fields: [exampleItems.categoryId],
    references: [exampleCategories.id],
  }),
}))

export type ExampleCategory = typeof exampleCategories.$inferSelect
export type NewExampleCategory = typeof exampleCategories.$inferInsert
export type ExampleItem = typeof exampleItems.$inferSelect
export type NewExampleItem = typeof exampleItems.$inferInsert
