import { useEffect, useState } from "react";
import { Film, Plus, Trash2, ExternalLink, AlertCircle, Tag, Check, X, Pencil } from "lucide-react";
import { supabase } from "@/services/supabase";

interface BgVideo {
  id: string;
  url: string;
  category: string | null;
  created_at: string;
}

const DEFAULT_LABELS = ["adoracion", "predica", "bienvenidos", "silencio", "anuncios", "paisajes", "biblia", "abstracto"];

function isValidUrl(url: string): boolean {
  try { new URL(url); return true; } catch { return false; }
}

const LABEL_COLORS: Record<string, string> = {};
const PALETTE = [
  "rgba(212,175,55,0.15)/var(--gold)/rgba(212,175,55,0.3)",
  "rgba(99,179,237,0.15)/#63b3ed/rgba(99,179,237,0.3)",
  "rgba(154,205,50,0.15)/#9acd32/rgba(154,205,50,0.3)",
  "rgba(237,137,54,0.15)/#ed8936/rgba(237,137,54,0.3)",
  "rgba(183,148,244,0.15)/#b794f4/rgba(183,148,244,0.3)",
  "rgba(252,129,129,0.15)/#fc8181/rgba(252,129,129,0.3)",
];
function labelStyle(label: string) {
  if (!LABEL_COLORS[label]) {
    const idx = Object.keys(LABEL_COLORS).length % PALETTE.length;
    LABEL_COLORS[label] = PALETTE[idx];
  }
  const [bg, color, border] = LABEL_COLORS[label].split("/");
  return { background: bg, color, border: `1px solid ${border}`, fontSize: 11, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" as const };
}

export default function BackgroundsPage() {
  const [items, setItems] = useState<BgVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [allLabels, setAllLabels] = useState<string[]>(DEFAULT_LABELS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const loadLabels = async (rows: BgVideo[]) => {
    const fromDB = rows.map(r => r.category).filter(Boolean) as string[];
    const merged = Array.from(new Set([...DEFAULT_LABELS, ...fromDB])).sort();
    setAllLabels(merged);
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("backgrounds")
      .select("id, url, category, created_at")
      .eq("type", "video")
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    setItems(rows);
    loadLabels(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const valid = isValidUrl(url.trim());

  const handleAdd = async () => {
    setError("");
    const trimmed = url.trim();
    if (!trimmed) { setError("Ingresa la URL del video en R2."); return; }
    if (!valid) { setError("La URL no es válida."); return; }

    setAdding(true);
    const { error: err } = await supabase.from("backgrounds").insert({
      url: trimmed,
      thumbnail_url: null,
      type: "video",
      category: category.trim() || null,
    });
    setAdding(false);

    if (err) { setError("Error al guardar: " + err.message); return; }
    setUrl("");
    setCategory("");
    load();
  };

  const startEdit = (item: BgVideo) => {
    setEditingId(item.id);
    setEditingLabel(item.category ?? "");
  };

  const cancelEdit = () => { setEditingId(null); setEditingLabel(""); };

  const saveLabel = async (id: string) => {
    const val = editingLabel.trim() || null;
    const { error: err } = await supabase.from("backgrounds").update({ category: val }).eq("id", id);
    if (err) return;
    setItems(prev => prev.map(i => i.id === id ? { ...i, category: val } : i));
    const updated = items.map(i => i.id === id ? { ...i, category: val } : i);
    loadLabels(updated);
    cancelEdit();
  };

  return (
    <div className="admin-page">
      <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Film size={24} color="var(--gold)" /> Fondos — Videos
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        Agrega videos desde Cloudflare R2. Sube el archivo MP4 a tu bucket y pega la URL pública aquí.
      </p>

      {/* ── Etiquetas disponibles ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, padding: 20, marginBottom: 24, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Tag size={15} color="var(--gold)" />
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Etiquetas</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— escribe una nueva en el campo de abajo para crearla automáticamente</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {allLabels.map(l => (
            <span key={l} style={labelStyle(l)}>{l}</span>
          ))}
        </div>
      </div>

      {/* ── Formulario ── */}
      <div style={{ background: "var(--bg-elevated)", borderRadius: 12, padding: 24, marginBottom: 32, border: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: 16 }}>Agregar video</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, marginBottom: 12 }}>
          <input
            className="admin-input"
            placeholder="https://tu-bucket.r2.dev/video.mp4"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
          />
          <div style={{ position: "relative" }}>
            <input
              className="admin-input"
              list="labels-list"
              placeholder="Etiqueta (ej: biblia)"
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
            />
            <datalist id="labels-list">
              {allLabels.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
        </div>

        {/* Preview en tiempo real */}
        {url && valid && (
          <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden", background: "#000", maxWidth: 320, position: "relative" }}>
            <video
              key={url}
              src={url}
              muted
              autoPlay
              loop
              playsInline
              style={{ width: "100%", display: "block", maxHeight: 180, objectFit: "cover" }}
              onError={() => setError("No se pudo cargar el video. Verifica que la URL sea pública.")}
            />
          </div>
        )}

        {url && !valid && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
            <AlertCircle size={14} /> URL no válida
          </div>
        )}

        {error && <p style={{ color: "var(--red, #e53e3e)", fontSize: 13, marginBottom: 8 }}>{error}</p>}

        <button
          className="btn-primary"
          onClick={handleAdd}
          disabled={adding || !valid}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <Plus size={16} />
          {adding ? "Guardando..." : "Agregar a la galería"}
        </button>
      </div>

      {/* ── Lista ── */}
      {loading ? (
        <div className="admin-page-loading"><div className="admin-spinner" /></div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
          <Film size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p>No hay videos en la galería todavía.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{ display: "flex", alignItems: "center", gap: 16, background: "var(--bg-elevated)", borderRadius: 10, padding: 12, border: "1px solid var(--border)" }}
            >
              <video
                src={item.url}
                muted
                playsInline
                preload="metadata"
                style={{ width: 160, height: 90, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "#111" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "var(--text-muted)", wordBreak: "break-all", marginBottom: 6 }}>{item.url}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {editingId === item.id ? (
                    <>
                      <input
                        className="admin-input"
                        list="labels-list"
                        value={editingLabel}
                        onChange={e => setEditingLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveLabel(item.id); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus
                        style={{ fontSize: 12, padding: "2px 8px", height: 26, width: 140 }}
                        placeholder="Etiqueta..."
                      />
                      <button className="btn-icon" title="Guardar" onClick={() => saveLabel(item.id)} style={{ padding: 4, color: "var(--green, #48bb78)" }}><Check size={14} /></button>
                      <button className="btn-icon" title="Cancelar" onClick={cancelEdit} style={{ padding: 4, color: "var(--text-muted)" }}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      {item.category ? (
                        <span style={labelStyle(item.category)}>{item.category}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>sin etiqueta</span>
                      )}
                      <button
                        className="btn-icon"
                        title="Editar etiqueta"
                        onClick={() => startEdit(item)}
                        style={{ padding: 3, opacity: 0.5, color: "var(--text-secondary)" }}
                      >
                        <Pencil size={12} />
                      </button>
                    </>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--text-muted)", padding: 8, borderRadius: 6, flexShrink: 0 }}
                title="Abrir URL"
              >
                <ExternalLink size={16} />
              </a>
              <button
                className="btn-icon danger"
                onClick={async () => {
                  if (!confirm("¿Eliminar este video de la galería?")) return;
                  await supabase.from("backgrounds").delete().eq("id", item.id);
                  setItems(p => p.filter(i => i.id !== item.id));
                }}
                title="Eliminar"
                style={{ flexShrink: 0 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
