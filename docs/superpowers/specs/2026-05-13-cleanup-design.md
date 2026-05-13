# Design Doc - Cleanup Unused Code

Remove unused files, functions, and dependencies to declutter the codebase.

## Proposed Changes

### 1. Unused Files in Root
- Delete `check-books.cjs` (One-off script, not used)
- Delete `process-bible.cjs` (One-off script, not used)
- Delete `process-bible-fixed.cjs` (One-off script, not used)
- Delete `validate-bible.cjs` (One-off script, not used)
- Delete `db_dump.sql` (Database dump, not part of active codebase)
- Delete `create_church_notes_table.sql` (Old schema script, not in migrations)

### 2. Unused Files in `src`
- Delete `src/components/FontLoader.tsx` (Not imported anywhere)
- Delete `src/data/bible-raw.json` (Large 23MB file, not used in src. `bible-content.ts` is the active data)

### 3. Unused Functions in Services
- Remove `fetchSettings` and `updateSettings` from `src/services/supabase.ts` (Superseded by `fetchUserSettings` and `updateUserSettings`)

### 4. Unused Dependencies in `package.json`
- Remove `jest` (Superseded by `vitest`)
- Remove `fast-check` (Not used in tests)

## Verification Plan
- Run `npm run dev` to ensure the app still starts correctly.
- Run `npm run build` to ensure no broken imports or missing files.
- Run `npm run test` to ensure tests still pass without the removed dependencies.
