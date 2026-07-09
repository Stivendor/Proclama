# Actividad de Usuarios en Panel Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar un heartbeat diario por usuario logueado y mostrar en el panel admin quién usa más Proclama (días activos, última actividad, DAU).

**Architecture:** Tabla `user_activity (user_id, day)` con upsert diario desde el cliente (guard localStorage). Lectura admin vía dos RPCs `security definer` con check de rol. UI integrada en DashboardPage (pill "Activos hoy", chart DAU, Top 10) y UsersPage (dos columnas).

**Tech Stack:** Supabase (Postgres + RLS + RPC), React 18 + TS, Recharts (ya instalado), Vitest.

## Global Constraints

- Usar **pnpm siempre**, nunca npm (un `package-lock.json` rompe el build de Vercel).
- Supabase: snake_case en DB ↔ camelCase en frontend (mapeo en services).
- Tests unitarios en `src/test/` (jsdom). Comando: `pnpm vitest --run src/test/<file>.test.ts`.
- Type check rápido: `pnpm tsc --noEmit`.
- Spec: `docs/superpowers/specs/2026-07-08-user-activity-analytics-design.md`.
- Los invitados (sin login) no se trackean.

---

### Task 1: Migración SQL — tabla, RLS y RPCs

**Files:**
- Create: `supabase/migrations/20260708000000_user_activity.sql`
- Modify: `docs/SUPABASE.md` (añadir la tabla a la lista, junto a la línea de `user_devices`, ~línea 105)

**Interfaces:**
- Produces: tabla `public.user_activity(user_id uuid, day date)`; RPC `admin_user_activity(days_back int)` → `(user_id, email, full_name, active_days, last_active)`; RPC `admin_daily_active_users(days_back int)` → `(day, count)`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Migration: user_activity heartbeat table + admin RPCs
-- Date: 2026-07-08
-- Description: Registra un heartbeat diario por usuario para saber quién usa
-- más la app. Los usuarios solo insertan su propia fila; la lectura es solo
-- para admins vía RPCs security definer.

create table if not exists public.user_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  primary key (user_id, day)
);

create index if not exists user_activity_day_idx on public.user_activity (day);

alter table public.user_activity enable row level security;

drop policy if exists "Users can insert own activity" on public.user_activity;
create policy "Users can insert own activity"
  on public.user_activity for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Sin policy de SELECT: los usuarios no leen esta tabla; los admins leen vía RPC.

-- Por usuario: días activos en la ventana y última actividad.
-- Fallback: mientras user_activity acumula datos, last_active usa también
-- user_devices.last_seen (GREATEST ignora NULLs).
create or replace function public.admin_user_activity(days_back int default 30)
returns table (
  user_id uuid,
  email text,
  full_name text,
  active_days bigint,
  last_active timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id,
         p.email,
         p.full_name,
         count(distinct a.day) as active_days,
         greatest(max(a.day)::timestamptz, max(d.last_seen)) as last_active
  from public.profiles p
  left join public.user_activity a
    on a.user_id = p.id and a.day >= current_date - days_back
  left join public.user_devices d
    on d.user_id = p.id
  where exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  )
  group by p.id, p.email, p.full_name
  order by active_days desc, last_active desc nulls last;
$$;

-- Serie DAU: usuarios distintos por día en la ventana.
create or replace function public.admin_daily_active_users(days_back int default 30)
returns table (day date, count bigint)
language sql
security definer
set search_path = public
as $$
  select a.day, count(distinct a.user_id)
  from public.user_activity a
  where a.day >= current_date - days_back
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role = 'admin'
    )
  group by a.day
  order by a.day;
$$;
```

- [ ] **Step 2: Aplicar la migración al proyecto Supabase**

Usar el MCP de Supabase: `apply_migration` con name `user_activity` y el SQL anterior.

- [ ] **Step 3: Verificar**

Ejecutar vía `execute_sql`:

```sql
select count(*) from public.user_activity;
select proname from pg_proc where proname in ('admin_user_activity', 'admin_daily_active_users');
```

Expected: `0` y las dos funciones listadas.

- [ ] **Step 4: Documentar en docs/SUPABASE.md**

Añadir junto a la línea de `user_devices`:

```markdown
- `user_activity` — Heartbeat diario por usuario (quién usa la app y cuánto)
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260708000000_user_activity.sql docs/SUPABASE.md
git commit -m "feat(admin): tabla user_activity con RPCs de actividad"
```

---

### Task 2: Heartbeat en el cliente

**Files:**
- Modify: `src/services/supabase.ts` (añadir función al final de la sección de devices, ~línea 489)
- Modify: `src/hooks/useAuth.ts:63` (bloque post-login)
- Test: `src/test/activityHeartbeat.test.ts`

**Interfaces:**
- Consumes: tabla `user_activity` (Task 1).
- Produces: `recordDailyActivity(): Promise<void>` exportada desde `@/services/supabase`.

- [ ] **Step 1: Escribir los tests que fallan**

`src/test/activityHeartbeat.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordDailyActivity, supabase } from '@/services/supabase'

