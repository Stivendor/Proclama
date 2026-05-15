# Admin Panel Plan — Part 5 (Tasks 13-16)

> Final part. Continues from Part 4.

---

### Task 13: GlobalLibraryPage

**Files:**
- Modify: `src/admin/pages/GlobalLibraryPage.tsx`

- [ ] **Step 1: Implement GlobalLibraryPage**

```tsx
import { useEffect, useState, useCallback } from "react";
import { Library, Search, Trash2, Check } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchSongsPaginated } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";

interface Song {
  id: number; title: string; artist: string | null;
  language: string | null; is_verified: boolean; created_at: string;
}

export default function GlobalLibraryPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterVerified, setFilterVerified] = useState("");
  const ps = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchSongsPaginated(page, ps, { search, verified: filterVerified });
      setSongs(r.data); setTotal(r.count);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, search, filterVerified]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const deleteSong = async (song: Song) => {
    if (!confirm(`¿Eliminar "${song.title}" permanentemente?`)) return;
    await supabase.from("songs").delete().eq("id", song.id);
    await logAdminAction({ action: "delete_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
    load();
  };

  const toggleVerified = async (song: Song) => {
    const v = !song.is_verified;
    await supabase.from("songs").update({ is_verified: v }).eq("id", song.id);
    await logAdminAction({ action: v ? "verify_song" : "unverify_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
    setSongs(prev => prev.map(s => s.id === song.id ? { ...s, is_verified: v } : s));
  };

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Library size={24} color="var(--gold)" /> Biblioteca Global
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>{total} canciones públicas</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div className="admin-search-wrap" style={{ flex: 1 }}>
          <Search size={15} className="admin-search-icon" />
          <input placeholder="Buscar título o artista..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
        </div>
        <select className="admin-select" value={filterVerified} onChange={e => { setFilterVerified(e.target.value); setPage(0); }}>
          <option value="">Todas</option>
          <option value="true">Verificadas</option>
          <option value="false">No verificadas</option>
        </select>
      </div>

      <DataTable
        columns={[
          { key: "title", header: "Título", render: (s: Song) => <strong>{s.title}</strong> },
          { key: "artist", header: "Artista", render: (s: Song) => <span style={{ color: "var(--text-secondary)" }}>{s.artist ?? "—"}</span> },
          { key: "lang", header: "Idioma", render: (s: Song) => <span style={{ fontSize: 12 }}>{s.language ?? "—"}</span> },
          { key: "verified", header: "Verificada", render: (s: Song) => (
            <button className={`admin-action-btn ${s.is_verified ? "gold" : ""}`}
              style={s.is_verified ? {} : { background: "var(--bg-hover)", color: "var(--text-muted)" }}
              onClick={() => toggleVerified(s)}>
              <Check size={12} /> {s.is_verified ? "Sí" : "No"}
            </button>
          )},
          { key: "date", header: "Fecha", render: (s: Song) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(s.created_at).toLocaleDateString()}</span> },
          { key: "actions", header: "", align: "right", render: (s: Song) => (
            <button className="admin-action-btn danger" onClick={() => deleteSong(s)}><Trash2 size={13} /></button>
          )}
        ]}
        data={songs} totalCount={total} page={page} pageSize={ps}
        onPageChange={setPage} loading={loading} rowKey={(s: Song) => String(s.id)}
      />
    </div>
  );
}
```

---

### Task 14: ActivityLogsPage

**Files:**
- Modify: `src/admin/pages/ActivityLogsPage.tsx`

- [ ] **Step 1: Implement ActivityLogsPage**

