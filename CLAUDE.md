# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- Keep the codebase-memory graph fresh: consult it first when exploring, and after landing code changes update it (codebase-memory `detect_changes` / re-index) so the graph reflects the current code.
- User instructions always override this file.

## Commands

**Always use pnpm, never npm.** A `package-lock.json` breaks the Vercel build.

```bash
pnpm dev                # Dev server (Vite, http://localhost:5173)
pnpm build              # tsc + vite-react-ssg build → dist/
pnpm test               # Unit tests, single run (Vitest)
pnpm test:watch         # Unit tests in watch mode
pnpm vitest --run src/test/lyricsParser.test.ts   # Single test file
pnpm vitest --run -t "nombre del test"            # Single test by name
pnpm test:e2e           # Playwright E2E (tests/; starts dev server itself)
```

There is no lint script. Type checking runs as part of `pnpm build` (`tsc`); for a quick check use `pnpm tsc --noEmit`.

Unit tests live in `src/test/` (jsdom, setup in `src/test/setup.ts`); Vitest only picks up `src/**/*.{test,spec}.{ts,tsx}`. `tests/` holds Playwright E2E specs only, currently all under `tests/security/`. Authenticated E2E specs (`auth.authenticated.spec.ts`) depend on a setup project that mints a real Supabase session.

## What this is

Proclama: church worship/Bible projection web app (Spanish UI). React 18 + TypeScript + Vite 8, PWA, built as SSG via `vite-react-ssg`. Backend is Supabase only (Postgres + Auth + Storage + Edge Functions) — no own server. Works fully offline/guest via Dexie (IndexedDB).

## Architecture

### Dual-window projection (the core mechanism)
Two same-origin windows communicate over `BroadcastChannel('proclama-projection')`:
- **Main window** (`/`): operator controls slides, theme, media (`src/services/projection.ts` orchestrates).
- **Projection window** (`/projection` or `window.name === 'proclama-projection'`): render-only, listens for messages. Detected in `App.tsx`.

Message types (full union in `src/types/index.ts`): `PROJECTION_UPDATE` (full state), `NEXT_SLIDE`/`PREV_SLIDE`/`GO_TO_SLIDE`, `MEDIA_COMMAND`/`MEDIA_STATUS`, `COUNTDOWN_UPDATE`, `TICKER_UPDATE`, `PROJECTION_READY`, `PING`/`PONG` (heartbeat).

The projection renders on a fixed canvas (1920×1080 or 1024×768) scaled with `transform: scale` — immune to window size/F11. Font auto-fit is pure math (no DOM): `calcCanvasFontSize()` in `src/hooks/useProjectionFontSize.ts`.

### State and persistence (three layers)
- **Zustand** (`src/stores/index.ts`): `useAppStore` (settings, auth, `activeView`, guest mode — persisted) and `useProjectionStore` (live projection state — mostly ephemeral, theme/backgrounds persisted). `src/features/countdown/store.ts` for the countdown.
- **Dexie** (`src/db/index.ts`, schema at v11): local/offline source of truth — `songs`, `setlists`, `settings`, `church_notes`. Schema changes need a new `this.version(n).stores({...})` block, never an edit to an existing one.
- **Supabase** (`src/services/supabase.ts`): cloud sync when logged in, gated by RLS. Realtime sync hooks: `useSongsRealtime`, `useSetlistsRealtime`. On login, guest data migrates automatically to the user (in `App.tsx`).

### Navigation
Main app is view-switched via `activeView` in `useAppStore` (not URL routes). react-router-dom exists for the shell routes only: `/projection`, `/admin/*` (see `src/admin/AdminShell.tsx` + `AdminGuard.tsx` role check), `/collab/:id`. Note: `AGENT.md` still says "no router" — that part is outdated.

### Layout conventions
- `src/pages/` — main views (LibraryView, BibleView, NotesView, ProjectionWindow…)
- `src/features/` — domain modules (attendance, bible, countdown, notices, setlists); high fan-in, don't import from pages/components
- `src/services/` — stateless exported functions (supabase, projection, lyricsParser, bible)
- `src/admin/` — admin panel, self-contained with its own pages/services; all admin actions audited via `logAdminAction`
- `src/types/index.ts` — single source of truth for domain types
- Import alias `@/` → `src/`
- Supabase: snake_case in DB ↔ camelCase in frontend (mapping in services)
- Styles: vanilla CSS, no framework, no CSS modules. `src/index.css` is only a list of `@import` in cascade order; the actual rules live in `src/styles/*.css` split by domain (`base`, `library`, `bible`, `collab`, `admin`…). Import order is the cascade — don't reorder without checking what overrides what.
- Bible RVR1960 ships as JSON loaded lazily (`src/data/`); external fallback is bible-api.com
- `src/i18n/` is a hand-rolled `t(lang, path)` lookup (no library) used only on the landing/pricing surface — the app UI itself is Spanish-only strings

### Freemium / security
- `src/hooks/usePlan.ts` holds plan limits and tiers (`free`/`trial`/`paid`/`founding`); currently `FOUNDING_PHASE = true`, which short-circuits everyone to premium.
- `isPremiumFromProfile()` in that file is the single "is premium" rule for both React and non-React callers, and it deliberately mirrors `public.is_premium()` in Supabase — change one and you must change the other.
- Client-side premium checks are UI-only — real enforcement must be RLS or Edge Functions.
- `VITE_*` env vars are public. Server secrets go in Supabase Edge Functions (`supabase secrets set`), never in Vite. Required local env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` in `.env.local`.

## More documentation
- `AGENT.md` — detailed domain context: data model, BroadcastMessage types, Zustand store APIs, Supabase tables (may lag behind code; code wins)
- `docs/ARQUITECTURA.md` — detailed architecture and data flow
- `docs/SUPABASE.md` — DB schema, RLS, migrations, Edge Functions
- `docs/ADMIN.md` — admin panel guide
