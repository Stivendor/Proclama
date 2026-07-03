# Repertorio Colaborativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El líder de alabanza (sin cuenta) arma setlists desde un link con token, sincronizados con el Proclama del operador.

**Architecture:** Setlists migran de local-only (Dexie) a sync bidireccional Dexie ↔ Supabase (patrón `attendanceSync.ts`). Acceso anónimo del líder exclusivamente vía RPCs `security definer` validadas por token. Vista pública `/colaborar/:token` como ruta top-level (patrón `/projection`).

**Tech Stack:** React 18 + Vite + Dexie + Zustand + Supabase (RLS, RPC, Realtime) + @dnd-kit + vitest.

**Spec:** `docs/superpowers/specs/2026-07-03-repertorio-colaborativo-design.md`

## Global Constraints

- Gestor de paquetes: **pnpm** (nunca npm; package-lock.json rompe el build de Vercel).
- Tests: vitest, en `src/test/`, patrón de mocks de `src/test/songReport.test.ts` (spy sobre `supabase.from`/`supabase.rpc`).
- Migraciones SQL en `supabase/migrations/` con prefijo fecha `20260703...`. Se aplican vía MCP de Supabase (`apply_migration`) en el Task final, no antes.
- Textos de UI en español, como el resto de la app.
- RLS: ninguna política anónima directa sobre tablas; el token es la única puerta (via RPC).
- Convención commits: `feat(setlists): ...` estilo repo actual.

---

### Task 1: Migración SQL — tablas `setlists` y `collaborators`

**Files:**
- Create: `supabase/migrations/20260703000000_collab_setlists_tables.sql`

**Interfaces:**
- Produces: tablas `public.setlists` y `public.collaborators` con RLS de dueño; `setlists` en la publicación realtime. Los RPCs (Task 2) y el sync (Task 4) dependen de estas columnas exactas.

- [ ] **Step 1: Escribir la migración**

```sql
-- Repertorio colaborativo: setlists en la nube + colaboradores con token
-- Spec: docs/superpowers/specs/2026-07-03-repertorio-colaborativo-design.md

-- ─── setlists ────────────────────────────────────────────────────────────────
create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  date date,
  song_ids bigint[] not null default '{}',
  notes text,
  updated_by text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists setlists_user_id_idx on public.setlists (user_id);

alter table public.setlists enable row level security;

drop policy if exists "Owner full access on setlists" on public.setlists;
create policy "Owner full access on setlists"
  on public.setlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── collaborators ───────────────────────────────────────────────────────────
create table if not exists public.collaborators (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token text unique not null,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists collaborators_owner_id_idx on public.collaborators (owner_id);
create index if not exists collaborators_token_idx on public.collaborators (token);

alter table public.collaborators enable row level security;

drop policy if exists "Owner full access on collaborators" on public.collaborators;
create policy "Owner full access on collaborators"
  on public.collaborators for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ─── realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'setlists'
  ) then
    alter publication supabase_realtime add table public.setlists;
  end if;
end $$;
```

- [ ] **Step 2: Validar sintaxis localmente**

