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
| shadcn/ui    | CLI 4.x | `base-nova` style, Base UI primitives, lucide icons |
| Biome        | 2.5.x   | Linter + formatter (replaces ESLint + Prettier)    |
| TypeScript   | 5.9.x   | See note on TypeScript 7 below                     |

## Layout

```
apps/
  web/                    Next.js app — components.json points shadcn at packages/ui
packages/
  ui/                     Shared shadcn/ui library (@workspace/ui)
    src/components/       Components land here, added from apps/web
    src/styles/globals.css  Single source of Tailwind theme + CSS variables
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
```

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
  `iconLibrary`, or the CLI will emit mismatched components.
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
