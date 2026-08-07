# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Marketing site for Plitvice Club, a nightclub in Inđija, Serbia. Next.js App Router, single-page site rooted at `app/page.tsx`. Path alias `@/*` maps to the repo root.

## Commands

- `npm run dev` — dev server at http://localhost:3000 (Turbopack, the default in Next 16)
- `npm run build` — production build (Turbopack; does NOT run linting)
- `npm run lint` — plain ESLint CLI (`next lint` was removed in Next 16); flat config in `eslint.config.mjs`
- `npx next typegen` — regenerate route type helpers (`LayoutProps`, `PageProps`)

There is no test setup.

## Version gotchas (newer than typical training data — verify against bundled docs)

Authoritative docs for the installed Next.js version are bundled at `node_modules/next/dist/docs/` (see AGENTS.md). Key facts verified against them:

- **Next.js 16.3**: `cookies()`, `headers()`, `draftMode()`, and `params`/`searchParams` props are async-only — always `await` them. Layouts/pages use globally generated type helpers (e.g. `app/layout.tsx` uses `LayoutProps<"/">`) instead of hand-written prop types. `middleware.ts` is deprecated in favor of `proxy.ts`. `next/image` defaults changed: `images.qualities` defaults to `[75]`, `minimumCacheTTL` is 4 hours, local images with query strings need `images.localPatterns.search`.
- **Tailwind CSS v4**: CSS-first configuration — there is no `tailwind.config.js`. Design tokens live in `app/globals.css` via `@import "tailwindcss"` + `@theme inline`. PostCSS plugin is `@tailwindcss/postcss` (`postcss.config.mjs`).
- **framer-motion v13** is the "Motion" rebrand. Importing from `"framer-motion"` still works and exports the familiar API (`motion`, `AnimatePresence`, `useScroll`, `useTransform`, `useReducedMotion`, ...).
- **Lenis**: both `lenis` (v1.3) and the deprecated `@studio-freight/lenis` are installed — use `lenis`. React bindings are at `lenis/react` (`ReactLenis`, `useLenis`).
- **AGENTS.md** contains a managed block rewritten by `next dev`. Don't try to remove it; commit it as-is.