Run: `git diff --stat` (el archivo existe) y revisar que cada `create` tiene `if not exists` y que RLS queda habilitado en ambas tablas.
Expected: archivo nuevo, sin otras modificaciones. (La aplicación real a Supabase es el Task 9.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260703000000_collab_setlists_tables.sql
git commit -m "feat(setlists): tablas setlists y collaborators con RLS"
```

---

### Task 2: Migración SQL — RPCs anónimas validadas por token

**Files:**
- Create: `supabase/migrations/20260703000001_collab_rpcs.sql`

**Interfaces:**
- Consumes: tablas de Task 1.
- Produces: RPCs `collab_info(p_token)`, `collab_search_songs(p_token, p_query, p_offset)`, `collab_get_song(p_token, p_song_id)`, `collab_list_setlists(p_token)`, `collab_upsert_setlist(p_token, p_id, p_name, p_date, p_song_ids, p_notes)`, `collab_delete_setlist(p_token, p_id)`. El cliente (Task 6) las llama con `supabase.rpc(...)` usando estos nombres y parámetros exactos.

- [ ] **Step 1: Escribir la migración**

```sql
-- RPCs security definer para acceso anónimo del colaborador (token = llave)

-- Helper interno: valida token y devuelve (collaborator_id, owner_id, collab_name)
create or replace function public._collab_auth(p_token text)
returns table (collab_id uuid, owner_id uuid, collab_name text)
language plpgsql security definer set search_path = public
as $$
begin
  return query
    select c.id, c.owner_id, c.name
    from collaborators c
    where c.token = p_token and c.revoked_at is null;
  if not found then
    raise exception 'invalid_token' using errcode = '28000';
  end if;
  update collaborators set last_seen_at = now() where token = p_token;
end $$;

revoke all on function public._collab_auth(text) from public, anon, authenticated;

-- ─── collab_info ─────────────────────────────────────────────────────────────
create or replace function public.collab_info(p_token text)
returns table (collaborator_name text, church_name text)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_name text;
begin
  select a.owner_id, a.collab_name into v_owner, v_name from _collab_auth(p_token) a;
  return query
    select v_name, coalesce(p.settings->>'churchName', '')
    from profiles p where p.id = v_owner;
end $$;

-- ─── collab_search_songs ─────────────────────────────────────────────────────
-- Busca en songs: públicas verificadas + las del dueño. Paginado (30). Sin letras.
create or replace function public.collab_search_songs(
  p_token text, p_query text default '', p_offset int default 0
)
returns table (id bigint, title text, artist text, key text, language text)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_q text;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  v_q := '%' || trim(coalesce(p_query, '')) || '%';
  return query
    select s.id, s.title, s.artist, s.key, s.language
    from songs s
    where ((s.is_public = true and s.is_verified = true) or s.user_id = v_owner)
      and (trim(coalesce(p_query,'')) = '' or s.title ilike v_q or s.artist ilike v_q)
    order by s.usage_count desc nulls last, s.title asc
    limit 30 offset greatest(p_offset, 0);
end $$;

-- ─── collab_get_song ─────────────────────────────────────────────────────────
create or replace function public.collab_get_song(p_token text, p_song_id bigint)
returns table (id bigint, title text, artist text, key text, lyrics text)
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  return query
    select s.id, s.title, s.artist, s.key, s.lyrics
    from songs s
    where s.id = p_song_id
      and ((s.is_public = true and s.is_verified = true) or s.user_id = v_owner);
end $$;

-- ─── collab_list_setlists ────────────────────────────────────────────────────
create or replace function public.collab_list_setlists(p_token text)
returns setof public.setlists
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  return query
    select * from setlists where user_id = v_owner order by date desc nulls last, created_at desc;
end $$;

-- ─── collab_upsert_setlist ───────────────────────────────────────────────────
create or replace function public.collab_upsert_setlist(
  p_token text,
  p_id uuid,               -- null = crear
  p_name text,
  p_date date,
  p_song_ids bigint[],
  p_notes text
)
returns setof public.setlists
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid; v_name text; v_id uuid;
begin
  select a.owner_id, a.collab_name into v_owner, v_name from _collab_auth(p_token) a;
  if p_name is null or trim(p_name) = '' then
    raise exception 'name_required';
  end if;
  if p_id is null then
    insert into setlists (user_id, name, date, song_ids, notes, updated_by)
    values (v_owner, p_name, p_date, coalesce(p_song_ids, '{}'), p_notes, v_name)
    returning id into v_id;
  else
    update setlists
      set name = p_name, date = p_date, song_ids = coalesce(p_song_ids, '{}'),
          notes = p_notes, updated_by = v_name, updated_at = now()
      where id = p_id and user_id = v_owner
      returning id into v_id;
    if v_id is null then
      raise exception 'setlist_not_found';
    end if;
  end if;
  return query select * from setlists where id = v_id;
end $$;

-- ─── collab_delete_setlist ───────────────────────────────────────────────────
create or replace function public.collab_delete_setlist(p_token text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_owner uuid;
begin
  select a.owner_id into v_owner from _collab_auth(p_token) a;
  delete from setlists where id = p_id and user_id = v_owner;
  return found;
end $$;

-- Permisos: solo anon/authenticated pueden ejecutar las RPCs públicas
grant execute on function
  public.collab_info(text),
  public.collab_search_songs(text, text, int),
  public.collab_get_song(text, bigint),
  public.collab_list_setlists(text),
  public.collab_upsert_setlist(text, uuid, text, date, bigint[], text),
  public.collab_delete_setlist(text, uuid)
to anon, authenticated;
```

- [ ] **Step 2: Revisar seguridad**

Checklist manual: cada función tiene `security definer set search_path = public`; `_collab_auth` sin grant a anon; ninguna RPC devuelve `token` ni `owner_id`; `collab_get_song` re-verifica visibilidad de la canción.
Expected: los 4 puntos se cumplen.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260703000001_collab_rpcs.sql
git commit -m "feat(setlists): RPCs anonimas de colaborador validadas por token"
```

---

### Task 3: Tipos + esquema Dexie v11

**Files:**
- Modify: `src/types/index.ts` (interfaz `Setlist`, líneas 24-33)
- Modify: `src/db/index.ts` (agregar `version(11)`)

**Interfaces:**
- Produces: `Setlist` con `remoteId?: string`, `lastSyncedAt?: string`, `updatedBy?: string`; índice Dexie `remoteId` en `setlists`. El sync (Task 4) y la UI dependen de estos campos.

- [ ] **Step 1: Ampliar la interfaz `Setlist`**

En `src/types/index.ts` reemplazar la interfaz `Setlist` por:

```ts
// ─── Setlist ───────────────────────────────────────────────────────────────────
export interface Setlist {
  id?: number
  remoteId?: string   // UUID de Supabase (si está sincronizado)
  userId?: string     // UUID del usuario (Supabase)
  name: string
  date: Date
  songIds: number[]
  notes?: string
  updatedBy?: string      // 'owner' o nombre del colaborador que hizo el último cambio
  lastSyncedAt?: string   // ISO; si updatedAt > lastSyncedAt hay cambios pendientes de push
  createdAt: Date
  updatedAt: Date
}
```

- [ ] **Step 2: Bump de esquema Dexie**

En `src/db/index.ts`, después del bloque `this.version(10)...` agregar:

```ts
    this.version(11).stores({
      setlists: '++id, remoteId, name, date, userId, createdAt'
    })
```

- [ ] **Step 3: Verificar que compila**

Run: `pnpm tsc --noEmit`
Expected: sin errores nuevos (los campos son opcionales; el código existente no se rompe).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/db/index.ts
git commit -m "feat(setlists): campos de sync en Setlist y esquema Dexie v11"
```

---

### Task 4: Servicio `setlistSync` (Dexie ↔ Supabase) — TDD

**Files:**
- Create: `src/services/setlistSync.ts`
- Test: `src/test/setlistSync.test.ts`

**Interfaces:**
- Consumes: `db` de `@/db`, `supabase` de `@/services/supabase`, tipo `Setlist` (Task 3).
- Produces (usado por Tasks 5, 7, 8):
  - `splitSongIds(songIds: number[], remoteIdByLocal: Map<number, number>): { remote: number[]; localOnly: number[] }` (pura)
  - `mergeRemoteSongIds(remoteSongIds: number[], localByRemote: Map<number, number>, previousLocalOnly: number[]): number[]` (pura)
  - `resolveConflict(localUpdatedAt: Date, localLastSyncedAt: string | undefined, remoteUpdatedAt: string): 'push' | 'pull' | 'none'` (pura)
  - `pushSetlists(userId: string): Promise<{ synced: number; failed: number }>`
  - `pullSetlists(userId: string): Promise<{ pulled: number; skipped: number }>`
  - `deleteRemoteSetlist(remoteId: string): Promise<boolean>`

- [ ] **Step 1: Escribir tests de las funciones puras (fallan primero)**

`src/test/setlistSync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { splitSongIds, mergeRemoteSongIds, resolveConflict } from '@/services/setlistSync'

describe('splitSongIds', () => {
  it('separa canciones con remoteId de las solo-locales preservando orden', () => {
    const map = new Map<number, number>([[1, 100], [3, 300]])
    const r = splitSongIds([1, 2, 3], map)
    expect(r.remote).toEqual([100, 300])
    expect(r.localOnly).toEqual([2])
  })

  it('con todo mapeado no hay localOnly', () => {
    const map = new Map<number, number>([[5, 500]])
    expect(splitSongIds([5], map)).toEqual({ remote: [500], localOnly: [] })
  })
})

describe('mergeRemoteSongIds', () => {
  it('mapea remoteIds a ids locales y conserva las solo-locales al final', () => {
    const localByRemote = new Map<number, number>([[100, 1], [300, 3]])
    expect(mergeRemoteSongIds([300, 100], localByRemote, [2])).toEqual([3, 1, 2])
  })

  it('omite remoteIds sin cancion local (aun no sincronizada)', () => {
    const localByRemote = new Map<number, number>([[100, 1]])
    expect(mergeRemoteSongIds([100, 999], localByRemote, [])).toEqual([1])
  })
})

describe('resolveConflict', () => {
  it('push cuando lo local cambio despues del ultimo sync y lo remoto no es mas nuevo', () => {
    expect(resolveConflict(
      new Date('2026-07-03T12:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T10:00:00Z'
    )).toBe('push')
  })

  it('pull cuando lo remoto es mas nuevo que lo local', () => {
    expect(resolveConflict(
      new Date('2026-07-03T10:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T12:00:00Z'
    )).toBe('pull')
  })

  it('pull gana en conflicto simultaneo si lo remoto es mas nuevo (LWW)', () => {
    expect(resolveConflict(
      new Date('2026-07-03T11:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T12:00:00Z'
    )).toBe('pull')
  })

  it('none cuando no hay cambios en ningun lado', () => {
    expect(resolveConflict(
      new Date('2026-07-03T10:00:00Z'), '2026-07-03T10:00:00Z', '2026-07-03T10:00:00Z'
    )).toBe('none')
  })

  it('push cuando nunca se ha sincronizado (sin lastSyncedAt)', () => {
    expect(resolveConflict(
      new Date('2026-07-03T10:00:00Z'), undefined, '2026-07-03T09:00:00Z'
    )).toBe('push')
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm vitest run src/test/setlistSync.test.ts`
Expected: FAIL — `Cannot find module '@/services/setlistSync'` (o exports faltantes).

- [ ] **Step 3: Implementar `src/services/setlistSync.ts`**

```ts
import { db } from '@/db'
import { supabase } from '@/services/supabase'
import type { Setlist } from '@/types'

// ─── Funciones puras (testeables sin Dexie/Supabase) ─────────────────────────

/** Separa songIds locales en remoteIds (para la nube) y solo-locales (se quedan en Dexie). */
export function splitSongIds(
  songIds: number[],
  remoteIdByLocal: Map<number, number>
): { remote: number[]; localOnly: number[] } {
  const remote: number[] = []
  const localOnly: number[] = []
  for (const id of songIds) {
    const rid = remoteIdByLocal.get(id)
    if (rid != null) remote.push(rid)
    else localOnly.push(id)
  }
  return { remote, localOnly }
}

/** Convierte song_ids remotos a ids locales, conservando las canciones solo-locales al final. */
export function mergeRemoteSongIds(
  remoteSongIds: number[],
  localByRemote: Map<number, number>,
  previousLocalOnly: number[]
): number[] {
  const mapped = remoteSongIds
    .map(rid => localByRemote.get(rid))
    .filter((id): id is number => id != null)
  return [...mapped, ...previousLocalOnly]
}

/** Last-write-wins: decide la dirección del sync para un setlist. */
export function resolveConflict(
  localUpdatedAt: Date,
  localLastSyncedAt: string | undefined,
  remoteUpdatedAt: string
): 'push' | 'pull' | 'none' {
  const local = localUpdatedAt.getTime()
  const remote = new Date(remoteUpdatedAt).getTime()
  const synced = localLastSyncedAt ? new Date(localLastSyncedAt).getTime() : 0
  const localDirty = local > synced
  const remoteNewer = remote > synced
  if (remoteNewer && remote >= local) return 'pull'
  if (localDirty) return 'push'
  if (remoteNewer) return 'pull'
  return 'none'
}

// ─── Helpers Dexie ────────────────────────────────────────────────────────────

async function songMaps(): Promise<{ remoteIdByLocal: Map<number, number>; localByRemote: Map<number, number> }> {
  const songs = await db.songs.toArray()
  const remoteIdByLocal = new Map<number, number>()
  const localByRemote = new Map<number, number>()
  for (const s of songs) {
    if (s.id != null && s.remoteId != null) {
      remoteIdByLocal.set(s.id, s.remoteId)
      localByRemote.set(s.remoteId, s.id)
    }
  }
  return { remoteIdByLocal, localByRemote }
}

function rowToLocal(row: any, songIds: number[]): Omit<Setlist, 'id'> {
  return {
    remoteId: row.id,
    userId: row.user_id,
    name: row.name,
    date: row.date ? new Date(row.date + 'T00:00:00') : new Date(row.created_at),
    songIds,
    notes: row.notes ?? undefined,
    updatedBy: row.updated_by ?? 'owner',
    lastSyncedAt: row.updated_at,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

// ─── Push (local → Supabase) ─────────────────────────────────────────────────

export async function pushSetlists(userId: string): Promise<{ synced: number; failed: number }> {
  const all = await db.setlists.toArray()
  const pending = all.filter(sl =>
    !sl.remoteId || !sl.lastSyncedAt || sl.updatedAt.getTime() > new Date(sl.lastSyncedAt).getTime()
  )
  if (pending.length === 0) return { synced: 0, failed: 0 }

  const { remoteIdByLocal } = await songMaps()
  let synced = 0
  let failed = 0

  for (const sl of pending) {
    try {
      const { remote } = splitSongIds(sl.songIds, remoteIdByLocal)
      const payload: any = {
        user_id: userId,
        name: sl.name,
        date: sl.date ? new Date(sl.date).toISOString().slice(0, 10) : null,
        song_ids: remote,
        notes: sl.notes ?? null,
        updated_by: 'owner',
        updated_at: sl.updatedAt.toISOString(),
      }
      if (sl.remoteId) payload.id = sl.remoteId

      const { data, error } = await supabase
        .from('setlists')
        .upsert(payload, { onConflict: 'id' })
        .select('id, updated_at')
        .single()

      if (error || !data) {
        console.warn('[SetlistSync] Error upserting:', error?.message)
        failed++
        continue
      }
      if (sl.id != null) {
        await db.setlists.update(sl.id, { remoteId: data.id, lastSyncedAt: data.updated_at, userId })
      }
      synced++
    } catch (err) {
      console.warn('[SetlistSync] Unexpected error:', err)
      failed++
    }
  }
  console.log(`[SetlistSync] Push: ${synced} synced, ${failed} failed`)
  return { synced, failed }
}

// ─── Pull (Supabase → local) ─────────────────────────────────────────────────

export async function pullSetlists(userId: string): Promise<{ pulled: number; skipped: number }> {
  const { data: rows, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.warn('[SetlistSync] Pull failed:', error.message)
    return { pulled: 0, skipped: 0 }
  }
  if (!rows || rows.length === 0) return { pulled: 0, skipped: 0 }

  const { remoteIdByLocal, localByRemote } = await songMaps()
  const locals = await db.setlists.toArray()
  const localByRemoteId = new Map(locals.filter(l => l.remoteId).map(l => [l.remoteId!, l]))

  let pulled = 0
  let skipped = 0

  for (const row of rows) {
    const local = localByRemoteId.get(row.id)
    if (!local) {
      const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, [])
      await db.setlists.add(rowToLocal(row, songIds) as Setlist)
      pulled++
      continue
    }
    const action = resolveConflict(local.updatedAt, local.lastSyncedAt, row.updated_at)
    if (action !== 'pull') {
      skipped++
      continue
    }
    const { localOnly } = splitSongIds(local.songIds, remoteIdByLocal)
    const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, localOnly)
    await db.setlists.update(local.id!, { ...rowToLocal(row, songIds) })
    pulled++
  }
  console.log(`[SetlistSync] Pull: ${pulled} pulled, ${skipped} skipped`)
  return { pulled, skipped }
}

// ─── Delete remoto ───────────────────────────────────────────────────────────

export async function deleteRemoteSetlist(remoteId: string): Promise<boolean> {
  const { error } = await supabase.from('setlists').delete().eq('id', remoteId)
  if (error) {
    console.warn('[SetlistSync] Error deleting remote setlist:', error.message)
    return false
  }
  return true
}

/** Push + pull en orden. Llamar al iniciar sesión y al reconectar. */
export async function syncSetlists(userId: string): Promise<void> {
  await pushSetlists(userId)
  await pullSetlists(userId)
}
```

- [ ] **Step 4: Verificar que los tests pasan**

Run: `pnpm vitest run src/test/setlistSync.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/setlistSync.ts src/test/setlistSync.test.ts
git commit -m "feat(setlists): servicio de sync Dexie-Supabase con LWW"
```

---

### Task 5: Realtime + wiring del sync en la app

**Files:**
- Create: `src/hooks/useSetlistsRealtime.ts`
- Modify: `src/App.tsx` (AppContent, junto a `useSongsRealtime` línea 103)
- Modify: `src/pages/SetlistsView.tsx` (mutaciones: `createSetlist`, `confirmDeleteSetlist`, `updateSetlistInState`)

**Interfaces:**
- Consumes: `pushSetlists`, `syncSetlists`, `deleteRemoteSetlist`, `mergeRemoteSongIds`, `splitSongIds`, `resolveConflict` de `@/services/setlistSync` (Task 4).
- Produces: `useSetlistsRealtime(userId: string | undefined): void`.

- [ ] **Step 1: Crear `src/hooks/useSetlistsRealtime.ts`** (patrón `useAttendanceRealtime`)

```ts
import { useEffect } from 'react'
import { supabase } from '@/services/supabase'
import { db } from '@/db'
import { splitSongIds, mergeRemoteSongIds, resolveConflict } from '@/services/setlistSync'
import type { Setlist } from '@/types'

export function useSetlistsRealtime(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`setlists_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'setlists', filter: `user_id=eq.${userId}` },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as any
            const songs = await db.songs.toArray()
            const remoteIdByLocal = new Map<number, number>()
            const localByRemote = new Map<number, number>()
            for (const s of songs) {
              if (s.id != null && s.remoteId != null) {
                remoteIdByLocal.set(s.id, s.remoteId)
                localByRemote.set(s.remoteId, s.id)
              }
            }

            const local = await db.setlists.where('remoteId').equals(row.id).first()
            if (!local) {
              const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, [])
              await db.setlists.add({
                remoteId: row.id,
                userId: row.user_id,
                name: row.name,
                date: row.date ? new Date(row.date + 'T00:00:00') : new Date(row.created_at),
                songIds,
                notes: row.notes ?? undefined,
                updatedBy: row.updated_by ?? 'owner',
                lastSyncedAt: row.updated_at,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
              } as Setlist)
              return
            }
            if (resolveConflict(local.updatedAt, local.lastSyncedAt, row.updated_at) !== 'pull') return
            const { localOnly } = splitSongIds(local.songIds, remoteIdByLocal)
            const songIds = mergeRemoteSongIds(row.song_ids ?? [], localByRemote, localOnly)
            await db.setlists.update(local.id!, {
              name: row.name,
              date: row.date ? new Date(row.date + 'T00:00:00') : local.date,
              songIds,
              notes: row.notes ?? undefined,
              updatedBy: row.updated_by ?? 'owner',
              lastSyncedAt: row.updated_at,
              updatedAt: new Date(row.updated_at),
            })
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id as string | undefined
            if (!deletedId) return
            const local = await db.setlists.where('remoteId').equals(deletedId).first()
            if (local?.id != null) await db.setlists.delete(local.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
}
```

- [ ] **Step 2: Wire en `App.tsx`**

En `AppContent`, junto a `useSongsRealtime(user?.id)` (línea 103), agregar:

```tsx
import { useSetlistsRealtime } from "@/hooks/useSetlistsRealtime";
```

```tsx
  useSongsRealtime(user?.id);
  useSetlistsRealtime(user?.id);

  // Sync inicial de setlists al tener sesión
  useEffect(() => {
    if (!user?.id) return;
    import("@/services/setlistSync").then(({ syncSetlists }) =>
      syncSetlists(user.id).catch((e) => console.warn("[SetlistSync] initial sync failed", e))
    );
  }, [user?.id]);
```

- [ ] **Step 3: Push tras mutaciones en `SetlistsView.tsx`**

Agregar al inicio del archivo:

```ts
import { pushSetlists, deleteRemoteSetlist } from '@/services/setlistSync'
```

Dentro del componente, helper (después de los `useState`):

```ts
  const schedulePush = () => {
    if (!user?.id) return
    // ponytail: push directo tras cada mutación; debounce solo si se nota en red
    pushSetlists(user.id).catch(e => console.warn('[SetlistSync] push failed', e))
  }
```

- En `createSetlist`: después de `await db.setlists.add(newSl as Setlist)` agregar `schedulePush()`.
- En `updateSetlistInState`: después de `await db.setlists.update(id, updates)` agregar `schedulePush()`.
- En `confirmDeleteSetlist`: antes de `await db.setlists.delete(sl.id)` agregar:

```ts
    if (sl.remoteId) deleteRemoteSetlist(sl.remoteId).catch(() => {})
```

- [ ] **Step 4: Verificar compilación y tests existentes**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: compila, todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSetlistsRealtime.ts src/App.tsx src/pages/SetlistsView.tsx
git commit -m "feat(setlists): realtime y push/pull automatico de setlists"
```

---

### Task 6: Servicio cliente de colaboradores — TDD

**Files:**
- Create: `src/services/collab.ts`
- Test: `src/test/collab.test.ts`

**Interfaces:**
- Consumes: `supabase` de `@/services/supabase`; RPCs de Task 2.
- Produces (usado por Tasks 7 y 8):
  - `generateToken(): string` (32 bytes aleatorios, base64url)
  - `createCollaborator(ownerId: string, name: string): Promise<{ id: string; token: string } | null>`
  - `listCollaborators(ownerId: string): Promise<CollaboratorRow[]>`
  - `revokeCollaborator(id: string): Promise<boolean>`
  - `collabInfo(token: string): Promise<{ collaboratorName: string; churchName: string } | null>`
  - `collabSearchSongs(token: string, query: string, offset: number): Promise<CollabSong[]>`
  - `collabGetSong(token: string, songId: number): Promise<CollabSongFull | null>`
  - `collabListSetlists(token: string): Promise<CollabSetlist[]>`
  - `collabUpsertSetlist(token: string, sl: { id?: string; name: string; date: string | null; songIds: number[]; notes: string | null }): Promise<CollabSetlist | null>`
  - `collabDeleteSetlist(token: string, id: string): Promise<boolean>`
  - Tipos exportados: `CollaboratorRow`, `CollabSong`, `CollabSongFull`, `CollabSetlist`

- [ ] **Step 1: Escribir tests (fallan primero)**

`src/test/collab.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/services/supabase'
import { generateToken, collabInfo, collabUpsertSetlist, createCollaborator } from '@/services/collab'

afterEach(() => vi.restoreAllMocks())

describe('generateToken', () => {
  it('genera tokens url-safe de al menos 40 chars, distintos entre si', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(40)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('collabInfo', () => {
  it('mapea la respuesta del RPC', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ collaborator_name: 'Juan', church_name: 'Casa de Fe' }],
      error: null,
    } as any)
    const info = await collabInfo('tok123')
    expect(supabase.rpc).toHaveBeenCalledWith('collab_info', { p_token: 'tok123' })
    expect(info).toEqual({ collaboratorName: 'Juan', churchName: 'Casa de Fe' })
  })

  it('devuelve null si el token es invalido (error del RPC)', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: { message: 'invalid_token' } } as any)
    expect(await collabInfo('bad')).toBeNull()
  })
})

describe('collabUpsertSetlist', () => {
  it('envia los parametros con nombres exactos del RPC', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ id: 'u1', name: 'Domingo', date: '2026-07-12', song_ids: [100], notes: null, updated_by: 'Juan', updated_at: 'x', created_at: 'x', user_id: 'o1' }],
      error: null,
    } as any)
    const r = await collabUpsertSetlist('tok', { name: 'Domingo', date: '2026-07-12', songIds: [100], notes: null })
    expect(supabase.rpc).toHaveBeenCalledWith('collab_upsert_setlist', {
      p_token: 'tok', p_id: null, p_name: 'Domingo', p_date: '2026-07-12', p_song_ids: [100], p_notes: null,
    })
    expect(r?.id).toBe('u1')
  })
})

