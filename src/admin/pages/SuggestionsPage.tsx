import { useEffect, useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { fetchFeedbackPaginated } from "../services/adminQueries";
import { supabase } from "@/services/supabase";

interface Feedback {
  id: string; user_email: string | null; message: string;
  category: string; status: string; admin_note: string | null; created_at: string;
}

const SL: Record<string, string> = { unread: "Sin leer", in_review: "En revisión", implemented: "Implementado", dismissed: "Descartado" };
const SC: Record<string, string> = { unread: "var(--blue)", in_review: "var(--gold)", implemented: "var(--green)", dismissed: "var(--text-muted)" };

export default function SuggestionsPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [selId, setSelId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { const r = await fetchFeedbackPaginated(page, 50, { status: fStatus, category: fCat }); setItems(r.data); setTotal(r.count); }
    catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  }, [page, fStatus, fCat]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("feedback").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setItems(p => p.map(i => i.id === id ? { ...i, status } : i));
  };

  const saveNote = async (id: string) => {
    await supabase.from("feedback").update({ admin_note: note, updated_at: new Date().toISOString() }).eq("id", id);
    setItems(p => p.map(i => i.id === id ? { ...i, admin_note: note } : i));
  };

  const sel = items.find(i => i.id === selId);

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><MessageSquare size={24} color="var(--blue)" /> Sugerencias</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>{total} sugerencias</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select className="admin-select" value={fStatus} onChange={e => { setFStatus(e.target.value); setPage(0); }}>
          <option value="all">Todos los estados</option>
          <option value="unread">Sin leer</option><option value="in_review">En revisión</option>
          <option value="implemented">Implementado</option><option value="dismissed">Descartado</option>
        </select>
        <select className="admin-select" value={fCat} onChange={e => { setFCat(e.target.value); setPage(0); }}>
          <option value="all">Todas</option><option value="bug">Bug</option>
          <option value="feature">Sugerencia</option><option value="content">Contenido</option><option value="general">General</option>
        </select>
      </div>
      {loading ? <div className="admin-page-loading"><div className="admin-spinner" /></div> : (
        <div style={{ display: "grid", gridTemplateColumns: selId ? "1fr 1fr" : "1fr", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(item => (
              <div key={item.id} onClick={() => { setSelId(item.id); setNote(item.admin_note ?? ""); }}
                className="admin-report-card" style={{ cursor: "pointer", borderColor: selId === item.id ? "var(--gold)" : undefined }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{item.user_email ?? "Anónimo"}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>{item.category}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: SC[item.status] ?? "var(--text-muted)" }}>{SL[item.status] ?? item.status}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.message}</p>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            ))}
            {items.length === 0 && <div className="admin-empty-state"><p>No hay sugerencias.</p></div>}
          </div>
          {sel && (
            <div style={{ background: "var(--bg-elevated)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, position: "sticky", top: 0, alignSelf: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Detalle</h3>
                <button className="admin-btn-icon" onClick={() => setSelId(null)}>✕</button>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{sel.user_email ?? "Anónimo"} · {sel.category} · {new Date(sel.created_at).toLocaleDateString()}</p>
              <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 12 }}>{sel.message}</p>
              <div style={{ marginTop: 20 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Nota interna</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                  style={{ width: "100%", marginTop: 6, padding: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, resize: "vertical" }} />
                <button className="admin-btn-secondary" style={{ marginTop: 8 }} onClick={() => saveNote(sel.id)}>Guardar nota</button>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["unread", "in_review", "implemented", "dismissed"] as const).map(s => (
                  <button key={s} className={`admin-action-btn ${sel.status === s ? "gold" : ""}`}
                    style={sel.status === s ? {} : { background: "var(--bg-hover)", color: "var(--text-secondary)" }}
                    onClick={() => updateStatus(sel.id, s)}>{SL[s]}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
