# Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unused files, functions, and dependencies to declutter the Proclama repository.

**Architecture:** Sequential deletion of identified unused assets and code blocks, followed by dependency removal and verification via build and tests.

**Tech Stack:** Node.js, Vite, Vitest, Supabase.

---

### Task 1: Remove Unused Root Scripts and Files

**Files:**
- Delete: `check-books.cjs`
- Delete: `process-bible.cjs`
- Delete: `process-bible-fixed.cjs`
- Delete: `validate-bible.cjs`
- Delete: `db_dump.sql`
- Delete: `create_church_notes_table.sql`
- Delete: `bulk_cleanup_log.txt`
- Delete: `dry_run_output.txt`
- Delete: `dry_run_output_utf8.txt`
- Delete: `results.txt`

- [ ] **Step 1: Delete root scripts**
- [ ] **Step 2: Delete root SQL files**
- [ ] **Step 3: Delete local log files**
- [ ] **Step 4: Commit**
```bash
git rm check-books.cjs process-bible.cjs process-bible-fixed.cjs validate-bible.cjs db_dump.sql create_church_notes_table.sql
rm bulk_cleanup_log.txt dry_run_output.txt dry_run_output_utf8.txt results.txt
git commit -m "cleanup: remove unused root scripts, sql dumps and logs"
```

### Task 2: Remove Unused Src Files

**Files:**
- Delete: `src/components/FontLoader.tsx`
- Delete: `src/data/bible-raw.json`

- [ ] **Step 1: Delete FontLoader.tsx**
- [ ] **Step 2: Delete bible-raw.json**
- [ ] **Step 3: Commit**
```bash
git rm src/components/FontLoader.tsx src/data/bible-raw.json
git commit -m "cleanup: remove unused FontLoader component and raw bible data"
```

### Task 3: Remove Unused Functions in Supabase Service

**Files:**
- Modify: `src/services/supabase.ts`

- [ ] **Step 1: Remove fetchSettings function**
```typescript
// Remove lines 383-391
export async function fetchSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .single()

  if (error) console.warn('No settings found:', error)
  return data || null
}
```
- [ ] **Step 2: Remove updateSettings function**
```typescript
// Remove lines 393-404
export async function updateSettings(updates: any) {
  const { data: existing } = await supabase.from('app_settings').select('id').single()
  let result
  if (existing) {
    result = await supabase.from('app_settings').update(updates).eq('id', existing.id).select()
  } else {
    result = await supabase.from('app_settings').insert(updates).select()
  }

  if (result.error) console.error('Error updating settings:', result.error)
  return result.data?.[0] || null
}
```
- [ ] **Step 3: Commit**
```bash
git add src/services/supabase.ts
git commit -m "cleanup: remove unused fetchSettings and updateSettings functions"
```

### Task 4: Remove Unused Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove jest and fast-check from package.json**
- [ ] **Step 2: Run pnpm install to update lockfile**
- [ ] **Step 3: Commit**
```bash
pnpm remove jest fast-check
git add package.json pnpm-lock.yaml
git commit -m "cleanup: remove unused dependencies jest and fast-check"
```

### Task 5: Verification

- [ ] **Step 1: Run development server**
Run: `pnpm dev`
Expected: Server starts without errors.

- [ ] **Step 2: Run build**
Run: `pnpm build`
Expected: Build completes successfully.

- [ ] **Step 3: Run tests**
Run: `pnpm test`
Expected: All tests pass.
