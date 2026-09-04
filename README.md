# workspace

Turborepo monorepo with a shared shadcn/ui component library.

## Stack

| Tool         | Version | Notes                                              |
| ------------ | ------- | -------------------------------------------------- |
| Bun          | 1.4.0   | Package manager + script runner (`packageManager`) |
| Turborepo    | 2.10.x  | Task orchestration + caching                       |
| Next.js      | 16.3.x  | App Router, Turbopack builds                       |
| React        | 19.2.x  | RSC enabled                                        |
| Tailwind CSS | 4.3.x   | CSS-first config, no `tailwind.config.js`          |
| shadcn/ui    | CLI 4.x | `base-nova` style, Base UI primitives                |
| Phosphor     | 2.1.x   | Icon set used in app code (`@phosphor-icons/react`) |
| Paraglide JS | 2.25.x  | Compiler-based i18n for the web app                 |
| TanStack     | Query 5 / Form 1 | Server state and forms                     |
| Zod          | 4.5.x   | Validation, shared by the API and the web app       |
| Biome        | 2.5.x   | Linter + formatter (replaces ESLint + Prettier)    |
| TypeScript   | 5.9.x   | See note on TypeScript 7 below                     |

## Layout

```
apps/
  api/                    NestJS + Express API
  web/                    Next.js app — components.json points shadcn at packages/ui
    messages/             Translation catalogues, one JSON per locale
    project.inlang/       inlang project + paraglide.config.ts
    lib/paraglide/        Generated, git-ignored, never edited by hand
packages/
  ui/                     Shared shadcn/ui library (@workspace/ui)
    src/components/       Components land here, added from apps/web
    src/styles/globals.css  Single source of Tailwind theme + CSS variables
  api-client/             Typed client for apps/api (@workspace/api-client)
  typescript-config/      Shared tsconfig bases (@workspace/typescript-config)
biome.json                Single root config — Biome runs as a Turborepo root task
turbo.json
```

## Commands

```bash
bun install

bun run dev              # turbo dev — all apps
bun run build            # turbo build
bun run typecheck        # turbo typecheck (tsc --noEmit per package)

bun run check            # biome check .  (lint + format, read-only)
bun run check:fix        # biome check . --write
bun run lint             # biome lint .
bun run format           # biome format . --write

cd apps/web
bun run i18n             # compile messages/*.json into lib/paraglide
```

## Internationalisation (apps/web)

Locales are `en` (base) and `ko`, declared in `project.inlang/settings.json`. Copy
lives in `messages/<locale>.json`; Paraglide compiles it into typed functions under
`lib/paraglide/`, which is generated and git-ignored.

Turbopack cannot run Paraglide's webpack plugin, so compilation is a script instead.
`dev`, `build`, and `typecheck` each run `bun run i18n` first. `turbo dev` additionally
runs `dev:i18n` — the compiler in watch mode — alongside the dev server, via the `with`
option in `apps/web/turbo.json`, so editing a message recompiles it immediately.

Compiler options live in `project.inlang/paraglide.config.ts`, not in CLI flags.

Locale resolution is cookie-first (`PARAGLIDE_LOCALE`), then `Accept-Language`, then
the base locale. It never appears in the URL, so there is no `[locale]` route segment.
`proxy.ts` writes the cookie on the first request, so the server and the browser read
the locale from the same place on every request after the first byte.

The locale is passed explicitly, never held in global state. Server Components resolve
it once with `await getServerLocale()` (memoised per request with React `cache`), and
every message call names it: `m.some_key({}, { locale })`. Client Components take
`locale` as a prop and do the same. `getLocale()` is synchronous and Next 16 exposes
the request only asynchronously, so there is no correct global for a Server Component
to read — and a Client Component's server-render pass has its own module graph anyway.
Explicit locale is the only form that is right in all three passes.

Adding a locale: add it to `settings.json`, add `messages/<locale>.json`, and add a
label to `LOCALE_LABELS` in `components/locale-switcher.tsx`.

## Calling the API

`@workspace/api-client` wraps `fetch` with Zod-validated responses, a typed error
union (`network`, `timeout`, `http`, `invalid-response`), and the `x-lang` header the
API's `nestjs-i18n` resolver reads. It also exports ready-made `queryOptions` factories
(`healthQueries`) for TanStack Query.

`apps/web/lib/api/client.ts` memoises one client per locale; `lib/query/client.ts`
holds the SSR-correct QueryClient (fresh per request on the server, singleton in the
browser).

## Adding shadcn components

Always run the CLI from `apps/web`. It reads that app's `components.json`, sees the
`@workspace/ui` aliases, and writes the component into `packages/ui/src/components/`
while rewriting imports across the workspace boundary.

```bash
cd apps/web
bunx --bun shadcn@latest add dialog
```

Or from the repo root:

```bash
bun run ui:add dialog
```

Import it from anywhere:

```tsx
import { Dialog } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
```

`packages/ui` is consumed as source — `apps/web/next.config.ts` sets
`transpilePackages: ["@workspace/ui"]`, so there is no build step for the UI package.

## Conventions

- **Theme lives in one place.** All CSS variables and `@theme inline` blocks are in
  `packages/ui/src/styles/globals.css`. Apps import it via `@workspace/ui/globals.css`
  and share `packages/ui/postcss.config.mjs`.
- **Both `components.json` files must agree** on `style`, `baseColor`, and
  `iconLibrary`, or the CLI will emit mismatched components. `iconLibrary` is
  `phosphor`, so generated components import from `@phosphor-icons/react` — the same
  set app code uses. Server Components import from `@phosphor-icons/react/ssr`.
- **Tailwind v4:** the `tailwind.config` field in `components.json` is intentionally
  empty — there is no JS config file.
- **Biome is a root task.** Turborepo recommends this over per-package lint tasks
  because Biome is fast enough that fan-out only adds overhead. Class sorting is
  handled by Biome's `useSortedClasses` rule (configured for `cn`, `cva`, `clsx`),
  which replaces `prettier-plugin-tailwindcss`.

## Why TypeScript 5, not 7

TypeScript 7.0 (native Go compiler) is GA, but it ships without a stable programmatic
API until 7.1. `typescript-eslint`, and more importantly the type-aware tooling this
repo relies on, still declare `typescript <6.1.0`. Next.js only gained a CLI-based
TypeScript backend in a 16.3 canary. Revisit once TypeScript 7.1 lands.
