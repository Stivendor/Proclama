import { useEffect, useState, useCallback } from "react";
import { Clock, Check, X, ChevronDown, ChevronUp, Edit2, Globe, Calendar, AlertCircle } from "lucide-react";
import { fetchPendingSongs } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase, updateSong } from "@/services/supabase";
import { useAppStore } from "@/stores";
import { db } from "@/db";

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
  
  // Estados para el modal de edición
  const [editingSongLocal, setEditingSongLocal] = useState<PendingSong | null>(null);
  const [titleText, setTitleText] = useState("");
  const [artistText, setArtistText] = useState("");
  const [lyricsText, setLyricsText] = useState("");
  const [languageText, setLanguageText] = useState("");
  const [saving, setSaving] = useState(false);
  const openEditor = useAppStore(s => s.openEditor);
  const isEditorOpen = useAppStore(s => s.isEditorOpen);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchPendingSongs(page, 50);
      setSongs(r.data); setTotal(r.count);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load, isEditorOpen]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const saveChanges = async (approveAfter = false) => {
    if (!editingSongLocal) return;
    if (!titleText.trim()) return alert("El título es requerido");
    
    setSaving(true);
    try {
      const updates = {
        title: titleText,
        artist: artistText,
        lyrics: lyricsText,
        language: languageText,
        updated_at: new Date().toISOString(),
        ...(approveAfter && { is_verified: true })
      };

      const { error } = await supabase.from("songs").update(updates).eq("id", editingSongLocal.id);
      if (error) throw error;

      await logAdminAction({ 
        action: approveAfter ? "approve_song" : "edit_song", 
        targetType: "song", 
        targetId: String(editingSongLocal.id), 
        targetLabel: titleText 
      });

      if (approveAfter) {
        setSongs(prev => prev.filter(s => s.id !== editingSongLocal.id));
        setTotal(t => t - 1);
      } else {
        setSongs(prev => prev.map(s => s.id === editingSongLocal.id ? { ...s, title: titleText, artist: artistText, lyrics: lyricsText, language: languageText } : s));
      }

      setEditingSongLocal(null);
      alert(approveAfter ? "¡Canción guardada y aprobada!" : "¡Cambios guardados!");
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

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
    const reason = window.prompt(`¿Rechazar "${song.title}"? Indica el motivo para el autor:`, "Letra incompleta o incorrecta");
    if (reason === null) return;

    try {
      // En lugar de borrar, la hacemos privada y añadimos el motivo
      const { error } = await supabase
        .from("songs")
        .update({ 
          is_public: false, 
          is_verified: false, 
          rejection_reason: reason || null 
        })
        .eq("id", song.id);

      if (error) throw error;
      
      // Intentar actualizar localmente si existe
      await db.songs.update(song.id, { isPublic: false, isVerified: false, rejectionReason: reason || undefined });

      await logAdminAction({ action: "reject_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
      setSongs(prev => prev.filter(s => s.id !== song.id));
      setTotal(t => t - 1);
      alert('Canción rechazada y enviada a privado con el motivo.');
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
       : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {songs.map(s => (
            <div 
              key={s.id} 
              className="admin-report-card"
              style={{ 
                background: 'var(--bg-elevated)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* Contenedor principal de la fila */}
              <div style={{
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                width: '100%',
                flexWrap: 'wrap'
              }}>
                <input 
                  type="checkbox" 
                  checked={selected.has(s.id)} 
                  onChange={() => toggle(s.id)} 
                  style={{ accentColor: "var(--gold)", width: 18, height: 18, cursor: 'pointer' }} 
                />
                
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{s.title}</strong>
                    {s.artist && <span style={{ color: "var(--text-secondary)", fontSize: '14px' }}>— {s.artist}</span>}
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: 4, color: "var(--text-muted)", fontSize: "12px" }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={12} /> {s.language ?? "Español"}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: 'wrap' }}>
                  <button 
                    className="admin-action-btn secondary" 
                    style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '8px 12px' }}
                    onClick={() => {
                      setEditingSongLocal(s);
                      setTitleText(s.title);
                      setArtistText(s.artist || "");
                      setLyricsText(s.lyrics || "");
                      setLanguageText(s.language || "Español");
                    }}
                  >
                    <Edit2 size={14} /> Editar
                  </button>
                  
                  <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>
                  
                  <button 
                    className="admin-action-btn danger" 
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '8px' }}
                    onClick={() => reject(s)}
                    title="Rechazar"
                  >
                    <X size={18} />
                  </button>
                  
                  <button 
                    className="admin-action-btn" 
                    style={{ background: "var(--green)", color: "#fff", padding: "8px 16px", fontWeight: 600 }} 
                    onClick={() => approve(s)}
                  >
                    <Check size={14} /> Aprobar
                  </button>
                  
                  <button 
                    className="admin-btn-icon" 
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    style={{ marginLeft: '4px' }}
                  >
                    {expanded === s.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {/* Caja de letras colapsable (Fluida y Estática) */}
              {expanded === s.id && s.lyrics && (
                <div style={{ 
                  background: 'var(--bg-surface)', 
                  borderTop: '1px solid var(--border)',
                  padding: '1.5rem',
                  maxHeight: '300px', 
                  overflowY: 'auto'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: 'monospace' }}>
                    {s.lyrics}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>}

      {/* Modal de Edición Local */}
      {editingSongLocal && (
        <div className="modal-overlay" style={{ zIndex: 9999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setEditingSongLocal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '850px', maxWidth: '95%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit2 size={20} color="var(--gold)" /> Moderar canción: {editingSongLocal.title}
              </h2>
              <button className="admin-btn-icon" onClick={() => setEditingSongLocal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Título</label>
                  <input type="text" value={titleText} onChange={e => setTitleText(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '15px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Artista</label>
                  <input type="text" value={artistText} onChange={e => setArtistText(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '15px' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Idioma</label>
                <select value={languageText} onChange={e => setLanguageText(e.target.value)} style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '15px' }}>
                  <option value="Español">Español</option>
                  <option value="Inglés">Inglés</option>
                  <option value="Portugués">Portugués</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Letra</label>
                <textarea value={lyricsText} onChange={e => setLyricsText(e.target.value)} style={{ flex: 1, width: '100%', minHeight: '300px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'monospace', lineHeight: 1.6 }} />
              </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.1)' }}>
              <button className="admin-action-btn secondary" onClick={() => setEditingSongLocal(null)} style={{ padding: '10px 20px' }}>Cancelar</button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="admin-action-btn" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '10px 20px' }} onClick={() => saveChanges(false)} disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar solo'}
                </button>
                <button className="admin-action-btn" style={{ background: 'var(--green)', color: '#fff', padding: '10px 24px', fontWeight: 600 }} onClick={() => saveChanges(true)} disabled={saving}>
                  {saving ? 'Procesando...' : 'Guardar y Aprobar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
