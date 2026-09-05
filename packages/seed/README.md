# @workspace/seed

Database seeding from TypeScript fixtures. The engine knows nothing about your ORM —
it talks to an adapter, and adapters are a documented, implementable interface.

Two ship in the box: one reads your Drizzle schema, one introspects the live database
and therefore works with Kysely, TypeORM, raw `pg`, or no ORM at all.

- [Setup](#setup)
- [Writing a fixture](#writing-a-fixture)
- [Helpers](#helpers)
- [References](#references)
- [Natural keys](#natural-keys)
- [Ordering](#ordering)
- [Re-running](#re-running)
- [CLI](#cli)
- [Adapters](#adapters)
- [Dialects](#dialects)
- [Layout](#layout)
- [Notes](#notes)

---

## Setup

Two files. `seed.config.ts` at the root of the app that owns the database:

```ts
import { defineSeedConfig } from "@workspace/seed"
import { drizzleAdapter } from "@workspace/seed/drizzle"
import * as schema from "@core/database/schema"

export default defineSeedConfig({
  fixtures: "db/fixtures",
  protectedEnvironments: ["staging", "production"],
  adapter: drizzleAdapter({ db, schema, casing: "snake_case" }),
})
```

And one file that binds the fixture API to your schema — the only ORM-aware file in
the whole fixtures tree:

```ts
// db/fixtures/define.ts
import * as schema from "@core/database/schema"
import { createBuilder } from "@workspace/seed"
import { drizzleTables } from "@workspace/seed/drizzle"

export const { defineFixture, ref } = createBuilder(drizzleTables(schema))
```

`drizzleTables()` is erased at build time — it exists only to carry types. Fixtures
then refer to tables by name, and swapping ORM means changing this one file.

Fixtures live in tier directories:

```
db/fixtures/
  define.ts
  base/     applied in every environment
  local/    applied by `seed run local`
```

Every `.ts` file in a selected tier is imported and its default export collected.
Files starting with `_` are skipped. Filenames carry no meaning — order is computed.

---

## Writing a fixture

```ts
import { env, faker, hash, now, random } from "@workspace/seed"
import { defineFixture, ref } from "../define"

export default defineFixture("example_items", {
  description: "Demo data for local development",
  rows: [
    {
      reference: "ITEM-0001",
      categoryId: ref("example_categories", "tools"),
      title: "Torque wrench",
      ownerEmail: env("SEED_OWNER_EMAIL", "demo@example.com"),
      secret: hash("changeme"),
      token: random(48),
      publishedAt: now("-30d"),
      metadata: { grade: "alpha", tags: ["demo"] },
    },
    ...Array.from({ length: 50 }, (_, index) => ({
      reference: `ITEM-${String(index + 2).padStart(4, "0")}`,
      categoryId: ref("example_categories", "tools"),
      title: faker.commerce.productName(),
      ownerEmail: "demo@example.com",
    })),
  ],
})
```

The table name is a union of your real table names, and row keys and value types are
inferred from it — a wrong column is a compile error, not a runtime one.

There is deliberately no `count`, no `defaults` and no `extends`. Repetition is a
loop, shared values are a `const`, and inheritance is object spread.

---

## Helpers

Everything TypeScript already does well is left to TypeScript. These six exist
because they need something the language doesn't have: a value resolved after the
database is reachable, a clock fixed for the whole run, or a marker saying "this is
volatile, don't rewrite it every time".

| Helper | Result |
| --- | --- |
| `ref(table, key, column?)` | A column from a row seeded by its natural key |
| `now(offset?)` | Run clock, optionally shifted — `now("-30d")`, `now("+2h")`. Units `ms s m h d w M y` |
| `uuid(key?)` | Random v4, or a deterministic v5 from `key` — same key, same id, every run |
| `random(length?)` | Random hex, default 32 characters |
| `hash(plaintext)` | scrypt, `scrypt$N$r$p$salt$key` |
| `env(name, fallback?)` | Environment variable; throws when unset with no fallback |
| `sql(expression)` | Raw SQL passed into the statement instead of a bound parameter |
| `file(path, encoding?)` | A file next to the fixture, as a Buffer or decoded text |
| `once(value)` | Marks a value insert-only, so re-runs never overwrite it |

`faker` is re-exported and reseeded per run, so `--seed 42` makes the whole run
reproducible. Import it from here rather than from `@faker-js/faker`, or `--seed`
cannot reach it.

For a fixed date, write `new Date("2024-01-15")`. For a random integer or a choice,
use `faker.number.int()` and `faker.helpers.arrayElement()`.

---

## References

`ref()` addresses a row by its natural key rather than by an id nobody can write down:

```ts
categoryId: ref("example_categories", "tools")
```

The target column is inferred from the foreign key, so you rarely name it. Pass a
third argument when there is no foreign key, or when you want a different column.
For a composite natural key, pass an array: `ref("memberships", ["acme", "ana"])`.

It resolves from rows written earlier in the same run, and falls back to a `SELECT`
when the row was seeded previously or filtered out by `--only`. An unresolvable
reference aborts the run, and nothing is written.

---

## Natural keys

The upsert target is inferred from the table's unique constraints: the one your rows
actually populate. State it explicitly when there is a choice, or when it is composite:

```ts
export default defineFixture("memberships", {
  key: ["orgSlug", "userEmail"],
  rows: [...],
})
```

---

## Ordering

Filenames and tier order do not decide anything. The runner builds a dependency graph
from the real foreign keys **and** from the `ref()` calls in the data, then sorts it.
A fixture that references a table with no foreign-key constraint still lands in the
right place.

Rows within a fixture are ordered too, so a self-referencing table works no matter
how the rows are listed:

```ts
rows: [
  { slug: "grandchild", parentId: ref("nodes", "child") },
  { slug: "child", parentId: ref("nodes", "root") },
  { slug: "root" },
]
```

This inserts `root`, then `child`, then `grandchild`, in three statements.

**Cycles are broken rather than rejected.** If two tables reference each other and one
of the foreign keys is nullable, that column is left out of the insert and filled in by
an `UPDATE` once its target exists. `seed list` shows which columns were deferred. If
every foreign key in the cycle is `NOT NULL`, that is an error naming the tables —
nothing could be inserted first.

---

## Re-running

Every fixture becomes one multi-row `INSERT ... ON CONFLICT (natural key) DO UPDATE`,
so a second run updates instead of failing, and rows are never deleted.

Which columns an existing row has overwritten:

- `update` listed explicitly — exactly those columns.
- `update` omitted — every column the rows set, minus the key, minus any column whose
  value came from a **volatile** helper: `hash`, `random`, `uuid()` without a key,
  `now`, and anything wrapped in `once`.

That exclusion is the point. A salted hash and a random token differ on every resolve,
so overwriting them would rewrite every row on every run and quietly invalidate
anything issued against them. They are written once, at insert, and left alone after.

`updatedAt` is set to `now()` only when a row actually has something updated.

The `inserted` / `updated` split comes from Postgres itself (`xmax = 0`), not a guess.

---

## CLI

```bash
seed run [environment]     apply the fixtures
seed diff [environment]    show what would change, then roll back
seed reset [environment]   truncate the targeted tables, then apply from scratch
seed list [environment]    show the fixtures and their resolved order
```

The base tier is always applied; naming an environment adds that tier.

| Flag | Does |
| --- | --- |
| `-c, --config <path>` | Config file; otherwise found by walking up from the cwd |
| `-o, --only <names>` | Limit to these tables, files or tiers (comma-separated) |
| `--seed <n>` | Reseed every random helper and faker, making the run reproducible |
| `-f, --force` | Allow an environment that does not match `NODE_ENV` |
| `-v, --verbose` | Show which columns each fixture overwrites |
| `-q, --quiet` | Print the summary line only |

Naming a tier that matches nothing while `NODE_ENV` is a protected environment is
refused unless you pass `--force`. That guard covers `reset` too.

The whole run is one transaction. `diff` uses the same path and rolls back.

---

## Adapters

An adapter is three methods. Everything else — ordering, upserts, references,
idempotency — is the engine's job.

```ts
import { defineAdapter } from "@workspace/seed/adapter"
import { postgresDialect } from "@workspace/seed/dialect/postgres"

export const kyselyAdapter = defineAdapter({
  dialect: postgresDialect,

  async metadata() {
    return { tables: [...] }
  },

  transaction(run) {
    return db.transaction().execute((tx) => run({
      async run(query) {
        const { text, params } = query.render(postgresDialect)
        return (await tx.executeQuery({ sql: text, parameters: params })).rows
      },
    }))
  },

  close: () => db.destroy(),
})
```

`metadata()` returns tables, columns, primary keys, unique constraints and foreign
keys — everything ordering and key inference need. Where you get it from is your
business: read it off a schema object, introspect the database, or hard-code it.

Columns carry both a physical `name` and a `property` name, so fixtures may be
written in camelCase against a snake_case database. When you have only physical
names, set both to the same value — the engine matches case- and underscore-
insensitively.

`SeedExecutor.run` receives a `Query` and returns rows. Render it to text and
parameters with `query.render(dialect)`, or walk `query.fragments` yourself if your
driver can do better. The Drizzle adapter walks them, so it can attach each
parameter to its column and let Drizzle apply that column's own encoder.

### Shipped adapters

```ts
drizzleAdapter({ db, schema, casing, close })   // metadata from the Drizzle schema
postgresAdapter({ url })                        // metadata from information_schema
```

---

## Dialects

A dialect turns requests into SQL. `postgresDialect` is the only one implemented;
adding another is one file implementing the same interface.

```ts
import { defineDialect, Query } from "@workspace/seed/dialect"

export const mysqlDialect = defineDialect({
  name: "mysql",
  insertedColumn: "__seed_inserted",
  quoteIdentifier: (value) => `\`${value.replaceAll("`", "``")}\``,
  placeholder: () => "?",
  upsert(request) { ... },
  update(request) { ... },
  select(request) { ... },
  truncate(request) { ... },
  introspect() { ... },
})
```

`Query` is a small builder — `text`, `identifier`, `raw`, `value`, `join` — that keeps
identifiers and parameters distinct so each adapter can bind them its own way.

---

## Layout

```
src/
  index.ts        public surface
  config.ts       defineSeedConfig, config discovery
  errors.ts       SeedError

  authoring/      what a fixture file imports
    types.ts        Fixture, Row, Descriptor
    builder.ts      createBuilder → defineFixture, ref
    helpers.ts      now uuid random hash env sql file once
    faker.ts        seed-bound re-export

  engine/
    index.ts        seed(), planSeed()
    load/           tiers.ts   fixtures.ts
    plan/           catalog.ts graph.ts   build.ts
    apply/          resolve.ts upsert.ts  reset.ts

  adapter/        index.ts (the interface) + drizzle.ts, postgres.ts
  dialect/        index.ts (the interface) + postgres.ts
  cli/            main.ts  options.ts  commands/  render/
```

Each extension point is one directory whose `index.ts` defines what it is, with the
implementations beside it.

---

## Notes

**Bun runs the fixtures.** The `bun` export condition points at TypeScript source, so
the CLI needs no build step. Type consumers resolve `dist/`, which is why `build` runs
before `typecheck` — that also keeps declaration files resolving the same module
format as the app importing them.

**faker is eager.** `faker.x()` runs when the fixture module is imported, so its output
is an ordinary value the engine cannot mark volatile — it will be overwritten on every
re-run. Pass `--seed` to make it stable, or wrap it in `once()` to write it only at
insert.

**Programmatic use.** `seed(config, options)` and `planSeed(config, options)` are
exported for scripts and tests.