describe('createCollaborator', () => {
  it('inserta con token generado y devuelve id y token', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'c1', token: 'tokX' }, error: null })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const insertMock = vi.fn().mockReturnValue({ select: selectMock })
    vi.spyOn(supabase, 'from').mockReturnValue({ insert: insertMock } as any)

    const r = await createCollaborator('owner1', 'Juan')
    expect(supabase.from).toHaveBeenCalledWith('collaborators')
    const inserted = insertMock.mock.calls[0][0]
    expect(inserted.owner_id).toBe('owner1')
    expect(inserted.name).toBe('Juan')
    expect(inserted.token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(r).toEqual({ id: 'c1', token: 'tokX' })
  })
})
```

- [ ] **Step 2: Verificar que fallan**

Run: `pnpm vitest run src/test/collab.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `src/services/collab.ts`**

```ts
import { supabase } from '@/services/supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type CollaboratorRow = {
  id: string
  name: string
  token: string
  revokedAt: string | null
  lastSeenAt: string | null
  createdAt: string
}

export type CollabSong = { id: number; title: string; artist: string; key: string; language: string }
export type CollabSongFull = { id: number; title: string; artist: string; key: string; lyrics: string }

export type CollabSetlist = {
  id: string
  name: string
  date: string | null       // 'YYYY-MM-DD'
  songIds: number[]          // remoteIds de songs
  notes: string | null
  updatedBy: string
  updatedAt: string
}

// ─── Token ────────────────────────────────────────────────────────────────────
export function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ─── Gestión (operador autenticado, RLS directo) ─────────────────────────────
export async function createCollaborator(
  ownerId: string,
  name: string
): Promise<{ id: string; token: string } | null> {
  const token = generateToken()
  const { data, error } = await supabase
    .from('collaborators')
    .insert({ owner_id: ownerId, name: name.trim(), token })
    .select('id, token')
    .single()
  if (error || !data) {
    console.warn('[Collab] Error creating collaborator:', error?.message)
    return null
  }
  return { id: data.id, token: data.token }
}

export async function listCollaborators(ownerId: string): Promise<CollaboratorRow[]> {
  const { data, error } = await supabase
    .from('collaborators')
    .select('id, name, token, revoked_at, last_seen_at, created_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((r: any) => ({
    id: r.id, name: r.name, token: r.token,
    revokedAt: r.revoked_at, lastSeenAt: r.last_seen_at, createdAt: r.created_at,
  }))
}

export async function revokeCollaborator(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('collaborators')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  return !error
}

export function collabLink(token: string): string {
  return `${window.location.origin}/colaborar/${token}`
}

// ─── Vista pública (anónimo, via RPC) ─────────────────────────────────────────
function mapSetlistRow(r: any): CollabSetlist {
  return {
    id: r.id, name: r.name, date: r.date,
    songIds: r.song_ids ?? [], notes: r.notes,
    updatedBy: r.updated_by ?? 'owner', updatedAt: r.updated_at,
  }
}

export async function collabInfo(token: string): Promise<{ collaboratorName: string; churchName: string } | null> {
  const { data, error } = await supabase.rpc('collab_info', { p_token: token })
  if (error || !data || data.length === 0) return null
  return { collaboratorName: data[0].collaborator_name, churchName: data[0].church_name }
}

export async function collabSearchSongs(token: string, query: string, offset = 0): Promise<CollabSong[]> {
  const { data, error } = await supabase.rpc('collab_search_songs', {
    p_token: token, p_query: query, p_offset: offset,
  })
  if (error || !data) return []
  return data as CollabSong[]
}

export async function collabGetSong(token: string, songId: number): Promise<CollabSongFull | null> {
  const { data, error } = await supabase.rpc('collab_get_song', { p_token: token, p_song_id: songId })
  if (error || !data || data.length === 0) return null
  return data[0] as CollabSongFull
}

export async function collabListSetlists(token: string): Promise<CollabSetlist[]> {
  const { data, error } = await supabase.rpc('collab_list_setlists', { p_token: token })
  if (error || !data) return []
  return data.map(mapSetlistRow)
}

export async function collabUpsertSetlist(
  token: string,
  sl: { id?: string; name: string; date: string | null; songIds: number[]; notes: string | null }
): Promise<CollabSetlist | null> {
  const { data, error } = await supabase.rpc('collab_upsert_setlist', {
    p_token: token,
    p_id: sl.id ?? null,
    p_name: sl.name,
    p_date: sl.date,
    p_song_ids: sl.songIds,
    p_notes: sl.notes,
  })
  if (error || !data || data.length === 0) {
    console.warn('[Collab] upsert failed:', error?.message)
    return null
  }
  return mapSetlistRow(data[0])
}

export async function collabDeleteSetlist(token: string, id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('collab_delete_setlist', { p_token: token, p_id: id })
  return !error && data === true
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `pnpm vitest run src/test/collab.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/collab.ts src/test/collab.test.ts
git commit -m "feat(setlists): servicio cliente de colaboradores y RPCs"
```

---

### Task 7: Vista pública `/colaborar/:token`

**Files:**
- Create: `src/pages/CollabView.tsx`
- Modify: `src/App.tsx` (agregar Route top-level junto a `/projection`)

**Interfaces:**
- Consumes: todo `@/services/collab` (Task 6); `@dnd-kit` (ya instalado); clases CSS existentes (`setlist-song-item`, `btn-icon-xs`, etc. de `index.css`).
- Produces: componente default `CollabView` montado en `/colaborar/:token`.

- [ ] **Step 1: Crear `src/pages/CollabView.tsx`**

```tsx
import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, GripVertical, Search, X, Music, Eye, ArrowLeft } from 'lucide-react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  collabInfo, collabSearchSongs, collabGetSong, collabListSetlists,
  collabUpsertSetlist, collabDeleteSetlist,
  type CollabSong, type CollabSetlist, type CollabSongFull,
} from '@/services/collab'