```tsx
import { useEffect, useState, useCallback } from "react";
import { ScrollText, Download } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchLogsPaginated } from "../services/adminQueries";

interface LogEntry {
  id: string; admin_email: string; action: string;
  target_type: string; target_id: string; target_label: string;
  note: string | null; created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  approve_song: "Aprobó canción", reject_song: "Rechazó canción",
  delete_song: "Eliminó canción", change_plan: "Cambió plan",
  resolve_report: "Resolvió reporte", verify_song: "Verificó canción",
  unverify_song: "Quitó verificación"
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const ps = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchLogsPaginated(page, ps, { action: filterAction || undefined });
      setLogs(r.data); setTotal(r.count);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterAction]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    const rows = [["Admin","Acción","Tipo","Objetivo","Nota","Fecha"], ...logs.map(l => [
      l.admin_email, l.action, l.target_type, l.target_label, l.note ?? "", new Date(l.created_at).toLocaleString()
    ])];
    const blob = new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `admin_logs_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ScrollText size={24} color="var(--text-muted)" /> Logs de Actividad
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{total} registros</p>
        </div>
        <button className="admin-btn-secondary" onClick={exportCSV}><Download size={14} /> CSV</button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select className="admin-select" value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(0); }}>
          <option value="">Todas las acciones</option>
          {Object.keys(ACTION_LABELS).map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: "admin", header: "Admin", render: (l: LogEntry) => <span style={{ fontSize: 13 }}>{l.admin_email}</span> },
          { key: "action", header: "Acción", render: (l: LogEntry) => <span className="admin-badge premium">{ACTION_LABELS[l.action] ?? l.action}</span> },
          { key: "target", header: "Objetivo", render: (l: LogEntry) => <span style={{ fontSize: 13 }}>{l.target_label}</span> },
          { key: "note", header: "Nota", render: (l: LogEntry) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{l.note ?? "—"}</span> },
          { key: "date", header: "Fecha", render: (l: LogEntry) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(l.created_at).toLocaleString()}</span> }
        ]}
        data={logs} totalCount={total} page={page} pageSize={ps}
        onPageChange={setPage} loading={loading} rowKey={(l: LogEntry) => l.id}
      />
    </div>
  );
}
```

---

### Task 15: PlansPage

**Files:**
- Modify: `src/admin/pages/PlansPage.tsx`

- [ ] **Step 1: Implement PlansPage**

```tsx
import { useEffect, useState } from "react";
import { CreditCard, Search, Zap, ZapOff } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";

