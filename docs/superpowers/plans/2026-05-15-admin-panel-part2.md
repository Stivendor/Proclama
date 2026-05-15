# Admin Panel Implementation Plan — Part 2 (Tasks 5-8)

> Continues from Part 1. See `2026-05-15-admin-panel-part1.md` for Tasks 1-4.

---

### Task 5: Database migrations (admin_logs + feedback extensions)

**Files:**
- No local files — Supabase migrations via MCP or SQL editor

- [ ] **Step 1: Create admin_logs table**

```sql
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  note text,
  created_at timestamptz default now()
);

alter table admin_logs enable row level security;
create policy "admin_only_logs" on admin_logs
  using (auth.uid() in (select id from profiles where role = 'admin'));
```

- [ ] **Step 2: Extend feedback table**

```sql
alter table public.feedback add column if not exists user_email text;
alter table public.feedback add column if not exists category text default 'general';
alter table public.feedback add column if not exists status text default 'unread';
alter table public.feedback add column if not exists admin_note text;
alter table public.feedback add column if not exists updated_at timestamptz default now();
```

- [ ] **Step 3: Add RLS to feedback for admin access**

```sql
-- Check if RLS already enabled, if not:
alter table public.feedback enable row level security;

create policy "admin_read_feedback" on public.feedback for select
  using (auth.uid() in (select id from profiles where role = 'admin'));
create policy "admin_update_feedback" on public.feedback for update
  using (auth.uid() in (select id from profiles where role = 'admin'));
create policy "user_insert_feedback" on public.feedback for insert
  with check (auth.uid() = user_id);
```

- [ ] **Step 4: Verify migrations applied**

Query both tables to confirm they exist and columns are correct.

---

### Task 6: Admin services layer

**Files:**
- Create: `src/admin/services/adminQueries.ts`
- Create: `src/admin/services/adminLogs.ts`

- [ ] **Step 1: Create adminQueries.ts**

```ts
// src/admin/services/adminQueries.ts
import { supabase } from "@/services/supabase";

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}

// --- Users ---
export async function fetchUsersPaginated(
  page: number,
  pageSize: number,
  filters: { search?: string; plan?: string; role?: string; sortOrder?: "asc" | "desc" }
): Promise<PaginatedResult<any>> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select("id, email, created_at, plan, role", { count: "exact" })
    .range(from, to)
    .order("created_at", { ascending: filters.sortOrder === "asc" });

  if (filters.search) query = query.ilike("email", `%${filters.search}%`);
  if (filters.plan && filters.plan !== "all") query = query.eq("plan", filters.plan);
  if (filters.role && filters.role !== "all") query = query.eq("role", filters.role);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Dashboard stats ---
export async function fetchAdminStats() {
  const [users, premium, songs, reports, pending, feedback] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "premium"),
    supabase.from("songs").select("id", { count: "exact", head: true }).eq("is_verified", true),
    supabase.from("song_reports").select("id", { count: "exact", head: true }),
    supabase.from("songs").select("id", { count: "exact", head: true }).eq("is_public", true).eq("is_verified", false),
    supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "unread"),
  ]);
  return {
    totalUsers: users.count ?? 0,
    premiumUsers: premium.count ?? 0,
    verifiedSongs: songs.count ?? 0,
    openReports: reports.count ?? 0,
    pendingSongs: pending.count ?? 0,
    unreadFeedback: feedback.count ?? 0,
  };
}

// --- Reports ---
export async function fetchReportsPaginated(page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await supabase
    .from("song_reports")
    .select("*, songs(title, artist, lyrics, language)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Feedback ---
export async function fetchFeedbackPaginated(
  page: number,
  pageSize: number,
  filters: { status?: string; category?: string }
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("feedback")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Songs (global library) ---
export async function fetchSongsPaginated(
  page: number,
  pageSize: number,
  filters: { search?: string; language?: string; verified?: string }
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("songs")
    .select("id, title, artist, language, is_verified, is_public, created_at, user_id", { count: "exact" })
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,artist.ilike.%${filters.search}%`);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.verified === "true") query = query.eq("is_verified", true);
  if (filters.verified === "false") query = query.eq("is_verified", false);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Pending songs ---
