import { useEffect, useState, useCallback } from "react";
import { AlertCircle, Music, CheckCircle, Trash2, Calendar, FileText, X } from "lucide-react";
import { fetchReportsPaginated } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";
import { db } from "@/db";

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
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [lyricsText, setLyricsText] = useState("");
  const [titleText, setTitleText] = useState("");
  const [savingLyrics, setSavingLyrics] = useState(false);
  const pageSize = 50;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchReportsPaginated(page, pageSize);
      setReports(r.data); setTotalCount(r.count);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const resolveReport = async (report: Report) => {
    try {
      const { error, count } = await supabase.from("song_reports").delete({ count: "exact" }).eq("id", report.id);
      if (error) throw error;
      if (count === 0) throw new Error("No se pudo eliminar el reporte. Posible falta de permisos RLS.");
      
      await logAdminAction({
        action: "resolve_report", targetType: "report", targetId: report.id,
        targetLabel: report.songs?.title ?? "unknown"
      });
      setReports(prev => prev.filter(r => r.id !== report.id));
      setTotalCount(c => c - 1);
    } catch (err: any) { 
      console.error(err);
      alert(`Error al resolver reporte: ${err.message}`); 
    }
  };

  const deleteSong = async (report: Report) => {
    if (!confirm(`¿ELIMINAR la canción "${report.songs?.title}"? Esto es irreversible.`)) return;
    try {
      await supabase.from("song_reports").delete().eq("song_id", report.song_id);
      const { error, count } = await supabase.from("songs").delete({ count: "exact" }).eq("id", report.song_id);
      if (error) throw error;
      if (count === 0) throw new Error("No se pudo eliminar la canción. Verifica permisos RLS.");

      // Eliminar de Dexie (biblioteca local)
      await db.songs.where('remoteId').equals(report.song_id).delete();

      await logAdminAction({
        action: "delete_song", targetType: "song", targetId: String(report.song_id),
        targetLabel: report.songs?.title ?? "unknown", note: `Razón reporte: ${report.reason}`
      });
      setReports(prev => prev.filter(r => r.song_id !== report.song_id));
      load();
    } catch (err: any) { 
      console.error(err);
      alert(`Error al eliminar canción: ${err.message}`); 
    }
  };

  const saveLyrics = async (report: Report) => {
    if (!titleText.trim()) return alert("El título no puede estar vacío");
    setSavingLyrics(true);
    try {
      const { data, error } = await supabase.from("songs").update({ title: titleText, lyrics: lyricsText }).eq("id", report.song_id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No se pudo actualizar la canción. Revisa permisos RLS o conexión.");
      
      // Sincronizar a Dexie (biblioteca local)
      await db.songs.where('remoteId').equals(report.song_id).modify({
        title: titleText,
        lyrics: lyricsText,
        updatedAt: new Date(),
      });

      logAdminAction({
        action: "edit_song", targetType: "song", targetId: String(report.song_id),
        targetLabel: titleText, note: "Canción editada desde reporte"
      }).catch(console.error);

      setReports(prev => prev.map(r => r.id === report.id ? { ...r, songs: { ...r.songs!, title: titleText, lyrics: lyricsText } } : r));
      setEditingReport(null);
      alert("¡Canción actualizada correctamente!");
    } catch (err: any) { 
      console.error(err);
      alert(`Error al guardar la letra: ${err.message || "Permiso denegado o timeout."}`); 
    }
    finally { setSavingLyrics(false); }
  };

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AlertCircle size={24} color="var(--red)" /> Reportes de Canciones
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>{totalCount} reportes abiertos</p>

      {loading ? (
        <div className="admin-page-loading"><div className="admin-spinner" /></div>
      ) : reports.length === 0 ? (
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
                  <button className="admin-action-btn gold" onClick={() => {
                    setEditingReport(r);
                    setLyricsText(r.songs?.lyrics || "");
                    setTitleText(r.songs?.title || "");
                  }}>
                    <FileText size={13} /> Editar Canción
                  </button>
                  <button className="admin-action-btn danger" onClick={() => deleteSong(r)}><Trash2 size={13} /> Eliminar</button>
                  <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff" }} onClick={() => resolveReport(r)}>
                    <CheckCircle size={13} /> Resuelto
                  </button>
                </div>
              </div>
              {r.details && <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-secondary)", borderLeft: "3px solid var(--border)", paddingLeft: 12 }}>{r.details}</p>}
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

      {editingReport && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setEditingReport(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '800px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <FileText size={20} color="var(--gold)" /> Editar: {editingReport.songs?.title}
              </h2>
              <button className="admin-btn-icon" onClick={() => setEditingReport(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: "16px 24px 0", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>Título</label>
              <input 
                type="text" 
                value={titleText} 
                onChange={e => setTitleText(e.target.value)}
                placeholder="Título de la canción"
                style={{ 
                  width: "100%", padding: "12px 16px", 
                  background: "var(--bg-surface)", border: "1px solid var(--border)", 
                  borderRadius: 12, color: "var(--text-primary)", fontSize: 16, outline: "none" 
                }} 
              />
            </div>
            <div style={{ padding: "16px 24px", flex: 1, overflowY: 'auto', display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>Letra</label>
              <textarea
                value={lyricsText}
                onChange={e => setLyricsText(e.target.value)}
                placeholder="Letra de la canción..."
                style={{ 
                  flex: 1,
                  width: "100%", 
                  minHeight: "300px", 
                  padding: 16, 
                  background: "var(--bg-surface)", 
                  border: "1px solid var(--border)", 
                  borderRadius: 12, 
                  color: "var(--text-primary)", 
                  fontSize: 15, 
                  fontFamily: "var(--font-mono, monospace)", 
                  resize: "vertical",
                  outline: "none",
                  lineHeight: 1.6
                }}
              />
            </div>
            <div style={{ padding: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Al guardar, la letra se actualizará para todos los usuarios.
              </span>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="admin-btn-secondary" onClick={() => setEditingReport(null)}>Cancelar</button>
                <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff", padding: "10px 20px" }} disabled={savingLyrics} onClick={() => saveLyrics(editingReport)}>
                  {savingLyrics ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