type Status = 'loading' | 'ok' | 'invalid'

function SortableRow({ song, onRemove, onView }: {
  song: CollabSong | undefined & { id: number }
  onRemove: () => void
  onView: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: song!.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="setlist-song-item">
      <span className="drag-handle" {...attributes} {...listeners}><GripVertical size={14} /></span>
      <div className="setlist-song-info">
        <span className="setlist-song-name">{song?.title ?? '...'}</span>
        {song?.artist && <span className="setlist-song-artist">{song.artist}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {song?.key && <span className="song-key-sm">{song.key}</span>}
        <button className="btn-icon-xs" onClick={onView} title="Ver letra"><Eye size={12} /></button>
        <button className="btn-icon-xs danger" onClick={onRemove} title="Quitar"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

export default function CollabView() {
  const { token = '' } = useParams<{ token: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [who, setWho] = useState<{ collaboratorName: string; churchName: string } | null>(null)
  const [setlists, setSetlists] = useState<CollabSetlist[]>([])
  const [editing, setEditing] = useState<CollabSetlist | null>(null)
  const [songCache, setSongCache] = useState<Map<number, CollabSong>>(new Map())
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<CollabSong[]>([])
  const [viewingSong, setViewingSong] = useState<CollabSongFull | null>(null)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [newName, setNewName] = useState('')

  const sensors = useSensors(useSensor(PointerSensor))

  const refreshSetlists = useCallback(async () => {
    const lists = await collabListSetlists(token)
    setSetlists(lists)
    // cachear datos de las canciones referenciadas que no tengamos
    const missing = new Set<number>()
    for (const sl of lists) for (const id of sl.songIds) if (!songCache.has(id)) missing.add(id)
    if (missing.size > 0) {
      const found = new Map(songCache)
      // ponytail: N consultas de a 1 via collab_get_song sería peor; búsqueda vacía
      // pagina por popularidad y no garantiza traerlas — se cargan on-demand al ver la letra.
      // Para el listado basta id; título se completa con collab_get_song en paralelo (máx 50).
      const ids = [...missing].slice(0, 50)
      const songs = await Promise.all(ids.map(id => collabGetSong(token, id)))
      songs.forEach(s => { if (s) found.set(s.id, { id: s.id, title: s.title, artist: s.artist, key: s.key, language: '' }) })
      setSongCache(found)
    }
  }, [token, songCache])

  // Carga inicial + validación del token
  useEffect(() => {
    let alive = true
    ;(async () => {
      const info = await collabInfo(token)
      if (!alive) return
      if (!info) { setStatus('invalid'); return }
      setWho(info)
      setStatus('ok')
      await refreshSetlists()
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Refetch al volver el foco a la pestaña
  useEffect(() => {
    const onFocus = () => { if (status === 'ok' && !editing) refreshSetlists() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [status, editing, refreshSetlists])

  // Búsqueda con debounce
  useEffect(() => {
    if (!editing) return
    const t = setTimeout(async () => {
      const r = await collabSearchSongs(token, search, 0)
      setResults(r)
      setSongCache(prev => {
        const next = new Map(prev)
        r.forEach(s => next.set(s.id, s))
        return next
      })
    }, 300)
    return () => clearTimeout(t)
  }, [search, editing, token])

  const save = async (updated: CollabSetlist) => {
    setSaveState('saving')
    const saved = await collabUpsertSetlist(token, {
      id: updated.id || undefined,
      name: updated.name,
      date: updated.date,
      songIds: updated.songIds,
      notes: updated.notes,
    })
    if (saved) {
      setSaveState('saved')
      setEditing(saved)
      setSetlists(prev => prev.map(s => (s.id === saved.id ? saved : s)))
    } else {
      setSaveState('error')
    }
  }

  const createSetlist = async () => {
    if (!newName.trim()) return
    const created = await collabUpsertSetlist(token, {
      name: newName.trim(), date: new Date().toISOString().slice(0, 10), songIds: [], notes: null,
    })
    if (created) {
      setNewName('')
      setSetlists(prev => [created, ...prev])
      setEditing(created)
    }
  }

  if (status === 'loading') return <div className="collab-page"><p>Cargando…</p></div>

  if (status === 'invalid') {
    return (
      <div className="collab-page collab-invalid">
        <Music size={40} />
        <h2>Enlace no válido</h2>
        <p>Este enlace fue revocado o no existe. Pide uno nuevo al administrador de Proclama.</p>
      </div>
    )
  }

  return (
    <div className="collab-page">
      <header className="collab-header">
        <div>
          <h1>Hola, {who?.collaboratorName}</h1>
          <p>{who?.churchName}</p>
        </div>
        {editing && (
          <span className={`collab-save-state ${saveState}`}>
            {saveState === 'saving' ? 'Guardando…' : saveState === 'error' ? 'Sin conexión — reintenta' : 'Guardado'}
          </span>
        )}
      </header>

      {!editing ? (
        <section>
          <div className="collab-new">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createSetlist()}
              placeholder="Nombre del repertorio (ej. Domingo 12 julio)"
            />
            <button className="btn-primary" onClick={createSetlist}><Plus size={16} /> Nuevo</button>
          </div>
          <div className="collab-list">
            {setlists.map(sl => (
              <button key={sl.id} className="collab-setlist-card" onClick={() => { setSearch(''); setResults([]); setEditing(sl) }}>
                <strong>{sl.name}</strong>
                <span>{sl.date ?? ''} · {sl.songIds.length} canciones</span>
              </button>
            ))}
            {setlists.length === 0 && <p className="collab-empty">Aún no hay repertorios. Crea el primero.</p>}
          </div>
        </section>
      ) : (
        <section className="collab-editor">
          <button className="btn-ghost" onClick={() => { setEditing(null); refreshSetlists() }}>
            <ArrowLeft size={14} /> Volver
          </button>

          <input
            className="collab-name-input"
            value={editing.name}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            onBlur={() => save(editing)}
          />
          <input
            type="date"
            value={editing.date ?? ''}
            onChange={e => { const u = { ...editing, date: e.target.value || null }; setEditing(u); save(u) }}
          />

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(ev) => {
            const { active, over } = ev
            if (over && active.id !== over.id) {
              const oldI = editing.songIds.indexOf(Number(active.id))
              const newI = editing.songIds.indexOf(Number(over.id))
              const u = { ...editing, songIds: arrayMove(editing.songIds, oldI, newI) }
              setEditing(u)
              save(u)
            }
          }}>
            <SortableContext items={editing.songIds} strategy={verticalListSortingStrategy}>
              {editing.songIds.map(id => (
                <SortableRow
                  key={id}
                  song={songCache.get(id) as any ?? { id, title: `Canción #${id}`, artist: '', key: '', language: '' }}
                  onRemove={() => { const u = { ...editing, songIds: editing.songIds.filter(x => x !== id) }; setEditing(u); save(u) }}
                  onView={async () => setViewingSong(await collabGetSong(token, id))}
                />
              ))}
            </SortableContext>
          </DndContext>

          <div className="collab-search">
            <Search size={14} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar canción para agregar…"
            />
          </div>
          <div className="collab-results">
            {results.filter(s => !editing.songIds.includes(s.id)).map(s => (
              <div key={s.id} className="setlist-song-item" onClick={() => {
                const u = { ...editing, songIds: [...editing.songIds, s.id] }
                setEditing(u)
                save(u)
              }}>
                <div className="setlist-song-info">
                  <span className="setlist-song-name">{s.title}</span>
                  {s.artist && <span className="setlist-song-artist">{s.artist}</span>}
                </div>
                <Plus size={14} />
              </div>
            ))}
          </div>

          <textarea
            className="collab-notes"
            value={editing.notes ?? ''}
            onChange={e => setEditing({ ...editing, notes: e.target.value })}
            onBlur={() => save(editing)}
            placeholder="Notas para el servicio…"
          />

          <button
            className="btn-danger-ghost"
            onClick={async () => {
              if (!confirm('¿Eliminar este repertorio?')) return
              await collabDeleteSetlist(token, editing.id)
              setEditing(null)
              refreshSetlists()
            }}
          >
            <Trash2 size={14} /> Eliminar repertorio
          </button>
        </section>
      )}

      {viewingSong && (
        <div className="modal-overlay" onClick={() => setViewingSong(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{viewingSong.title}</h3>
              <button className="btn-icon-xs" onClick={() => setViewingSong(null)}><X size={14} /></button>
            </div>
            <pre className="collab-lyrics">{viewingSong.lyrics}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Estilos mínimos**

Agregar al final de `src/index.css`:

```css
/* ─── Vista pública de colaborador ─── */
.collab-page { max-width: 640px; margin: 0 auto; padding: 16px; min-height: 100vh; }
.collab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.collab-header h1 { font-size: 1.2rem; margin: 0; }
.collab-header p { margin: 0; opacity: .7; font-size: .85rem; }
.collab-invalid { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 8px; }
.collab-new { display: flex; gap: 8px; margin-bottom: 12px; }
.collab-new input { flex: 1; }
.collab-list { display: flex; flex-direction: column; gap: 8px; }
.collab-setlist-card { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color, #333); background: transparent; color: inherit; cursor: pointer; text-align: left; }
.collab-empty { opacity: .6; text-align: center; padding: 24px 0; }
.collab-editor { display: flex; flex-direction: column; gap: 10px; }
.collab-name-input { font-size: 1.1rem; font-weight: 600; }
.collab-search { display: flex; align-items: center; gap: 6px; }
.collab-search input { flex: 1; }
.collab-results { display: flex; flex-direction: column; gap: 4px; max-height: 40vh; overflow-y: auto; }
.collab-notes { min-height: 70px; }
.collab-save-state.saving { opacity: .7; }
.collab-save-state.error { color: #e5484d; }
.collab-lyrics { white-space: pre-wrap; max-height: 60vh; overflow-y: auto; font-family: inherit; }
```

- [ ] **Step 3: Registrar la ruta en `App.tsx`**

Agregar el lazy import junto a los demás:

```tsx
const CollabView = lazy(() => import("@/pages/CollabView"));
```

Y en `<Routes>` (top-level, antes de `/*`):

```tsx
        <Route path="/colaborar/:token" element={
          <Suspense fallback={null}><CollabView /></Suspense>
        } />
```

- [ ] **Step 4: Verificar compilación y arranque**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: build OK. (Prueba funcional real en Task 9, cuando las RPCs existan en Supabase.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/CollabView.tsx src/App.tsx src/index.css
git commit -m "feat(setlists): vista publica /colaborar/:token para lider de alabanza"
```

---

### Task 8: Gestión de colaboradores en SetlistsView

**Files:**
- Create: `src/components/setlists/CollaboratorsModal.tsx`
- Modify: `src/pages/SetlistsView.tsx` (botón para abrir el modal en el header de la vista)

**Interfaces:**
- Consumes: `createCollaborator`, `listCollaborators`, `revokeCollaborator`, `collabLink`, tipo `CollaboratorRow` de `@/services/collab` (Task 6); `user` del store.
- Produces: `<CollaboratorsModal open onClose={...} ownerId={...} />`.

- [ ] **Step 1: Crear `src/components/setlists/CollaboratorsModal.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { X, Copy, Check, UserPlus, Ban } from 'lucide-react'
import {
  createCollaborator, listCollaborators, revokeCollaborator, collabLink,
  type CollaboratorRow,
} from '@/services/collab'

export default function CollaboratorsModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const [rows, setRows] = useState<CollaboratorRow[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const refresh = () => listCollaborators(ownerId).then(setRows)
  useEffect(() => { refresh() }, [ownerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    const created = await createCollaborator(ownerId, name)
    setBusy(false)
    if (created) {
      setName('')
      await refresh()
      copy(created.id, created.token)
    } else {
      alert('No se pudo crear el colaborador. Revisa tu conexión.')
    }
  }

  const copy = (id: string, token: string) => {
    navigator.clipboard.writeText(collabLink(token))
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const revoke = async (row: CollaboratorRow) => {
    if (!confirm(`¿Revocar el acceso de "${row.name}"? Su enlace dejará de funcionar.`)) return
    await revokeCollaborator(row.id)
    refresh()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Colaboradores</h3>
          <button className="btn-icon-xs" onClick={onClose}><X size={14} /></button>
        </div>

        <p style={{ fontSize: '.85rem', opacity: .75 }}>
          Comparte un enlace para que el líder de alabanza arme los repertorios desde su casa,
          sin necesidad de cuenta. Los cambios se sincronizan solos.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Nombre (ej. Juan — alabanza)"
            style={{ flex: 1 }}
          />
          <button className="btn-primary" onClick={create} disabled={busy}>
            <UserPlus size={14} /> Crear enlace
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
          {rows.map(r => (
            <div key={r.id} className="setlist-song-item" style={{ cursor: 'default', opacity: r.revokedAt ? .5 : 1 }}>
              <div className="setlist-song-info">
                <span className="setlist-song-name">{r.name}{r.revokedAt ? ' (revocado)' : ''}</span>
                <span className="setlist-song-artist">
                  {r.lastSeenAt ? `Último acceso: ${new Date(r.lastSeenAt).toLocaleDateString()}` : 'Nunca ha entrado'}
                </span>
              </div>
              {!r.revokedAt && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn-icon-xs" title="Copiar enlace" onClick={() => copy(r.id, r.token)}>
                    {copiedId === r.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                  <button className="btn-icon-xs danger" title="Revocar acceso" onClick={() => revoke(r)}>
                    <Ban size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <p style={{ opacity: .6, textAlign: 'center' }}>Sin colaboradores todavía.</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Botón en `SetlistsView.tsx`**

Imports:

```tsx
import { Users } from 'lucide-react'
import CollaboratorsModal from '@/components/setlists/CollaboratorsModal'
```

Estado (junto a los otros `useState`):

```tsx
  const [showCollabs, setShowCollabs] = useState(false)
```

En el header de la vista (junto al botón de crear setlist — localizar el toolbar existente del listado), agregar:

```tsx
        {user?.id && (
          <button className="btn-ghost" onClick={() => setShowCollabs(true)} title="Colaboradores">
            <Users size={16} /> Colaboradores
          </button>
        )}
```

Y al final del JSX del componente (junto a los otros modales):

```tsx
      {showCollabs && user?.id && (
        <CollaboratorsModal ownerId={user.id} onClose={() => setShowCollabs(false)} />
      )}
```

- [ ] **Step 3: Verificar**

Run: `pnpm tsc --noEmit && pnpm vitest run`
Expected: compila y todos los tests pasan.

- [ ] **Step 4: Commit**

```bash
git add src/components/setlists/CollaboratorsModal.tsx src/pages/SetlistsView.tsx
git commit -m "feat(setlists): gestion de colaboradores (crear link, copiar, revocar)"
```

---

### Task 9: Aplicar migraciones y verificación end-to-end

**Files:**
- Ninguno nuevo (aplicación de migraciones + verificación).

**Interfaces:**
- Consumes: migraciones de Tasks 1-2, todo lo anterior.

- [ ] **Step 1: Aplicar migraciones a Supabase**

Vía MCP de Supabase: `apply_migration` con el contenido de `20260703000000_collab_setlists_tables.sql` y luego `20260703000001_collab_rpcs.sql` (en ese orden).
Expected: ambas aplican sin error.

- [ ] **Step 2: Auditoría de seguridad**

Vía MCP: `get_advisors` (security).
Expected: sin advertencias nuevas sobre `setlists`, `collaborators` ni funciones `collab_*` (RLS habilitado, `search_path` fijado). Si aparece alguna, corregirla con una migración adicional antes de continuar.

- [ ] **Step 3: Test suite completa + build**

Run: `pnpm vitest run && pnpm build`
Expected: todos los tests pasan, build OK.

- [ ] **Step 4: Prueba funcional del flujo completo**

Con `pnpm dev`:
1. Login como operador → Setlists → Colaboradores → crear "Juan" → copiar link.
2. Abrir el link en ventana de incógnito → debe saludar "Hola, Juan" con el nombre de la iglesia.
3. Crear repertorio "Prueba domingo", buscar una canción (ej. "espíritu"), agregarla, reordenar, escribir nota.
4. En la ventana del operador: el setlist "Prueba domingo" aparece en Setlists (realtime) con la canción.
5. Operador agrega otra canción localmente → refrescar la pestaña del líder (o cambiar de foco) → la ve.
6. Revocar a Juan → recargar el link → pantalla "Enlace no válido".

Expected: los 6 pasos funcionan.

- [ ] **Step 5: Commit final (si hubo ajustes) y cierre**

```bash
git add -A
git commit -m "feat(setlists): repertorio colaborativo end-to-end"
```

Luego usar la skill superpowers:finishing-a-development-branch para decidir merge/PR.

---

## Self-review (hecho al escribir el plan)

- **Cobertura del spec:** tablas+RLS (T1), RPCs (T2), tipos/Dexie (T3), sync LWW + canciones solo-locales (T4), realtime operador + refetch líder (T5), cliente (T6), vista pública con búsqueda paginada/letras read-only/autosave/pantalla de token inválido (T7), gestión crear/copiar/revocar/último acceso (T8), advisors+e2e (T9). ✓
- **Placeholders:** ninguno; todo step de código incluye el código. ✓
- **Consistencia de tipos:** nombres de RPC y parámetros (`p_token`, `p_id`, `p_name`, `p_date`, `p_song_ids`, `p_notes`) idénticos en T2, T6 y tests; `CollabSetlist.songIds` = remoteIds en toda la vista pública; `Setlist.songIds` = ids locales en Dexie, mapeados solo en `setlistSync`. ✓