export async function fetchPendingSongs(page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await supabase
    .from("songs")
    .select("id, title, artist, language, lyrics, is_public, is_verified, created_at, user_id", { count: "exact" })
    .eq("is_public", true)
    .eq("is_verified", false)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Activity logs ---
export async function fetchLogsPaginated(
  page: number,
  pageSize: number,
  filters: { action?: string; adminId?: string }
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("admin_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.adminId) query = query.eq("admin_id", filters.adminId);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- User registration chart (last 30 days) ---
export async function fetchRegistrationChart() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  const byDay: Record<string, number> = {};
  (data ?? []).forEach((u) => {
    const day = u.created_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  });

  return Object.entries(byDay).map(([date, count]) => ({ date, count }));
}
```

- [ ] **Step 2: Create adminLogs.ts**

```ts
// src/admin/services/adminLogs.ts
import { supabase } from "@/services/supabase";

export async function logAdminAction(params: {
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  note?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from("admin_logs").insert({
    admin_id: session.user.id,
    admin_email: session.user.email ?? "",
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    target_label: params.targetLabel,
    note: params.note ?? null,
  });
}
```

---

### Task 7: Reusable DataTable + StatCard components

**Files:**
- Create: `src/admin/components/DataTable.tsx`
- Create: `src/admin/components/StatCard.tsx`

- [ ] **Step 1: Create StatCard**

```tsx
// src/admin/components/StatCard.tsx
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: number | string;
  icon: ReactNode;
  accentColor?: string;
  onClick?: () => void;
  active?: boolean;
}

export default function StatCard({ label, value, icon, accentColor, onClick, active }: Props) {
  return (
    <div
      className={`admin-stat-card ${active ? "active" : ""}`}
      onClick={onClick}
      style={active && accentColor ? { borderColor: accentColor } : undefined}
    >
      <span className="admin-stat-label">{label}</span>
      <span className="admin-stat-value">{value}</span>
      <div className="admin-stat-icon" style={accentColor ? { color: accentColor } : undefined}>
        {icon}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create DataTable**

```tsx
// src/admin/components/DataTable.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  emptyMessage?: string;
  rowKey: (row: T) => string;
}

export default function DataTable<T>({
  columns, data, totalCount, page, pageSize, onPageChange, loading, emptyMessage, rowKey
}: Props<T>) {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="admin-table-container">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.align ?? "left" }}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className="admin-table-status">
              <div className="admin-spinner" />
            </td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="admin-table-status">
              {emptyMessage ?? "Sin resultados."}
            </td></tr>
          ) : (
            data.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align ?? "left" }}>{col.render(row)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="admin-table-pagination">
          <button disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={16} />
          </button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add table/stat CSS to index.css**

Append to admin styles section:

```css
/* StatCard */
.admin-stat-card {
  background: var(--bg-elevated);
  padding: 24px;
  border-radius: 16px;
  border: 1px solid var(--border);
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
  overflow: hidden;
}
.admin-stat-card:hover { transform: translateY(-3px); border-color: var(--gold-dim); }
.admin-stat-card.active { border-color: var(--gold); background: rgba(212,175,55,0.03); }
.admin-stat-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
.admin-stat-value { font-size: 32px; font-weight: 700; color: var(--text-primary); margin-top: 6px; display: block; }
.admin-stat-icon { position: absolute; right: 20px; bottom: 20px; opacity: 0.06; }

/* DataTable */
.admin-table-container {
  background: var(--bg-elevated);
  border-radius: 16px;
  border: 1px solid var(--border);
  overflow: hidden;
}
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th {
  padding: 14px 20px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,0.015);
}
.admin-table td { padding: 14px 20px; border-bottom: 1px solid var(--border); }
.admin-table tr:last-child td { border-bottom: none; }
.admin-table tr:hover { background: rgba(255,255,255,0.01); }
.admin-table-status { text-align: center; padding: 48px; color: var(--text-muted); }
.admin-table-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 14px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  color: var(--text-secondary);
}
.admin-table-pagination button {
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text-primary);
  cursor: pointer;
}
.admin-table-pagination button:disabled { opacity: 0.3; cursor: default; }
```

---

### Task 8: DashboardPage

**Files:**
- Modify: `src/admin/pages/DashboardPage.tsx`

- [ ] **Step 1: Implement DashboardPage**

```tsx
// src/admin/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import { Users, Star, Music, AlertCircle, Clock, MessageSquare } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import StatCard from "../components/StatCard";
import { fetchAdminStats, fetchRegistrationChart } from "../services/adminQueries";

interface Stats {
  totalUsers: number;
  premiumUsers: number;
  verifiedSongs: number;
  openReports: number;
  pendingSongs: number;
  unreadFeedback: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAdminStats(), fetchRegistrationChart()])
      .then(([s, c]) => { setStats(s); setChartData(c); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <div className="admin-page-loading"><div className="admin-spinner" /></div>;
  }

  return (
    <div className="admin-page">
      <h1>Dashboard</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        Resumen general de la plataforma.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Usuarios" value={stats.totalUsers} icon={<Users size={28} />} />
        <StatCard label="Premium" value={stats.premiumUsers} icon={<Star size={28} />} accentColor="var(--gold)" />
        <StatCard label="Canciones Verificadas" value={stats.verifiedSongs} icon={<Music size={28} />} />
        <StatCard label="Reportes Abiertos" value={stats.openReports} icon={<AlertCircle size={28} />} accentColor="var(--red)" />
        <StatCard label="Pendientes" value={stats.pendingSongs} icon={<Clock size={28} />} accentColor="var(--gold)" />
        <StatCard label="Sugerencias" value={stats.unreadFeedback} icon={<MessageSquare size={28} />} accentColor="var(--blue)" />
      </div>

      <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)", padding: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Registros últimos 30 días</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13 }} />
            <Line type="monotone" dataKey="count" stroke="var(--gold)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify Dashboard loads with real data**

Run dev server, navigate to `/admin`. Dashboard should show KPIs and chart.

---

**End of Part 2.** Part 3 covers Tasks 9-12 (remaining pages: Users, Reports, Pending, Suggestions, Library, Logs, Sidebar button, Feedback FAB).
