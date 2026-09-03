<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Monorepo conventions

- Package manager is **bun**. Use `bun install`, `bun run <script>`, `bunx --bun <cli>`.
  Never `npm`/`pnpm`/`yarn`.
- Linting and formatting are **Biome**, not ESLint/Prettier. Run `bun run check:fix`.
  There is one `biome.json` at the repo root and it runs as a Turborepo root task —
  do not add per-package Biome configs or lint scripts.
- Shared UI lives in `packages/ui` (`@workspace/ui`) and is consumed as source via
  `transpilePackages`. There is no build step for it.
- Add shadcn components from `apps/web` (`bunx --bun shadcn@latest add <name>`), never
  from `packages/ui` directly — the app's `components.json` is what routes files into
  `packages/ui/src/components/` and rewrites cross-workspace imports.
- Tailwind is v4 with CSS-first config. All theme tokens live in
  `packages/ui/src/styles/globals.css`. There is no `tailwind.config.js`.
- Stay on TypeScript 5.9 until TypeScript 7.1 ships a stable programmatic API.
