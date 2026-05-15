import { useEffect, useState, useCallback } from "react";
import { Library, Search, Trash2, Check, FileText, X, RefreshCw, Filter } from "lucide-react";
import DataTable from "../components/DataTable";
import { fetchSongsPaginated } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";

interface Song { id: number; title: string; artist: string | null; language: string | null; lyrics: string | null; is_verified: boolean; created_at: string; }

export default function GlobalLibraryPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterVerified, setFilterVerified] = useState("");
  const [filterLang, setFilterLang] = useState("");
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [titleText, setTitleText] = useState("");
  const [lyricsText, setLyricsText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try { const r = await fetchSongsPaginated(page, 50, { search, verified: filterVerified, language: filterLang }); setSongs(r.data); setTotal(r.count); }
    catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  }, [page, search, filterVerified, filterLang]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput); setPage(0); }, 300); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => { const t = setInterval(() => load(true), 30000); return () => clearInterval(t); }, [load]);

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
    setSongs(p => p.map(s => s.id === song.id ? { ...s, is_verified: v } : s));
  };

  const saveSong = async () => {
    if (!editingSong) return;
    if (!titleText.trim()) return alert("El título no puede estar vacío");
    setSaving(true);
    try {
      const { data, error } = await supabase.from("songs").update({ title: titleText, lyrics: lyricsText }).eq("id", editingSong.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No se pudo actualizar la canción. Revisa permisos RLS o conexión.");
      
      logAdminAction({
        action: "edit_song", targetType: "song", targetId: String(editingSong.id),
        targetLabel: titleText, note: "Editada desde Biblioteca Global"
      }).catch(console.error);

      setSongs(prev => prev.map(s => s.id === editingSong.id ? { ...s, title: titleText, lyrics: lyricsText } : s));
      setEditingSong(null);
      alert("¡Canción actualizada correctamente!");
    } catch (err: any) { 
      console.error(err);
      alert(`Error al guardar la canción: ${err.message || "Permiso denegado."}`); 
    }
    finally { setSaving(false); }
  };

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 4px 0" }}>
            <Library size={24} color="var(--gold)" /> Biblioteca Global
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{total} canciones públicas en total</p>
        </div>
        <button className="admin-action-btn" onClick={() => load(false)} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
          <RefreshCw size={14} className={loading ? "admin-spin" : ""} /> Refrescar
        </button>
      </div>

      <div style={{ 
        display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24, 
        background: "var(--bg-surface)", padding: 16, borderRadius: 12, border: "1px solid var(--border)" 
      }}>
        <div className="admin-search-wrap" style={{ flex: "1 1 300px", margin: 0 }}>
          <Search size={16} className="admin-search-icon" />
          <input 
            placeholder="Buscar título o artista..." 
            value={searchInput} 
            onChange={e => setSearchInput(e.target.value)} 
            style={{ paddingLeft: 36 }}
          />
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-base)", padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <Filter size={14} color="var(--text-muted)" />
            <select style={{ border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: 13 }} value={filterLang} onChange={e => { setFilterLang(e.target.value); setPage(0); }}>
              <option value="">Cualquier Idioma</option>
              <option value="Español">Español</option>
              <option value="Inglés">Inglés</option>
              <option value="Portugués">Portugués</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-base)", padding: "4px 12px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <Check size={14} color="var(--text-muted)" />
            <select style={{ border: "none", background: "transparent", color: "var(--text-primary)", outline: "none", fontSize: 13 }} value={filterVerified} onChange={e => { setFilterVerified(e.target.value); setPage(0); }}>
              <option value="">Cualquier Estado</option>
              <option value="true">Solo Verificadas</option>
              <option value="false">No Verificadas</option>
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={[
          { key: "title", header: "Título", render: (s: Song) => <strong>{s.title}</strong> },
          { key: "artist", header: "Artista", render: (s: Song) => <span style={{ color: "var(--text-secondary)" }}>{s.artist ?? "—"}</span> },
          { key: "lang", header: "Idioma", render: (s: Song) => <span style={{ fontSize: 12 }}>{s.language ?? "—"}</span> },
          { key: "verified", header: "Verificada", render: (s: Song) => (
            <button className={`admin-action-btn ${s.is_verified ? "gold" : ""}`}
              style={s.is_verified ? {} : { background: "var(--bg-hover)", color: "var(--text-muted)" }}
              onClick={() => toggleVerified(s)}><Check size={12} /> {s.is_verified ? "Sí" : "No"}</button>
          )},
          { key: "date", header: "Fecha", render: (s: Song) => <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(s.created_at).toLocaleDateString()}</span> },
          { key: "actions", header: "", align: "right" as const, render: (s: Song) => (
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="admin-action-btn gold" onClick={() => { setEditingSong(s); setTitleText(s.title); setLyricsText(s.lyrics || ""); }}>
                <FileText size={13} /> Editar
              </button>
              <button className="admin-action-btn danger" onClick={() => deleteSong(s)}><Trash2 size={13} /></button>
            </div>
          )}
        ]}
        data={songs} totalCount={total} page={page} pageSize={50}
        onPageChange={setPage} loading={loading} rowKey={(s: Song) => String(s.id)}
      />

      {editingSong && (
        <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setEditingSong(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '800px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: 24, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <FileText size={20} color="var(--gold)" /> Editar Canción
              </h2>
              <button className="admin-btn-icon" onClick={() => setEditingSong(null)}><X size={20} /></button>
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
                  flex: 1, width: "100%", minHeight: "300px", padding: 16, 
                  background: "var(--bg-surface)", border: "1px solid var(--border)", 
                  borderRadius: 12, color: "var(--text-primary)", fontSize: 15, 
                  fontFamily: "var(--font-mono, monospace)", resize: "vertical", outline: "none", lineHeight: 1.6
                }}
              />
            </div>
            <div style={{ padding: 24, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="admin-btn-secondary" onClick={() => setEditingSong(null)}>Cancelar</button>
              <button className="admin-action-btn" style={{ background: "var(--green)", color: "#fff", padding: "10px 20px" }} disabled={saving} onClick={saveSong}>
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
