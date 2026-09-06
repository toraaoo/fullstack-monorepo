import {
  type AnyPgColumn,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}

export const categories = pgTable("categories", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  position: integer().notNull().default(0),
  ...timestamps,
})

export const items = pgTable("items", {
  id: uuid().primaryKey().defaultRandom(),
  categoryId: uuid()
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  reference: text().notNull().unique(),
  title: text().notNull(),
  ownerEmail: text().notNull(),
  secret: text(),
  token: text(),
  metadata: jsonb().$type<Record<string, unknown>>(),
  publishedAt: timestamp({ withTimezone: true }),
  active: boolean().notNull().default(true),
  ...timestamps,
})

export const nodes = pgTable("nodes", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  parentId: uuid().references((): AnyPgColumn => nodes.id),
  ...timestamps,
})

export const teams = pgTable("teams", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  ownerId: uuid().references((): AnyPgColumn => members.id),
  ...timestamps,
})

export const members = pgTable(
  "members",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamSlug: text()
      .notNull()
      .references(() => teams.slug),
    email: text().notNull(),
    role: text().notNull().default("member"),
    ...timestamps,
  },
  (table) => [unique().on(table.teamSlug, table.email)]
)

export const schema = { categories, items, nodes, teams, members }

export const DDL = `
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  secret TEXT,
  token TEXT,
  metadata JSONB,
  published_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES nodes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_slug TEXT NOT NULL REFERENCES teams(slug),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_slug, email)
);

ALTER TABLE teams
  ADD CONSTRAINT teams_owner_id_members_id_fk
  FOREIGN KEY (owner_id) REFERENCES members(id);
`
