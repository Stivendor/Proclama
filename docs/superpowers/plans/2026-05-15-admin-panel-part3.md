# Admin Panel Plan — Part 3 (Tasks 9-10)

> Continues from Part 2.

---

### Task 9: UsersPage (migrated + paginated)

**Files:**
- Modify: `src/admin/pages/UsersPage.tsx`

- [ ] **Step 1: Implement UsersPage**

```tsx
import { useEffect, useState, useCallback } from "react";
import { Users, Search, ArrowUpDown, Download, Zap, ZapOff, RefreshCcw } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchUsersPaginated } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  role: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchUsersPaginated(page, pageSize, { search, plan: filterPlan, sortOrder });
      setUsers(r.data);
      setTotalCount(r.count);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, filterPlan, sortOrder]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const togglePlan = async (user: UserProfile) => {
    const newPlan = user.plan === "premium" ? "free" : "premium";
    if (!confirm(`¿Cambiar plan de ${user.email} a ${newPlan.toUpperCase()}?`)) return;
    setUpdatingId(user.id);
    try {
      await supabase.from("profiles").update({ plan: newPlan }).eq("id", user.id);
      await logAdminAction({
        action: "change_plan", targetType: "user", targetId: user.id,
        targetLabel: user.email, note: `${user.plan} → ${newPlan}`
      });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, plan: newPlan } : u));
    } catch { alert("Error al cambiar plan."); }
    finally { setUpdatingId(null); }
  };

  const exportCSV = () => {
    const rows = [["Email","Registro","Plan","Rol"], ...users.map(u => [
      u.email, new Date(u.created_at).toLocaleDateString(), u.plan, u.role
    ])];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `usuarios_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Users size={24} color="var(--gold)" /> Usuarios
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{totalCount} usuarios registrados</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn-icon" onClick={load} title="Refrescar"><RefreshCcw size={16} /></button>
          <button className="admin-btn-secondary" onClick={exportCSV}><Download size={14} /> CSV</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div className="admin-search-wrap" style={{ flex: 1 }}>
          <Search size={15} className="admin-search-icon" />
          <input placeholder="Buscar por email..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <select value={filterPlan} onChange={e => { setFilterPlan(e.target.value); setPage(0); }} className="admin-select">
          <option value="all">Todos</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <button className="admin-btn-icon" onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")} title="Orden">
          <ArrowUpDown size={16} />
        </button>
      </div>

      <DataTable
        columns={[
          { key: "email", header: "Email", render: (u: UserProfile) => <span style={{ fontWeight: 500 }}>{u.email}</span> },
          { key: "date", header: "Registro", render: (u: UserProfile) => <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{new Date(u.created_at).toLocaleDateString()}</span> },
          { key: "plan", header: "Plan", render: (u: UserProfile) => <span className={`admin-badge ${u.plan}`}>{u.plan.toUpperCase()}</span> },
          { key: "role", header: "Rol", render: (u: UserProfile) => <span style={{ color: u.role === "admin" ? "var(--blue)" : "var(--text-muted)", fontWeight: u.role === "admin" ? 600 : 400 }}>{u.role === "admin" ? "Admin" : "Usuario"}</span> },
          { key: "actions", header: "Acciones", align: "right", render: (u: UserProfile) => (
            <button className={`admin-action-btn ${u.plan === "premium" ? "danger" : "gold"}`} onClick={() => togglePlan(u)} disabled={updatingId === u.id}>
              {updatingId === u.id ? <RefreshCcw size={13} className="spin" /> : u.plan === "premium" ? <><ZapOff size={13} /> Quitar</> : <><Zap size={13} /> Premium</>}
            </button>
          )}
        ]}
        data={users}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        loading={loading}
        rowKey={(u: UserProfile) => u.id}
        emptyMessage="No se encontraron usuarios."
      />
    </div>
  );
}
```

- [ ] **Step 2: Add filter/action CSS**

Append to admin CSS in `index.css`:

```css
.admin-search-wrap { position: relative; }
.admin-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
.admin-search-wrap input {
  width: 100%; padding: 10px 10px 10px 38px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text-primary); font-size: 14px;
}
.admin-search-wrap input:focus { border-color: var(--gold-dim); outline: none; }
.admin-select {
  padding: 10px 14px; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text-primary); font-size: 13px;
}
.admin-btn-icon {
  padding: 10px; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
}
.admin-btn-icon:hover { color: var(--gold); border-color: var(--gold-dim); }
.admin-btn-secondary {
  display: flex; align-items: center; gap: 6px; padding: 10px 16px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text-primary); font-size: 13px; font-weight: 500; cursor: pointer;
}
.admin-btn-secondary:hover { background: var(--bg-hover); }
.admin-badge { padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
.admin-badge.free { background: rgba(255,255,255,0.05); color: var(--text-secondary); }
.admin-badge.premium { background: rgba(212,175,55,0.1); color: var(--gold); border: 1px solid rgba(212,175,55,0.2); }
.admin-action-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
  border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s;
}
.admin-action-btn.gold { background: rgba(212,175,55,0.1); color: var(--gold); }
.admin-action-btn.gold:hover { background: var(--gold); color: #000; }
.admin-action-btn.danger { background: rgba(255,255,255,0.05); color: var(--text-muted); }
.admin-action-btn.danger:hover { background: rgba(255,76,76,0.1); color: #ff4c4c; }
.admin-action-btn:disabled { opacity: 0.4; cursor: default; }
```

---

### Task 10: ReportsPage (migrated + improved)

**Files:**
- Modify: `src/admin/pages/ReportsPage.tsx`

- [ ] **Step 1: Implement ReportsPage**

```tsx
import { useEffect, useState, useCallback } from "react";
import { AlertCircle, Music, CheckCircle, Trash2, Edit2, Calendar } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchReportsPaginated } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";

interface Report {
  id: string;
  song_id: number;
  reason: string;
  details: string | null;
  created_at: string;
  songs: { title: string; artist: string | null; lyrics: string | null; language: string | null } | null;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchReportsPaginated(page, pageSize);
      setReports(r.data); setTotalCount(r.count);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const resolveReport = async (report: Report) => {
    try {
      await supabase.from("song_reports").delete().eq("id", report.id);
      await logAdminAction({
        action: "resolve_report", targetType: "report", targetId: report.id,
        targetLabel: report.songs?.title ?? "unknown"
      });
      setReports(prev => prev.filter(r => r.id !== report.id));
      setTotalCount(c => c - 1);
    } catch { alert("Error al resolver reporte."); }
  };

  const deleteSong = async (report: Report) => {
    if (!confirm(`¿ELIMINAR la canción "${report.songs?.title}"? Esto es irreversible.`)) return;
    try {
      await supabase.from("song_reports").delete().eq("song_id", report.song_id);
      await supabase.from("songs").delete().eq("id", report.song_id);
      await logAdminAction({
        action: "delete_song", targetType: "song", targetId: String(report.song_id),
        targetLabel: report.songs?.title ?? "unknown", note: `Razón reporte: ${report.reason}`
      });
      setReports(prev => prev.filter(r => r.song_id !== report.song_id));
      load();
    } catch { alert("Error al eliminar canción."); }
  };

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={24} color="var(--red)" /> Reportes de Canciones
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>{totalCount} reportes abiertos</p>

      {reports.length === 0 && !loading ? (
        <div className="admin-empty-state">
          <CheckCircle size={40} style={{ opacity: 0.3 }} />
          <p>No hay reportes pendientes. ¡Todo al día!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {reports.map(r => (
            <div key={r.id} className="admin-report-card">
              <div className="admin-report-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <Music size={16} color="var(--gold)" />
                    {r.songs?.title ?? "Canción desconocida"}
                    {r.songs?.artist && <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}> — {r.songs.artist}</span>}
                  </h3>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                    <span>{r.reason}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={11} /> {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="admin-action-btn gold" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <Edit2 size={13} /> {expandedId === r.id ? "Ocultar" : "Ver letra"}
                  </button>
                  <button className="admin-action-btn danger" onClick={() => deleteSong(r)}><Trash2 size={13} /> Eliminar</button>
                  <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff" }} onClick={() => resolveReport(r)}>
                    <CheckCircle size={13} /> Resuelto
                  </button>
                </div>
              </div>
              {r.details && <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-secondary)", borderLeft: "3px solid var(--border)", paddingLeft: 12 }}>{r.details}</p>}
              {expandedId === r.id && r.songs?.lyrics && (
                <pre className="admin-lyrics-preview">{r.songs.lyrics}</pre>
              )}
            </div>
          ))}
          {totalCount > pageSize && (
            <div className="admin-table-pagination">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</button>
              <span>{page + 1} / {Math.ceil(totalCount / pageSize)}</span>
              <button disabled={(page + 1) * pageSize >= totalCount} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add report-specific CSS**

```css
.admin-empty-state {
  text-align: center; padding: 60px; background: var(--bg-elevated);
  border-radius: 16px; border: 1px solid var(--border); color: var(--text-muted);
}
.admin-report-card {
  background: var(--bg-elevated); border-radius: 14px; padding: 20px;
  border: 1px solid var(--border); transition: border-color 0.15s;
}
.admin-report-card:hover { border-color: var(--gold-dim); }
.admin-report-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.admin-lyrics-preview {
  margin: 12px 0 0; padding: 16px; background: var(--bg-surface);
  border-radius: 8px; font-size: 13px; line-height: 1.6;
  white-space: pre-wrap; max-height: 300px; overflow-y: auto;
  font-family: var(--font-mono, monospace); color: var(--text-primary);
}
```

---

**End of Part 3.** Part 4 covers Tasks 11-14 (Pending Songs, Suggestions, Global Library, Activity Logs, Sidebar button, Feedback FAB).
