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

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchPendingSongs(page, 50);
      setSongs(r.data); setTotal(r.count);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const approve = async (song: PendingSong) => {
    try {
      const { data, error } = await supabase.from("songs").update({ is_verified: true }).eq("id", song.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No se pudo aprobar. Posible falta de permisos RLS.");
      
      await logAdminAction({ action: "approve_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
      setSongs(prev => prev.filter(s => s.id !== song.id));
      setTotal(t => t - 1);
    } catch (err: any) {
      alert(`Error al aprobar: ${err.message}`);
    }
  };

  const reject = async (song: PendingSong) => {
    if (!confirm(`¿Rechazar y eliminar "${song.title}"?`)) return;
    try {
      const { error, count } = await supabase.from("songs").delete({ count: "exact" }).eq("id", song.id);
      if (error) throw error;
      if (count === 0) throw new Error("No se pudo rechazar. Posible falta de permisos RLS.");
      await logAdminAction({ action: "reject_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
      setSongs(prev => prev.filter(s => s.id !== song.id));
      setTotal(t => t - 1);
    } catch (err: any) {
      alert(`Error al rechazar: ${err.message}`);
    }
  };

  const bulkApprove = async () => {
    if (!selected.size || !confirm(`¿Aprobar ${selected.size} canciones?`)) return;
    for (const id of selected) { const s = songs.find(x => x.id === id); if (s) await approve(s); }
    setSelected(new Set());
  };

  const toggle = (id: number) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}><Clock size={24} color="var(--gold)" /> Pendientes</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{total} canciones</p>
        </div>
        {selected.size > 0 && (
          <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff", padding: "8px 20px" }} onClick={bulkApprove}>
            <Check size={14} /> Aprobar {selected.size}
          </button>
        )}
      </div>
      {loading ? <div className="admin-page-loading"><div className="admin-spinner" /></div>
       : songs.length === 0 ? <div className="admin-empty-state"><Check size={40} style={{ opacity: 0.3 }} /><p>No hay pendientes.</p></div>
       : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {songs.map(s => (
            <div key={s.id} className="admin-report-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} style={{ accentColor: "var(--gold)", width: 16, height: 16 }} />
                <div style={{ flex: 1 }}>
                  <strong>{s.title}</strong>{s.artist && <span style={{ color: "var(--text-secondary)" }}> — {s.artist}</span>}
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{s.language ?? ""} · {new Date(s.created_at).toLocaleDateString()}</div>
                </div>
                <button className="admin-btn-icon" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>{expanded === s.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                <button className="admin-action-btn danger" onClick={() => reject(s)}><X size={13} /> Rechazar</button>
                <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff" }} onClick={() => approve(s)}><Check size={13} /> Aprobar</button>
              </div>
              {expanded === s.id && s.lyrics && <pre className="admin-lyrics-preview">{s.lyrics}</pre>}
            </div>
          ))}
        </div>}
    </div>
  );
}