const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local

describe('recordDailyActivity', () => {
  let upsertMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } as any },
      error: null,
    } as any)
    upsertMock = vi.fn().mockResolvedValue({ error: null })
    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'user_activity') return { upsert: upsertMock } as any
      return {} as any
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('inserta el heartbeat con user_id y día local', async () => {
    await recordDailyActivity()
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: 'user-123', day: today },
      { onConflict: 'user_id,day', ignoreDuplicates: true },
    )
    expect(localStorage.getItem('proclama_activity_ping')).toBe(`user-123:${today}`)
  })

  it('no escribe si ya hay heartbeat de hoy en localStorage', async () => {
    localStorage.setItem('proclama_activity_ping', `user-123:${today}`)
    await recordDailyActivity()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('sí escribe si el stamp guardado es de otro día', async () => {
    localStorage.setItem('proclama_activity_ping', 'user-123:2020-01-01')
    await recordDailyActivity()
    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it('no escribe sin sesión', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: { session: null },
      error: null,
    } as any)
    await recordDailyActivity()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('no guarda el stamp si el upsert falla', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'boom' } })
    await recordDailyActivity()
    expect(localStorage.getItem('proclama_activity_ping')).toBeNull()
  })
})
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `pnpm vitest --run src/test/activityHeartbeat.test.ts`
Expected: FAIL — `recordDailyActivity` no existe en `@/services/supabase`.

- [ ] **Step 3: Implementar `recordDailyActivity`**

En `src/services/supabase.ts`, después de `registerDevice`/`fetchUserDevices` (sección de devices):

```ts
const ACTIVITY_PING_KEY = 'proclama_activity_ping'

/**
 * Heartbeat diario de actividad: una fila por usuario/día en user_activity.
 * Guard con localStorage para escribir como máximo una vez al día por usuario.
 */
export async function recordDailyActivity(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return

  const day = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local
  const stamp = `${user.id}:${day}`
  if (localStorage.getItem(ACTIVITY_PING_KEY) === stamp) return

  const { error } = await supabase
    .from('user_activity')
    .upsert({ user_id: user.id, day }, { onConflict: 'user_id,day', ignoreDuplicates: true })

  if (error) {
    console.warn('[Activity] heartbeat failed:', error.message)
    return
  }
  localStorage.setItem(ACTIVITY_PING_KEY, stamp)
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm vitest --run src/test/activityHeartbeat.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Enganchar el heartbeat en useAuth**

En `src/hooks/useAuth.ts`, dentro del bloque background post-login, cambiar la línea del import dinámico de `fetchProfile`:

```ts
const { fetchProfile, recordDailyActivity } = await import('@/services/supabase')
recordDailyActivity().catch(() => {})
const profile = await fetchProfile(user.id)
```

(Fire-and-forget: no bloquea el resto del sync.)

- [ ] **Step 6: Type check y suite completa**

Run: `pnpm tsc --noEmit` y `pnpm test`
Expected: sin errores; suite en verde.

- [ ] **Step 7: Commit**

```bash
git add src/services/supabase.ts src/hooks/useAuth.ts src/test/activityHeartbeat.test.ts
git commit -m "feat: heartbeat diario de actividad por usuario"
```

---

### Task 3: Queries admin

**Files:**
- Modify: `src/admin/services/adminQueries.ts` (añadir al final)
- Test: `src/test/adminActivityQueries.test.ts`

**Interfaces:**
- Consumes: RPCs `admin_user_activity` y `admin_daily_active_users` (Task 1).
- Produces:
  - `interface UserActivityRow { userId: string; email: string; fullName: string | null; activeDays: number; lastActive: string | null }`
  - `fetchUserActivity(days?: number): Promise<UserActivityRow[]>` (ordenado por activeDays desc, lo hace la RPC)
  - `fetchDauChart(days?: number): Promise<{ date: string; count: number }[]>`

- [ ] **Step 1: Escribir el test que falla**

`src/test/adminActivityQueries.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/services/supabase'
import { fetchUserActivity, fetchDauChart } from '@/admin/services/adminQueries'

