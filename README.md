<div align="center">

# workspace

**A production-ready Turborepo monorepo — NestJS API, Next.js web app, shared UI and contracts.**

Containerised end to end. Two portable images, no vendor lock-in.

<br>

[![Bun](https://img.shields.io/badge/Bun-1.4-000?logo=bun&logoColor=fff)](https://bun.sh)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.10-EF4444?logo=turborepo&logoColor=fff)](https://turborepo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-000?logo=nextdotjs&logoColor=fff)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=fff)](https://nestjs.com)
[![Node](https://img.shields.io/badge/Node-24_LTS-5FA04E?logo=nodedotjs&logoColor=fff)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-OCI-2496ED?logo=docker&logoColor=fff)](https://docker.com)

</div>

---

## Quick start

```bash
bun install
bun run dev
```

Web on [localhost:3000](http://localhost:3000), API on [localhost:8000](http://localhost:8000).

**Or bring the whole stack up in containers** — Postgres included, nothing to install:

```bash
cp .env.example .env
docker compose up -d --build
```

```bash
curl localhost:3000/healthz        # {"status":"ok"}
curl localhost:8000/health         # the API, straight up
```

---

## How it fits together

The browser calls the API directly at `NEXT_PUBLIC_API_URL`. Server Components use
`API_URL` instead, so server-side traffic can stay on an internal network and never
leave the cluster.

```
                    ┌───────────────────────────────┐
   browser ─────────│──▶ web  :3000                 │
        │           │                               │
        │           │   RSC ───────┐                │        ┌──────────────┐
        │           └──────────────┼────────────────┘        │  api  :8000  │
        │                          │  API_URL                └──────┬───────┘
        │                          └───────────────────────────▶    │
        │                                                           │
        └───────────────────────────────────────────────────▶       ▼
             NEXT_PUBLIC_API_URL, CORS-checked              ┌──────────┐
                                                            │ postgres │
                                                            └──────────┘
```

**What this costs:** `NEXT_PUBLIC_API_URL` is inlined into the client bundle at build
time, so the web image is environment-specific — pass it as a `--build-arg` and build
once per environment. The API needs a public hostname of its own, and `ALLOWED_ORIGINS`
on the API is what decides who may call it.

> [!NOTE]
> Every API route is reachable from the internet. Authentication and rate limiting
> belong in the API itself — there is no frontend hop left to hide behind.

---

## Stack

| Tool | Version | Notes |
| --- | --- | --- |
| Bun | 1.4.0 | Package manager + script runner |
| Turborepo | 2.10.x | Task orchestration + caching |
| Next.js | 16.3.x | App Router, Turbopack, standalone output |
| NestJS | 12.x | Express platform, Drizzle, Pino |
| React | 19.2.x | RSC enabled |
| Node | 24 LTS | Runtime for both images (Active LTS → Apr 2028) |
| Tailwind CSS | 4.3.x | CSS-first config, no `tailwind.config.js` |
| shadcn/ui | CLI 4.x | `base-nova` style, Base UI primitives |
| Paraglide JS | 2.25.x | Compiler-based i18n |
| TanStack | Query 5 / Form 1 | Server state and forms |
| Zod | 4.5.x | Shared contracts across API and web |
| Biome | 2.5.x | Lint + format, replaces ESLint + Prettier |
| PostgreSQL | 18 | Via Drizzle ORM |

---

## Layout

```
apps/
  api/                      NestJS API · Dockerfile
  web/                      Next.js app · Dockerfile
    messages/               Translation catalogues, one JSON per locale
    project.inlang/         inlang project + paraglide.config.ts
    src/
      app/                  App Router
      components/
      lib/paraglide/        Generated, git-ignored, never edited by hand
      proxy.ts              Locale cookie + the /api runtime proxy
packages/
  ui/                       Shared shadcn/ui library (@workspace/ui)
  client/                   Typed API client (@workspace/client)
  schemas/                  Shared zod contracts (@workspace/schemas)
  typescript-config/        Shared tsconfig bases
compose.yaml                db + api + web
```

`apps/web` follows Next's [`src` folder convention](https://nextjs.org/docs/app/api-reference/file-conventions/src-folder):
config files stay at the app root, all application code lives under `src/`, and `@/*`
maps to `./src/*`.

---

## Commands

| Command | Does |
| --- | --- |
| `bun run dev` | All apps, watch mode |
| `bun run build` | Build everything |
| `bun run typecheck` | `tsc --noEmit` per package |
| `bun run check` | Biome lint + format, read-only |
| `bun run check:fix` | Biome, write |
| `bun run ui:add <name>` | Add a shadcn component into `packages/ui` |

---

## Deployment

Two independent OCI images. Configuration is environment variables, there are no
provider SDKs and no platform adapters — they run the same on a VM, ECS, Cloud Run,
Fly, Render, Nomad or Kubernetes.

```bash
# build context is the repo root, not the app directory
docker build -f apps/api/Dockerfile -t workspace-api:1.0.0 .
docker build -f apps/web/Dockerfile -t workspace-web:1.0.0 \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com .
```

Set `API_IMAGE` / `WEB_IMAGE` in `.env` to run prebuilt images from a registry instead
of building locally.

### Runtime configuration

| Service | Variable | Notes |
| --- | --- | --- |
| web | `NEXT_PUBLIC_API_URL` | The API origin the browser calls. **Build-time** — pass it as a `--build-arg`, one image per environment. |
| web | `API_URL` | Where Server Components send requests. Read per request; falls back to `NEXT_PUBLIC_API_URL`. |
| web | `PORT` | Defaults to 3000. |
| api | `DATABASE_URL` | **Required** — the process exits at boot without it. |
| api | `ALLOWED_ORIGINS` | Comma-separated web origins allowed to call the API. `*` is refused at boot outside development. |
| api | `APP_PORT` | Defaults to 8000. |
| api | `DATABASE_PREPARE` | Set `false` behind a transaction-mode pooler (PgBouncer, Supabase 6543). |

`apps/api/.env.example` lists the rest. Compose publishes the API on `${API_PORT}` —
the browser talks to it directly, so it needs a public address.

### Health endpoints

| Endpoint | Purpose |
| --- | --- |
| `web /healthz` | Liveness |
| `api /health/live` | Liveness |
| `api /health` | Readiness — database + heap, `503` when degraded |

`HEALTHCHECK` is set on both images. Compose, ECS and Nomad use it; Kubernetes ignores
it in favour of its own probes — point those at the endpoints above.

<details>
<summary><b>How the image builds work</b></summary>

<br>

Both Dockerfiles follow the same shape:

| Stage | Does |
| --- | --- |
| `prune` | `turbo prune <app> --docker` — cuts the monorepo to that app and its workspace deps |
| `deps` | `bun install --frozen-lockfile` from `out/json` only, so a source edit doesn't reinstall |
| `prod-deps` | The same install with `--production` (API only) |
| `build` | `turbo build --filter=<app>` over `out/full` |
| `runner` | `node:24-alpine`, non-root `node` user, artifacts only |

Bun is the package manager and runs the builds; the runtime is Node 24, because that is
what Nest and Next's standalone `server.js` are tested against. The bun binary is copied
out of `oven/bun` into `node:24-alpine`, so both tools exist in the build stages and
neither exists at runtime.

The web image ships Next's `output: "standalone"` build — a traced `server.js` plus only
the modules it actually reached, rather than the whole workspace `node_modules`.

Images carry `org.opencontainers.image.*` labels. Pass `IMAGE_REVISION`, `IMAGE_VERSION`,
`IMAGE_CREATED` and `IMAGE_SOURCE` as build args to fill them in.

</details>

<details>
<summary><b>Gotchas worth knowing</b></summary>

<br>

- **`turbo prune` respects `.gitignore`** (since turbo 2.3.4). inlang generates a
  `project.inlang/.gitignore` that ignores everything but `settings.json`, so
  `paraglide.config.ts` would never reach the build — Paraglide then silently falls back
  to its default `outdir` and the Next build fails on unresolved `@/lib/paraglide`
  imports. Both Dockerfiles pass `--use-gitignore=false`; `.dockerignore` is what keeps
  build outputs, `node_modules` and `.env` files out of the context.
- **Postgres 18 moved its volume mount.** The single mount belongs at
  `/var/lib/postgresql`, not `/var/lib/postgresql/data`. The old path leaves the
  container unhealthy at startup.
- **`HOSTNAME` must be `0.0.0.0`** in the web image. Docker otherwise sets it to the
  container ID, which Next tries to bind and fails.
- **Migrations are not wired up yet.** `database.schema.ts` is empty and there is no
  `drizzle/` directory. When the schema lands, add a migration step before the API
  starts — `drizzle-kit` is a devDependency and is not in the runtime image.
- **No `public/` directory** in `apps/web`, so the web Dockerfile does not copy one. Add
  the `COPY` line if you add the directory.
- **`serverExternalPackages`** is unused, and should stay that way for now: Next 16
  Turbopack has open bugs where those modules are left out of the traced standalone
  `node_modules`.

</details>

---

## Calling the API

`@workspace/client` wraps axios with Zod-validated responses, a typed error union
(`network`, `timeout`, `http`, `invalid-response`), and the `x-lang` header the API's
`nestjs-i18n` resolver reads. It also exports ready-made `queryOptions` factories for
TanStack Query.

```tsx
const client = getApiClient(locale)
const query = useQuery(healthQueries.check(client))
```

`src/lib/api/client.ts` memoises one client per locale. The server and browser clients
share a `scope` so a query prefetched during SSR hydrates the browser cache — the query
key uses `scope`, not `baseUrl`, which differs between the two.

---

## Internationalisation

Locales are `en` (base) and `ko`, declared in `project.inlang/settings.json`. Copy lives
in `messages/<locale>.json`; Paraglide compiles it into typed functions under
`src/lib/paraglide/`, which is generated and git-ignored.

Resolution is cookie-first (`PARAGLIDE_LOCALE`), then `Accept-Language`, then the base
locale. It never appears in the URL, so there is no `[locale]` route segment.

**Adding a locale:** add it to `settings.json`, add `messages/<locale>.json`, and add a
label to `LOCALE_LABELS` in `components/locale-switcher.tsx`.

<details>
<summary><b>Why the locale is always passed explicitly</b></summary>

<br>

The locale is never held in global state. Server Components resolve it once with
`await getServerLocale()` (memoised per request with React `cache`), and every message
call names it: `m.some_key({}, { locale })`. Client Components take `locale` as a prop
and do the same.

`getLocale()` is synchronous and Next 16 exposes the request only asynchronously, so
there is no correct global for a Server Component to read — and a Client Component's
server-render pass has its own module graph anyway. Explicit locale is the only form
that is right in all three passes.

Turbopack cannot run Paraglide's webpack plugin, so compilation is a script. `dev`,
`build` and `typecheck` each run `bun run i18n` first, and `turbo dev` additionally runs
the compiler in watch mode via the `with` option in `apps/web/turbo.json`.

</details>

---

## UI components

Always run the shadcn CLI from `apps/web`. It reads that app's `components.json`, sees
the `@workspace/ui` aliases, and writes the component into `packages/ui/src/components/`
while rewriting imports across the workspace boundary.

```bash
bun run ui:add dialog
```

```tsx
import { Dialog } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
```

`packages/ui` is consumed as source — `next.config.ts` sets
`transpilePackages: ["@workspace/ui", "@workspace/client"]`, so there is no build step
for either package.

---

## Conventions

- **Theme lives in one place.** All CSS variables and `@theme inline` blocks are in
  `packages/ui/src/styles/globals.css`. Apps import it via `@workspace/ui/globals.css`
  and share `packages/ui/postcss.config.mjs`.
- **Both `components.json` files must agree** on `style`, `baseColor` and `iconLibrary`,
  or the CLI emits mismatched components. `iconLibrary` is `phosphor`; Server Components
  import from `@phosphor-icons/react/ssr`.
- **Tailwind v4:** the `tailwind.config` field in `components.json` is intentionally
  empty — there is no JS config file.
- **Biome is a root task.** Turborepo recommends this over per-package lint tasks
  because Biome is fast enough that fan-out only adds overhead. Class sorting uses
  Biome's `useSortedClasses` rule, which replaces `prettier-plugin-tailwindcss`.
- **No `@workspace/ui/*` path alias.** The base config sets `moduleResolution: "Bundler"`,
  which honours the `exports` map in `packages/ui/package.json` — the alias was
  redundant, and `@workspace/client` never had one.

---

## Why TypeScript 5, not 7

TypeScript 7.0 (native Go compiler) is GA, but ships without a stable programmatic API
until 7.1. The type-aware tooling this repo relies on still declares `typescript <6.1.0`,
and Next.js only gained a CLI-based TypeScript backend in a 16.3 canary. Revisit once
7.1 lands.