export default function PlansPage() {
  const [stats, setStats] = useState({ free: 0, premium: 0 });
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "free"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "premium"),
    ]).then(([f, p]) => setStats({ free: f.count ?? 0, premium: p.count ?? 0 }));
  }, []);

  const overridePlan = async (newPlan: "free" | "premium") => {
    if (!email || !reason) { setMsg("Email y razón son obligatorios."); return; }
    setUpdating(true); setMsg("");
    try {
      const { data } = await supabase.from("profiles").select("id, plan").eq("email", email).single();
      if (!data) { setMsg("Usuario no encontrado."); return; }
      await supabase.from("profiles").update({ plan: newPlan }).eq("id", data.id);
      await logAdminAction({ action: "change_plan", targetType: "user", targetId: data.id, targetLabel: email, note: `${data.plan} → ${newPlan}. Razón: ${reason}` });
      setMsg(`Plan de ${email} cambiado a ${newPlan.toUpperCase()}.`);
      setEmail(""); setReason("");
      setStats(prev => ({
        free: prev.free + (newPlan === "free" ? 1 : -1),
        premium: prev.premium + (newPlan === "premium" ? 1 : -1)
      }));
    } catch { setMsg("Error al cambiar plan."); }
    finally { setUpdating(false); }
  };

  const pieData = [
    { name: "Free", value: stats.free, color: "var(--text-muted)" },
    { name: "Premium", value: stats.premium, color: "var(--gold)" }
  ];

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <CreditCard size={24} color="var(--gold)" /> Planes & Pagos
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
        <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)", padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Distribución</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 12, fontSize: 13 }}>
            <span>Free: <strong>{stats.free}</strong></span>
            <span style={{ color: "var(--gold)" }}>Premium: <strong>{stats.premium}</strong></span>
          </div>
        </div>

        <div style={{ background: "var(--bg-elevated)", borderRadius: 16, border: "1px solid var(--border)", padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>Override manual</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input placeholder="Email del usuario" value={email} onChange={e => setEmail(e.target.value)}
              style={{ padding: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)" }} />
            <textarea placeholder="Razón (obligatorio)" value={reason} onChange={e => setReason(e.target.value)} rows={2}
              style={{ padding: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="admin-action-btn gold" disabled={updating} onClick={() => overridePlan("premium")}>
                <Zap size={13} /> Hacer Premium
              </button>
              <button className="admin-action-btn danger" disabled={updating} onClick={() => overridePlan("free")}>
                <ZapOff size={13} /> Quitar Premium
              </button>
            </div>
            {msg && <p style={{ fontSize: 13, color: msg.includes("Error") ? "var(--red)" : "var(--green)" }}>{msg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 16: Sidebar admin button + Feedback FAB

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Create: `src/components/FeedbackFAB.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add admin button in Sidebar**

In `Sidebar.tsx`, add a nav item visible only when `userRole === 'admin'`:

```tsx
{userRole === 'admin' && (
  <button className="sidebar-item admin-link" onClick={() => window.location.href = '/admin'}>
    <Shield size={18} />
    <span>Panel Admin</span>
  </button>
)}
```

- [ ] **Step 2: Create FeedbackFAB**

```tsx
// src/components/FeedbackFAB.tsx
import { useState } from "react";
import { MessageSquarePlus, X, Send } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores";

export default function FeedbackFAB() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const user = useAppStore(s => s.user);

  if (!user) return null;

  const send = async () => {
    if (message.trim().length < 5) return;
    setSending(true);
    try {
      await supabase.from("feedback").insert({
        user_id: user.id, user_email: user.email ?? "",
        message: message.trim(), category
      });
      setSent(true);
      setTimeout(() => { setOpen(false); setSent(false); setMessage(""); }, 1500);
    } catch { alert("Error al enviar."); }
    finally { setSending(false); }
  };

  return (
    <>
      <button className="feedback-fab" onClick={() => setOpen(!open)} title="Enviar sugerencia">
        {open ? <X size={20} /> : <MessageSquarePlus size={20} />}
      </button>
      {open && (
        <div className="feedback-panel">
          {sent ? (
            <p style={{ textAlign: "center", color: "var(--green)", fontWeight: 600 }}>¡Gracias por tu feedback!</p>
          ) : (
            <>
              <h4 style={{ margin: "0 0 12px", fontSize: 15 }}>Enviar sugerencia</h4>
              <select value={category} onChange={e => setCategory(e.target.value)} className="admin-select" style={{ width: "100%", marginBottom: 8 }}>
                <option value="general">General</option>
                <option value="bug">Bug</option>
                <option value="feature">Sugerencia</option>
                <option value="content">Contenido</option>
              </select>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Cuéntanos..."
                style={{ width: "100%", padding: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, resize: "none" }} />
              <button className="admin-action-btn gold" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                onClick={send} disabled={sending || message.trim().length < 5}>
                <Send size={13} /> {sending ? "Enviando..." : "Enviar"}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Add FeedbackFAB CSS to index.css**

```css
.feedback-fab {
  position: fixed; bottom: 20px; left: 20px; z-index: 50;
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text-secondary); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.feedback-fab:hover { color: var(--gold); border-color: var(--gold-dim); transform: scale(1.05); }

.feedback-panel {
  position: fixed; bottom: 72px; left: 20px; z-index: 50;
  width: 280px; padding: 16px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,0.3);
  animation: fadeInUp 0.2s ease-out;
}
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
```

- [ ] **Step 4: Mount FeedbackFAB in App.tsx**

In `MainApp` component, add before the closing `</div>`:

```tsx
<FeedbackFAB />
```

Import at top:
```tsx
import FeedbackFAB from "@/components/FeedbackFAB";
```

- [ ] **Step 5: Final verification**

1. Navigate to `/` — normal app works, FeedbackFAB visible bottom-left for logged-in users
2. Navigate to `/admin` — admin panel loads with all 8 pages functional
3. Test creating a suggestion via FAB, verify it appears in admin Suggestions page
4. Test approve/reject in Pending Songs
5. Test plan change in Users → verify it appears in Activity Logs

---

**End of implementation plan.** All 5 parts:
- Part 1: Tasks 1-4 (Guard, Sidebar, Shell, CSS)
- Part 2: Tasks 5-8 (DB, Services, Components, Dashboard)
- Part 3: Tasks 9-10 (Users, Reports)
- Part 4: Tasks 11-12 (Pending Songs, Suggestions)
- Part 5: Tasks 13-16 (Library, Logs, Plans, FAB)