describe('admin activity queries', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetchUserActivity llama a la RPC y mapea a camelCase', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [
        { user_id: 'u1', email: 'a@b.c', full_name: 'Ana', active_days: 12, last_active: '2026-07-08' },
      ],
      error: null,
    } as any)

    const rows = await fetchUserActivity(30)

    expect(rpcMock).toHaveBeenCalledWith('admin_user_activity', { days_back: 30 })
    expect(rows).toEqual([
      { userId: 'u1', email: 'a@b.c', fullName: 'Ana', activeDays: 12, lastActive: '2026-07-08' },
    ])
  })

  it('fetchDauChart llama a la RPC y mapea a {date, count}', async () => {
    const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ day: '2026-07-08', count: 5 }],
      error: null,
    } as any)

    const rows = await fetchDauChart(30)

    expect(rpcMock).toHaveBeenCalledWith('admin_daily_active_users', { days_back: 30 })
    expect(rows).toEqual([{ date: '2026-07-08', count: 5 }])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm vitest --run src/test/adminActivityQueries.test.ts`
Expected: FAIL — `fetchUserActivity` no exportada.

- [ ] **Step 3: Implementar en adminQueries.ts**

Al final de `src/admin/services/adminQueries.ts`:

```ts
// --- User activity (heartbeat diario) ---
export interface UserActivityRow {
  userId: string;
  email: string;
  fullName: string | null;
  activeDays: number;
  lastActive: string | null;
}

export async function fetchUserActivity(days = 30): Promise<UserActivityRow[]> {
  const { data, error } = await supabase.rpc("admin_user_activity", { days_back: days });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    activeDays: Number(r.active_days),
    lastActive: r.last_active,
  }));
}

export async function fetchDauChart(days = 30): Promise<{ date: string; count: number }[]> {
  const { data, error } = await supabase.rpc("admin_daily_active_users", { days_back: days });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ date: String(r.day), count: Number(r.count) }));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm vitest --run src/test/adminActivityQueries.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/admin/services/adminQueries.ts src/test/adminActivityQueries.test.ts
git commit -m "feat(admin): queries de actividad de usuarios (RPC)"
```

---

### Task 4: Dashboard — Activos hoy, chart DAU y Top 10

**Files:**
- Modify: `src/admin/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `fetchUserActivity`, `fetchDauChart`, `UserActivityRow` de `../services/adminQueries` (Task 3).

- [ ] **Step 1: Cargar los datos nuevos**

En `DashboardPage.tsx`:

1. Ampliar el import de queries:

```ts
import { fetchAdminStats, fetchRegistrationChart, fetchUserLocations, fetchUserActivity, fetchDauChart, type UserActivityRow } from "../services/adminQueries";
```

2. Añadir estado tras `chartData`:

```ts
const [dauData, setDauData] = useState<{ date: string; count: number }[]>([]);
const [topUsers, setTopUsers] = useState<UserActivityRow[]>([]);
```

3. En el `load` callback, ampliar el `Promise.all`:

```ts
const [s, c, l, dau, activity] = await Promise.all([
  fetchAdminStats(),
  fetchRegistrationChart(),
  fetchUserLocations(),
  fetchDauChart().catch(() => []),
  fetchUserActivity().catch(() => []),
]);
setStats(s as any);
setChartData(c);
setUserLocations(l);
setDauData(dau);
setTopUsers(activity.filter(u => u.activeDays > 0).slice(0, 10));
```

(Los `.catch(() => [])` evitan romper el dashboard si las RPCs aún no existen en el entorno.)

- [ ] **Step 2: Pill "Activos hoy" en el héroe**

Dentro de `.bento-hero-footer`, añadir junto a los pills existentes (usa el icono `Activity` ya importado):

```tsx
<div className="hero-stat-pill">
  <Activity size={14} />
  <span><strong>{dauData.find(d => d.date === new Date().toLocaleDateString("en-CA"))?.count ?? 0}</strong> Activos hoy</span>
</div>
```

- [ ] **Step 3: Chart DAU + Top 10**

Después del bento del chart de registros (`bento-chart`, cierra en la línea del `</div>` correspondiente), añadir dos bentos:

