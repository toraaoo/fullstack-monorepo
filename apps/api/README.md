# api

NestJS 12 on Fastify. The layout follows
[aolus-software/clean-nest-drizzle-pg](https://github.com/aolus-software/clean-nest-drizzle-pg),
minus drizzle and the auth/RBAC stack.

## Layout

Three layers under `src/`, each reached through a path alias rather than long
relative paths:

```
src/
  main.ts
  app.module.ts
  app.controller.ts

  core/          imported once at boot; app-wide singletons
    core.module.ts
    config/      getEnv() (envalid), CORS, helmet, Swagger
    database/    the connection, and only the connection
    i18n/        nestjs-i18n + the lang catalogs
    throttler/   rate limiting

  shared/        stateless; importable from anywhere
    decorators/  Swagger response decorators
    pipes/       the zod validation pipe
    utils/       DateUtils, LoggerUtils, StrUtils, NumberUtils
    types/
    response.ts  the success/error envelope

  modules/       features
    health/
```

| Alias | Path |
| --- | --- |
| `@core` | `src/core` |
| `@shared` | `src/shared` |
| `@modules/*` | `src/modules/*` |

```ts
import { successResponse, DateUtils } from "@shared"
import { getEnv } from "@core/config"
import { CoreModule } from "@core"
```

The Nest CLI rewrites these to relative paths at build time, so nothing extra
is needed at runtime.

The rule for the two non-feature layers: `core` is what the app needs exactly
once and `AppModule` imports it once; `shared` is stateless and carries no
lifecycle, so anything may import it freely. A feature never imports
`CoreModule` -- it imports the specific module it needs (`DatabaseModule` for
the connection) so its dependencies read off its own file.

`shared/utils` does reach back into `@core/config` for `APP_TIMEZONE` and
`NODE_ENV`. That is the one dependency crossing the layers, and it only goes
one way.

Upstream instead keeps `common`, `config`, `utils` and `repositories` as
nest-cli library projects in a `libs/` directory -- a second monorepo nested
inside a workspace that already is one. None of that code is Nest-free enough
for `apps/web` to import, so it stays in the app. Promote a directory to
`packages/` once something outside the API needs it.

## Scripts

```bash
bun run dev         # nest start --watch
bun run build       # nest build  -> dist/
bun run start:prod  # node dist/main
bun run typecheck
```

Lint and format are Biome, run from the repo root: `bun run check:fix`.

## Configuration

Every variable is declared and validated in `src/core/config/env.ts` and
read through `getEnv()`. A malformed value fails at boot, not on the first
request. Copy `.env.example` to `.env` to start; every variable has a
development default, so the app also boots with no `.env` at all.

Set `API_DOCS_ENABLED=true` to mount the Scalar API reference at `/docs`.

## Validation

DTOs are zod schemas wrapped in `createZodDto` from `nestjs-zod`:

```ts
const CreateUserSchema = z.object({
  email: z.email(),
  age: z.number().int().min(18),
})

export class CreateUserDto extends createZodDto(CreateUserSchema) {}

@Post()
create(@Body() body: CreateUserDto) {
  // body is parsed and typed as z.infer<typeof CreateUserSchema>
}
```

The globally registered `CustomValidationPipe` parses the schema and, on
failure, returns 422 with a `{ field: [messages] }` map. Messages resolve
against `src/core/i18n/lang/<lang>/validation.json` in the request
language; a message set on the schema itself wins over the catalog.

## i18n

`nestjs-i18n` with the `en` catalog in `src/core/i18n/lang`. The request
language comes from `?lang=`, the `x-lang` header, or `Accept-Language`. Add a
locale by adding a folder beside `en` and listing it under `fallbacks` in
`src/core/i18n/i18n.module.ts`.

## Feature modules

A feature owns everything it needs, in one directory:

```
src/modules/users/
  users.module.ts
  users.controller.ts
  users.service.ts
  users.repository.ts
  users.schema.ts
  dto/
    create-user.dto.ts
```

Upstream instead splits this across `src/settings/users/` and a central
`libs/repositories` tree holding every schema and every repository in the app,
so one change touches two trees. Keep persistence next to the feature that
owns it.

## Data layer

`src/core/database` is an empty module, and holds the connection only. To wire an
ORM: register the client there as a provider and export it, import
`DatabaseModule` from the feature modules that need it, give `DATABASE_URL` a
defaultless declaration in `src/core/config`, and add the db probe to
`src/modules/health/health.controller.ts`.
