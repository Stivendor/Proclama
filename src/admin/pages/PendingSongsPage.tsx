import { useEffect, useState, useCallback } from "react";
import { Clock, Check, X, ChevronDown, ChevronUp, Edit2, Globe, Calendar, Music, AlertCircle, FileText } from "lucide-react";
import { fetchPendingSongs } from "../services/adminQueries";
import { logAdminAction } from "../services/adminLogs";
import { supabase } from "@/services/supabase";
import { useAppStore } from "@/stores";
import { db } from "@/db";
import { motion, AnimatePresence } from "framer-motion";

interface PendingSong {
  id: number;
  title: string;
  artist: string | null;
  language: string | null;
  lyrics: string | null;
  created_at: string;
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
  const isEditorOpen = useAppStore(s => s.isEditorOpen);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetchPendingSongs(page, 50);
      setSongs(r.data);
      setTotal(r.count);
    } catch (e) { 
      console.error(e); 
    } finally { 
      if (!silent) setLoading(false); 
    }
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
        setSelected(p => { const n = new Set(p); n.delete(editingSongLocal.id); return n; });
        
        try {
          await db.songs.where("remoteId").equals(editingSongLocal.id).modify({ isVerified: true, title: titleText, artist: artistText, lyrics: lyricsText, language: languageText });
        } catch (e) {}
      } else {
        setSongs(prev => prev.map(s => s.id === editingSongLocal.id ? { ...s, title: titleText, artist: artistText, lyrics: lyricsText, language: languageText } : s));
      }

      setEditingSongLocal(null);
      // alert(approveAfter ? "¡Canción guardada y aprobada!" : "¡Cambios guardados!");
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
      
      try {
        await db.songs.where("remoteId").equals(song.id).modify({ isVerified: true });
      } catch (e) { }

      setSongs(prev => prev.filter(s => s.id !== song.id));
      setTotal(t => t - 1);
      setSelected(p => { const n = new Set(p); n.delete(song.id); return n; });
    } catch (err: any) {
      alert(`Error al aprobar: ${err.message}`);
    }
  };

  const reject = async (song: PendingSong) => {
    const reason = window.prompt(`¿Rechazar "${song.title}"? Indica el motivo para el autor:`, "Letra incompleta o incorrecta");
    if (reason === null) return;

    try {
      // Usamos .select() para asegurar que la actualización ocurrió (o falló por RLS)
      const { data, error } = await supabase
        .from("songs")
        .update({ 
          is_public: false, 
          is_verified: false, 
          rejection_reason: reason || null 
        })
        .eq("id", song.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No se pudo rechazar. Posible falta de permisos RLS en la tabla songs.");
      
      // Intentar actualizar localmente si existe usando remoteId
      try {
        await db.songs.where("remoteId").equals(song.id).modify({ 
          isPublic: false, 
          isVerified: false, 
          rejectionReason: reason || undefined 
        });
      } catch (e) {
        console.warn("No local match to update", e);
      }

      await logAdminAction({ action: "reject_song", targetType: "song", targetId: String(song.id), targetLabel: song.title });
      
      setSongs(prev => prev.filter(s => s.id !== song.id));
      setTotal(t => t - 1);
      setSelected(p => { const n = new Set(p); n.delete(song.id); return n; });
    } catch (err: any) {
      console.error(err);
      alert(`Error al rechazar: ${err.message}`);
    }
  };

  const bulkApprove = async () => {
    if (!selected.size || !confirm(`¿Aprobar ${selected.size} canciones?`)) return;
    for (const id of selected) { 
      const s = songs.find(x => x.id === id); 
      if (s) await approve(s); 
    }
    setSelected(new Set());
  };

  const toggle = (id: number) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="admin-page" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto", color: "var(--text-primary)" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{ padding: "10px", background: "rgba(var(--gold-rgb, 212, 175, 55), 0.1)", borderRadius: "12px" }}>
              <Clock size={28} color="var(--gold)" />
            </div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700, letterSpacing: "-0.5px" }}>Canciones Pendientes</h1>
          </div>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertCircle size={16} /> Requieren moderación para ser públicas ({total})
          </p>
        </div>
        
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.button 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={bulkApprove}
              style={{ 
                background: "var(--green)", color: "#fff", padding: "10px 24px", 
                borderRadius: "12px", border: "none", fontWeight: 600, fontSize: "14px",
                display: "flex", alignItems: "center", gap: "8px", cursor: "pointer",
                boxShadow: "0 4px 12px rgba(var(--green-rgb, 46, 204, 113), 0.3)",
                transition: "transform 0.2s"
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Check size={18} strokeWidth={3} /> Aprobar {selected.size} seleccionadas
            </motion.button>
          )}
        </AnimatePresence>
      </header>

      {loading && songs.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <div className="admin-spinner" style={{ width: "40px", height: "40px", borderTopColor: "var(--gold)" }} />
        </div>
      ) : songs.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ 
            display: "flex", flexDirection: "column", alignItems: "center", 
            justifyContent: "center", padding: "6rem 2rem", background: "var(--bg-elevated)", 
            borderRadius: "20px", border: "1px dashed var(--border)", textAlign: "center"
          }}
        >
          <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--bg-surface)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
            <Check size={40} color="var(--green)" style={{ opacity: 0.8 }} />
          </div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "20px" }}>Todo al día</h3>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>No hay canciones pendientes de moderación en este momento.</p>
        </motion.div>
      ) : (
        <motion.div 
          initial="hidden" animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {songs.map(s => (
            <motion.div 
              key={s.id} 
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              style={{ 
                background: "var(--bg-elevated)",
                borderRadius: "16px",
                border: selected.has(s.id) ? "1px solid var(--gold)" : "1px solid var(--border)",
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                transition: "border-color 0.2s"
              }}
            >
              <div style={{
                padding: "20px",
                display: "flex",
                alignItems: "center",
                gap: "20px",
                flexWrap: "wrap"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}>
                  <input 
                    type="checkbox" 
                    checked={selected.has(s.id)} 
                    onChange={() => toggle(s.id)} 
                    style={{ accentColor: "var(--gold)", width: 20, height: 20, cursor: "pointer", margin: 0 }} 
                  />
                </div>
                
                <div style={{ flex: 1, minWidth: "250px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "var(--text-primary)" }}>{s.title}</h3>
                    {s.artist && (
                      <span style={{ 
                        background: "var(--bg-surface)", padding: "4px 10px", 
                        borderRadius: "20px", fontSize: "13px", color: "var(--text-secondary)",
                        display: "flex", alignItems: "center", gap: "6px"
                      }}>
                        <Music size={12} /> {s.artist}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "16px", color: "var(--text-muted)", fontSize: "13px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Globe size={14} /> {s.language ?? "Español"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={14} /> {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <button 
                    onClick={() => {
                      setEditingSongLocal(s);
                      setTitleText(s.title);
                      setArtistText(s.artist || "");
                      setLyricsText(s.lyrics || "");
                      setLanguageText(s.language || "Español");
                    }}
                    style={{ 
                      background: "var(--bg-surface)", border: "1px solid var(--border)", 
                      color: "var(--text-primary)", padding: "8px 16px", borderRadius: "10px",
                      display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "all 0.2s"
                    }}
                    onMouseOver={e => e.currentTarget.style.background = "var(--bg-hover)"}
                    onMouseOut={e => e.currentTarget.style.background = "var(--bg-surface)"}
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                  
                  <button 
                    onClick={() => reject(s)}
                    title="Rechazar"
                    style={{ 
                      background: "transparent", border: "1px solid rgba(231, 76, 60, 0.3)", 
                      color: "#e74c3c", padding: "8px 16px", borderRadius: "10px",
                      display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "all 0.2s"
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = "rgba(231, 76, 60, 0.1)"; e.currentTarget.style.borderColor = "#e74c3c"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(231, 76, 60, 0.3)"; }}
                  >
                    <X size={16} /> Rechazar
                  </button>
                  
                  <button 
                    onClick={() => approve(s)}
                    style={{ 
                      background: "var(--green)", border: "none", 
                      color: "#fff", padding: "8px 20px", borderRadius: "10px",
                      display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s"
                    }}
                    onMouseOver={e => e.currentTarget.style.filter = "brightness(1.1)"}
                    onMouseOut={e => e.currentTarget.style.filter = "brightness(1)"}
                  >
                    <Check size={16} strokeWidth={2.5} /> Aprobar
                  </button>
                  
                  <button 
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    style={{ 
                      background: expanded === s.id ? "var(--bg-surface)" : "transparent", 
                      border: "none", color: "var(--text-secondary)", padding: "10px", 
                      borderRadius: "50%", cursor: "pointer", transition: "all 0.2s",
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                    onMouseOver={e => e.currentTarget.style.color = "var(--text-primary)"}
                    onMouseOut={e => e.currentTarget.style.color = "var(--text-secondary)"}
                  >
                    {expanded === s.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expanded === s.id && s.lyrics && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ 
                      background: "var(--bg-surface)", 
                      borderTop: "1px solid var(--border)",
                      padding: "24px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "var(--text-muted)" }}>
                        <FileText size={16} /> <span style={{ fontSize: "14px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "1px" }}>Letra Original</span>
                      </div>
                      <pre style={{ 
                        margin: 0, whiteSpace: "pre-wrap", fontSize: "14px", 
                        color: "var(--text-primary)", lineHeight: 1.8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        maxHeight: "350px", overflowY: "auto", paddingRight: "16px"
                      }}>
                        {s.lyrics}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal de Edición Local */}
      <AnimatePresence>
        {editingSongLocal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ 
              zIndex: 9999, position: "fixed", top: 0, left: 0, right: 0, bottom: 0, 
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", 
              display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" 
            }} 
            onClick={() => setEditingSongLocal(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()} 
              style={{ 
                width: "900px", maxWidth: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", 
                background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "24px", 
                overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" 
              }}
            >
              <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)" }}>
                <h2 style={{ margin: 0, fontSize: "20px", display: "flex", alignItems: "center", gap: "12px", fontWeight: 600 }}>
                  <div style={{ padding: "8px", background: "rgba(var(--gold-rgb, 212, 175, 55), 0.1)", borderRadius: "10px" }}>
                    <Edit2 size={20} color="var(--gold)" />
                  </div>
                  Moderar canción: <span style={{ color: "var(--gold)", fontWeight: 500 }}>{editingSongLocal.title}</span>
                </h2>
                <button 
                  onClick={() => setEditingSongLocal(null)} 
                  style={{ background: "var(--bg-hover)", border: "none", color: "var(--text-secondary)", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={e => e.currentTarget.style.color = "var(--text-primary)"}
                  onMouseOut={e => e.currentTarget.style.color = "var(--text-secondary)"}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ padding: "32px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "span 1" }}>
                    <label style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>Título</label>
                    <input type="text" value={titleText} onChange={e => setTitleText(e.target.value)} style={{ width: "100%", padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "15px", outline: "none", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = "var(--gold)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "span 1" }}>
                    <label style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>Artista</label>
                    <input type="text" value={artistText} onChange={e => setArtistText(e.target.value)} style={{ width: "100%", padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "15px", outline: "none", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = "var(--gold)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "span 1" }}>
                    <label style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>Idioma</label>
                    <select value={languageText} onChange={e => setLanguageText(e.target.value)} style={{ width: "100%", padding: "14px 16px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text-primary)", fontSize: "15px", outline: "none", cursor: "pointer", appearance: "none" }}>
                      <option value="Español">Español</option>
                      <option value="Inglés">Inglés</option>
                      <option value="Portugués">Portugués</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                  <label style={{ fontSize: "14px", color: "var(--text-secondary)", fontWeight: 500 }}>Letra</label>
                  <textarea value={lyricsText} onChange={e => setLyricsText(e.target.value)} style={{ flex: 1, width: "100%", minHeight: "350px", padding: "20px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "16px", color: "var(--text-primary)", fontSize: "15px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", lineHeight: 1.8, outline: "none", resize: "none", transition: "border-color 0.2s" }} onFocus={e => e.target.style.borderColor = "var(--gold)"} onBlur={e => e.target.style.borderColor = "var(--border)"} />
                </div>
              </div>

              <div style={{ padding: "24px 32px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-surface)" }}>
                <button 
                  onClick={() => setEditingSongLocal(null)} 
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "12px 24px", borderRadius: "12px", fontSize: "15px", fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseOver={e => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}
                >
                  Cancelar
                </button>
                <div style={{ display: "flex", gap: "16px" }}>
                  <button 
                    onClick={() => saveChanges(false)} 
                    disabled={saving}
                    style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "12px 24px", borderRadius: "12px", fontSize: "15px", fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.2s" }}
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button 
                    onClick={() => saveChanges(true)} 
                    disabled={saving}
                    style={{ background: "var(--green)", border: "none", color: "#fff", padding: "12px 28px", borderRadius: "12px", fontSize: "15px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(var(--green-rgb, 46, 204, 113), 0.3)", transition: "all 0.2s" }}
                    onMouseOver={e => !saving && (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseOut={e => !saving && (e.currentTarget.style.transform = "none")}
                  >
                    <Check size={18} strokeWidth={2.5} /> {saving ? 'Procesando...' : 'Guardar y Aprobar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