```tsx
{/* Bento: Usuarios activos diarios */}
<div className="bento-item bento-chart">
  <span className="bento-label">Usuarios Activos Diarios (Últimos 30 días)</span>
  <div style={{ marginTop: 20, width: "100%", height: 180 }}>
    {dauData.length > 0 ? (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dauData}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12
            }}
          />
          <Line type="monotone" dataKey="count" stroke="var(--blue)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    ) : (
      <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, margin: 0, fontSize: 12 }}>
        Aún no hay datos de actividad. Se acumulan desde el despliegue del heartbeat.
      </p>
    )}
  </div>
</div>

{/* Bento: Top usuarios más activos */}
<div className="bento-item bento-chart">
  <span className="bento-label">Top Usuarios Más Activos (30 días)</span>
  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
    {topUsers.length > 0 ? topUsers.map((u, i) => (
      <div key={u.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "rgba(255,255,255,0.015)", border: "1px solid var(--border)", borderRadius: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 22 }}>#{i + 1}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {u.fullName || u.email}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Última actividad: {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}
          </div>
        </div>
        <span className="mod-count-badge">{u.activeDays} {u.activeDays === 1 ? "día" : "días"}</span>
      </div>
    )) : (
      <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 30, margin: 0, fontSize: 12 }}>
        Aún no hay actividad registrada.
      </p>
    )}
  </div>
</div>
```

- [ ] **Step 4: Verificar**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

Run: `pnpm dev` y abrir `http://localhost:5173/admin` con un usuario admin — el dashboard muestra los dos bentos nuevos y el pill "Activos hoy" (con 0/vacío si aún no hay datos, sin romper nada).

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/DashboardPage.tsx
git commit -m "feat(admin): DAU, activos hoy y top usuarios en dashboard"
```

---

### Task 5: UsersPage — columnas de actividad

**Files:**
- Modify: `src/admin/pages/UsersPage.tsx`

**Interfaces:**
- Consumes: `fetchUserActivity`, `UserActivityRow` (Task 3).

- [ ] **Step 1: Cargar actividad y mergear**

En `UsersPage.tsx`:

1. Import:

```ts
import { fetchUsersPaginated, fetchUserActivity, type UserActivityRow } from "../services/adminQueries";
```

2. Estado (tras `sortOrder`):

```ts
const [activityMap, setActivityMap] = useState<Record<string, UserActivityRow>>({});
```

3. Efecto de carga única (tras los efectos existentes):

```ts
useEffect(() => {
  fetchUserActivity()
    .then(rows => setActivityMap(Object.fromEntries(rows.map(r => [r.userId, r]))))
    .catch(() => {});
}, []);
```

- [ ] **Step 2: Añadir columnas**

En el array `columns` de `DataTable`, después de la columna `date` (Registro):

```tsx
{ key: "activeDays", header: "Días activos (30d)", render: (u: UserProfile) => {
  const a = activityMap[u.id];
  return <span style={{ color: a?.activeDays ? "var(--gold)" : "var(--text-muted)", fontWeight: a?.activeDays ? 600 : 400, fontSize: 13 }}>{a?.activeDays ?? 0}</span>;
} },
{ key: "lastActive", header: "Última actividad", render: (u: UserProfile) => {
  const last = activityMap[u.id]?.lastActive;
  return <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{last ? new Date(last).toLocaleDateString() : "—"}</span>;
} },
```

- [ ] **Step 3: Incluir en el CSV export**

En `exportCSV`, ampliar cabecera y filas:

```ts
const rows = [["Nombre", "Email", "Registro", "Días activos (30d)", "Última actividad", "Rol", "Iglesia", "Ciudad", "País"], ...users.map(u => [
  u.full_name || "—", u.email, new Date(u.created_at).toLocaleDateString(),
  String(activityMap[u.id]?.activeDays ?? 0),
  activityMap[u.id]?.lastActive ? new Date(activityMap[u.id]!.lastActive!).toLocaleDateString() : "—",
  u.role, u.settings?.churchName || "—", u.settings?.city || "—", u.settings?.country || "—"
])];
```

- [ ] **Step 4: Verificar**

Run: `pnpm tsc --noEmit` y `pnpm test`
Expected: sin errores; suite en verde.

Manual: `pnpm dev` → `/admin` → Usuarios: las dos columnas aparecen (con "0" y "—" o con el fallback de last_seen de dispositivos).

- [ ] **Step 5: Commit**

```bash
git add src/admin/pages/UsersPage.tsx
git commit -m "feat(admin): columnas de actividad en tabla de usuarios"
```
