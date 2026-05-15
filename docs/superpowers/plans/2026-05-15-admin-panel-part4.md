# Admin Panel Plan — Part 4 (Tasks 11-12)

> Continues from Part 3.

---

### Task 11: PendingSongsPage

**Files:**
- Modify: `src/admin/pages/PendingSongsPage.tsx`

- [ ] **Step 1: Implement PendingSongsPage**

```tsx
import { useEffect, useState, useCallback } from "react";
import { Clock, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { fetchPendingSongs } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";

interface PendingSong {
  id: number; title: string; artist: string | null;
  language: string | null; lyrics: string | null; created_at: string;
}

export default function PendingSongsPage() {
  const [songs, setSongs] = useState<PendingSong[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const ps = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchPendingSongs(page, ps);
      setSongs(r.data); setTotal(r.count);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const approve = async (song: PendingSong) => {
    await supabase.from("songs").update({ is_verified: true }).eq("id", song.id);
    await logAdminAction({ action: "approve_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
    setSongs(p => p.filter(s => s.id !== song.id));
    setTotal(t => t - 1);
  };

  const reject = async (song: PendingSong) => {
    if (!confirm(`¿Rechazar "${song.title}"?`)) return;
    await supabase.from("songs").update({ is_public: false, is_verified: false }).eq("id", song.id);
    await logAdminAction({ action: "reject_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
    setSongs(p => p.filter(s => s.id !== song.id));
    setTotal(t => t - 1);
  };

  const bulkApprove = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Aprobar ${selected.size} canciones?`)) return;
    for (const id of selected) {
      const song = songs.find(s => s.id === id);
      if (song) await approve(song);
    }
    setSelected(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={24} color="var(--gold)" /> Pendientes de Aprobación
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{total} canciones</p>
        </div>
        {selected.size > 0 && (
          <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff", padding: "8px 20px" }} onClick={bulkApprove}>
            <Check size={14} /> Aprobar {selected.size} seleccionadas
          </button>
        )}
      </div>

      {songs.length === 0 && !loading ? (
        <div className="admin-empty-state"><Check size={40} style={{ opacity: 0.3 }} /><p>No hay canciones pendientes.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {songs.map(s => (
            <div key={s.id} className="admin-report-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)}
                  style={{ accentColor: "var(--gold)", width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <strong>{s.title}</strong>
                  {s.artist && <span style={{ color: "var(--text-secondary)" }}> — {s.artist}</span>}
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {s.language ?? ""} · {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button className="admin-btn-icon" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  {expanded === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <button className="admin-action-btn danger" onClick={() => reject(s)}><X size={13} /> Rechazar</button>
                <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff" }} onClick={() => approve(s)}>
                  <Check size={13} /> Aprobar
                </button>
              </div>
              {expanded === s.id && s.lyrics && <pre className="admin-lyrics-preview">{s.lyrics}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### Task 12: SuggestionsPage (feedback inbox)

**Files:**
- Modify: `src/admin/pages/SuggestionsPage.tsx`

- [ ] **Step 1: Implement SuggestionsPage**

```tsx
import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Filter } from "lucide-react";
import { fetchFeedbackPaginated } from "../services/adminQueries";
import { supabase } from "@/services/supabase";

interface Feedback {
  id: string; user_email: string | null; message: string;
  category: string; status: string; admin_note: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  unread: "var(--blue)", in_review: "var(--gold)",
  implemented: "var(--green)", dismissed: "var(--text-muted)"
};
const STATUS_LABELS: Record<string, string> = {
  unread: "Sin leer", in_review: "En revisión",
  implemented: "Implementado", dismissed: "Descartado"
};

export default function SuggestionsPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const ps = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchFeedbackPaginated(page, ps, { status: filterStatus, category: filterCategory });
      setItems(r.data); setTotal(r.count);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, filterStatus, filterCategory]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("feedback").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const saveNote = async (id: string) => {
    await supabase.from("feedback").update({ admin_note: noteInput, updated_at: new Date().toISOString() }).eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, admin_note: noteInput } : i));
  };

  const selected = items.find(i => i.id === selectedId);

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <MessageSquare size={24} color="var(--blue)" /> Sugerencias
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>{total} sugerencias</p>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select className="admin-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }}>
          <option value="all">Todos los estados</option>
          <option value="unread">Sin leer</option>
          <option value="in_review">En revisión</option>
          <option value="implemented">Implementado</option>
          <option value="dismissed">Descartado</option>
        </select>
        <select className="admin-select" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(0); }}>
          <option value="all">Todas las categorías</option>
          <option value="bug">Bug</option>
          <option value="feature">Sugerencia</option>
          <option value="content">Contenido</option>
          <option value="general">General</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedId ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(item => (
            <div key={item.id} onClick={() => { setSelectedId(item.id); setNoteInput(item.admin_note ?? ""); }}
              className="admin-report-card" style={{ cursor: "pointer", borderColor: selectedId === item.id ? "var(--gold)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{item.user_email ?? "Anónimo"}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                    {item.category}
                  </span>
                </div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, color: STATUS_COLORS[item.status] ?? "var(--text-muted)", fontWeight: 600 }}>
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.message}
              </p>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>

        {selected && (
          <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, position: "sticky", top: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Detalle</h3>
              <button className="admin-btn-icon" onClick={() => setSelectedId(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{selected.user_email ?? "Anónimo"} · {selected.category} · {new Date(selected.created_at).toLocaleDateString()}</p>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>{selected.message}</p>
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Nota interna</label>
              <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3}
                style={{ width: "100%", marginTop: 6, padding: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, resize: "vertical" }} />
              <button className="admin-btn-secondary" style={{ marginTop: 8 }} onClick={() => saveNote(selected.id)}>Guardar nota</button>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["unread","in_review","implemented","dismissed"].map(s => (
                <button key={s} className={`admin-action-btn ${selected.status === s ? "gold" : ""}`}
                  style={selected.status === s ? {} : { background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                  onClick={() => updateStatus(selected.id, s)}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

**End of Part 4.** Part 5 covers Tasks 13-16 (Global Library, Activity Logs, Plans, Sidebar button + Feedback FAB).
