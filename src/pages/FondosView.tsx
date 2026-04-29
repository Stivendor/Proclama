import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Lock } from "lucide-react";
import {
  Sliders,
  Image as ImageIcon,
  Film,
  CheckCircle,
  Type,
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Palette,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  useAppStore,
  useProjectionStore,
  DEFAULT_THEME,
} from "@/stores";
import { usePlan } from "@/hooks/usePlan";

const FONTS = [
  { value: "Montserrat", label: "Montserrat" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Verdana", label: "Verdana" },
  { value: "Trebuchet MS", label: "Trebuchet MS" },
  { value: "Impact", label: "Impact" },
];

const TRANSITIONS = [
  { value: "fade", label: "Fade (suave)" },
  { value: "slide", label: "Slide" },
  { value: "instant", label: "Instant" },
];

export default function FondosView() {
  const { backgrounds, fetchBackgrounds, isSidebarOpen, toggleSidebar } = useAppStore(
    useShallow((s) => ({
      backgrounds: s.backgrounds,
      fetchBackgrounds: s.fetchBackgrounds,
      isSidebarOpen: s.isSidebarOpen,
      toggleSidebar: s.toggleSidebar,
    })),
  );

  const { updateTheme, theme, media } = useProjectionStore(
    useShallow((s) => ({
      updateTheme: s.updateTheme,
      theme: s.state.theme,
      media: s.state.media,
    })),
  );

  const { isPremium } = usePlan();

  const handleUpgrade = useCallback(() => {
    window.location.href = "/settings?upgrade=premium";
  }, []);

  const [displayCount, setDisplayCount] = useState(12);
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const [textoExpanded, setTextoExpanded] = useState(false);
  const [videoCategory, setVideoCategory] = useState<string | null>(null);
  const [imageCategory, setImageCategory] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());

  const state = { theme, media };

  const filteredBackgrounds = backgrounds.filter((bg) => {
    if (brokenImageIds.has(bg.id)) return false;

    if (state.theme.backgroundType === "video") {
      return (bg.type === "video" || bg.url?.toLowerCase().match(/\.(mp4|webm|mov|m4v)$/)) && (!videoCategory || bg.category === videoCategory)
    }
    if (state.theme.backgroundType === "image") {
      const isVideo = bg.type === "video" || bg.url?.toLowerCase().match(/\.(mp4|webm|mov|m4v)$/)
      return !isVideo && (!imageCategory || bg.category === imageCategory)
    }
    return true
  })
  const displayedBackgrounds = filteredBackgrounds.slice(0, galleryExpanded ? filteredBackgrounds.length : displayCount);
  const hasMore = !galleryExpanded && displayCount < filteredBackgrounds.length;

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const availableImageCategories = Array.from(new Set(
    backgrounds
      .filter(bg => bg.type === "image" || !bg.type)
      .map(bg => bg.category)
      .filter(Boolean)
  )) as string[];

  const availableVideoCategories = Array.from(new Set(
    backgrounds
      .filter(bg => bg.type === "video" || bg.url?.toLowerCase().match(/\.(mp4|webm|mov|m4v)$/))
      .map(bg => bg.category)
      .filter(Boolean)
  )) as string[];

  return (
    <div className="fondos-view">
      <div className="view-header">
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {!isSidebarOpen && (
            <button className="btn-icon" onClick={toggleSidebar}>
              <Sliders size={20} />
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: "1.5rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <ImageIcon size={24} color="var(--gold)" />
            Fondos
          </h1>
        </div>
      </div>

      <div className="fondos-content">
        <section className="fondos-section">
          <h2>
            <Palette size={15} /> Fondo
          </h2>
          <div className="form-group">
            <label>Tipo de Fondo</label>
            <div className="segmented-control">
              <button
                className={(!state.theme.backgroundType || state.theme.backgroundType === "color") ? "active" : ""}
                onClick={() => updateTheme({ backgroundType: "color" })}
              >
                <Sliders size={14} /> Color
              </button>
              <button
                className={state.theme.backgroundType === "image" ? "active" : ""}
                onClick={() => updateTheme({ backgroundType: "image" })}
              >
                <ImageIcon size={14} /> Imagen
              </button>
              <button
                className={state.theme.backgroundType === "video" ? "active" : ""}
                onClick={() => updateTheme({ backgroundType: "video" })}
              >
                <Film size={14} /> Video
              </button>
            </div>
          </div>

          <div className="background-options">
            {state.theme.backgroundType === "image" && (
              <div className="gallery-container">
                <label><ImageIcon size={14} /> Galería de Imágenes</label>
                <div className="category-filters">
                  <button className={!imageCategory ? "active" : ""} onClick={() => setImageCategory(null)}>Todos</button>
                  {availableImageCategories.map((cat) => (
                    <button key={cat} className={imageCategory === cat ? "active" : ""} onClick={() => setImageCategory(cat)}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
                <div className={`backgrounds-gallery ${!isPremium ? "restricted" : ""}`}>
                  {displayedBackgrounds.map((bg) => (
                    <div
                      key={bg.id}
                      className={`gallery-item ${state.theme.backgroundImageUrl === bg.url ? "active" : ""}`}
                      onClick={() => {
                        if (!isPremium) return
                        const isVideo = bg.type === "video" || bg.url?.toLowerCase().match(/\.(mp4|webm|mov|m4v)$/)
                        if (isVideo) {
                          updateTheme({ backgroundType: "video", backgroundVideoUrl: bg.url })
                        } else {
                          updateTheme({ backgroundType: "image", backgroundImageUrl: bg.url, backgroundThumbnail: bg.thumbnailUrl })
                        }
                      }}
                    >
                      <img 
                        src={bg.thumbnailUrl || bg.url} 
                        alt="background" 
                        onError={(e) => { 
                          const t = e.target as HTMLImageElement; 
                          if (t.src !== bg.url) {
                            t.src = bg.url; 
                          } else {
                            setBrokenImageIds(prev => {
                              const next = new Set(prev);
                              next.add(bg.id);
                              return next;
                            });
                          }
                        }} 
                      />
                      {state.theme.backgroundImageUrl === bg.url && <div className="active-overlay"><CheckCircle size={14} /></div>}
                      {!isPremium && <div className="gallery-blur"><Lock size={16} /><span>Premium</span></div>}
                    </div>
                  ))}
                  {!isPremium && (
                    <div className="gallery-premium-promo">
                      <Lock size={20} />
                      <span>100+ fondos exclusivos para Premium</span>
                      <button onClick={handleUpgrade}>Mejorar a Premium</button>
                    </div>
                  )}
                </div>
                {hasMore && isPremium && (
                  <button className="load-more-btn" onClick={() => setDisplayCount((c) => c + 12)}>
                    Cargar más ({filteredBackgrounds.length - displayCount} restantes)
                  </button>
                )}
                {galleryExpanded && (
                  <button className="load-more-btn" onClick={() => setGalleryExpanded(false)}>
                    <ChevronUp size={14} /> Contraer galería
                  </button>
                )}
              </div>
            )}

            {state.theme.backgroundType === "video" && (
              <div className="gallery-container">
                <label><Film size={14} /> Galería de Videos</label>
                <div className="category-filters">
                  <button className={!videoCategory ? "active" : ""} onClick={() => setVideoCategory(null)}>Todos</button>
                  {availableVideoCategories.map((cat) => (
                    <button key={cat} className={videoCategory === cat ? "active" : ""} onClick={() => setVideoCategory(cat)}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
                <div className={`backgrounds-gallery ${!isPremium ? "restricted" : ""}`}>
                  {displayedBackgrounds.map((bg) => (
                    <div key={bg.id} className={`gallery-item ${state.theme.backgroundVideoUrl === bg.url ? "active" : ""}`} onClick={() => isPremium && updateTheme({ backgroundType: "video", backgroundVideoUrl: bg.url })}>
                      <video 
                        src={bg.url} 
                        muted 
                        onError={() => {
                          setBrokenImageIds(prev => {
                            const next = new Set(prev);
                            next.add(bg.id);
                            return next;
                          });
                        }}
                      />
                      {state.theme.backgroundVideoUrl === bg.url && <div className="active-overlay"><CheckCircle size={14} /></div>}
                      {!isPremium && <div className="gallery-blur"><Lock size={16} /><span>Premium</span></div>}
                    </div>
                  ))}
                  {!isPremium && (
                    <div className="gallery-premium-promo">
                      <Lock size={20} />
                      <span>Videos exclusivos para Premium</span>
                      <button onClick={handleUpgrade}>Mejorar a Premium</button>
                    </div>
                  )}
                </div>
                {hasMore && isPremium && (
                  <button className="load-more-btn" onClick={() => setDisplayCount((c) => c + 12)}>
                    Cargar más ({filteredBackgrounds.length - displayCount} restantes)
                  </button>
                )}
              </div>
            )}

            {(state.theme.backgroundType === "color" || !state.theme.backgroundType) && (
              <div className="form-group">
                <label>Color de Fondo</label>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
                  {["#000000", "#1a1a2e", "#16213e", "#0f3460", "#1e3a5f", "#2d132c", "#1a1a1a", "#2b2b2b", "#0d1117", "#0a0a0a", "#000", "#111"].map((color) => (
                    <div key={color} onClick={() => updateTheme({ backgroundType: "color", background: color })} style={{ width: "40px", height: "40px", borderRadius: "8px", background: color, cursor: "pointer", border: state.theme.background === color ? "2px solid var(--gold)" : "2px solid transparent" }} />
                  ))}
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Color Personalizado</label>
                  <input type="color" value={state.theme.background || "#000000"} onChange={(e) => updateTheme({ backgroundType: "color", background: e.target.value })} style={{ width: "60px", height: "40px", padding: 0, border: "none", cursor: "pointer" }} />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="fondos-section">
          <h2><Sliders size={15} /> Filtros</h2>
          <div className="options-grid">
            <div className="form-group">
              <label>Desenfoque (Blur): {state.theme.backgroundBlur || 0}px</label>
              <input type="range" min="0" max="50" value={state.theme.backgroundBlur || 0} onChange={(e) => updateTheme({ backgroundBlur: Number(e.target.value) })} style={{ width: "100%" }} />
            </div>
            <div className="form-group">
              <label>Oscurecer: {Math.round((state.theme.backgroundOverlayOpacity ?? 0.3) * 100)}%</label>
              <input type="range" min="0" max="100" value={Math.round((state.theme.backgroundOverlayOpacity ?? 0.3) * 100)} onChange={(e) => updateTheme({ backgroundOverlayOpacity: Number(e.target.value) / 100 })} style={{ width: "100%" }} />
            </div>
          </div>
        </section>

        <section className="fondos-section">
          <div className="section-header-row">
            <h2 onClick={() => setTextoExpanded(!textoExpanded)} style={{ cursor: "pointer", flex: 1 }}>
              <Type size={15} /> Texto {textoExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </h2>
          </div>
          {textoExpanded && (
            <div className="options-grid">
              <div className="form-group">
                <label>Color de Texto</label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input type="color" value={state.theme.textColor || "#ffffff"} onChange={(e) => updateTheme({ textColor: e.target.value })} style={{ width: "50px", height: "35px", padding: 0, border: "none", cursor: "pointer" }} />
                  <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{state.theme.textColor || "#ffffff"}</span>
                </div>
              </div>
              <div className="form-group">
                <label>Fuente</label>
                <select value={state.theme.fontFamily || "Montserrat"} onChange={(e) => updateTheme({ fontFamily: e.target.value })} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                  {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Escala de Texto: {Math.round((state.theme.fontScale || 1) * 100)}%</label>
                <input 
                  type="range" min="0.1" max="1" step="0.05" 
                  value={state.theme.fontScale || 1} 
                  onChange={(e) => updateTheme({ fontScale: Number(e.target.value) })} 
                  style={{ width: "100%" }} 
                />
              </div>
              <div className="form-group">
                <label>Transición</label>
                <select value={state.theme.transition || "fade"} onChange={(e) => updateTheme({ transition: e.target.value as any })} style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-elevated)", color: "var(--text-primary)" }}>
                  {TRANSITIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Posición Cita Bíblica</label>
                <div className="segmented-control">
                  <button className={state.theme.verseReferencePosition === "top" ? "active" : ""} onClick={() => updateTheme({ verseReferencePosition: "top" })}>
                    <ArrowUp size={14} /> Arriba
                  </button>
                  <button className={state.theme.verseReferencePosition === "bottom" || !state.theme.verseReferencePosition ? "active" : ""} onClick={() => updateTheme({ verseReferencePosition: "bottom" })}>
                    <ArrowDown size={14} /> Abajo
                  </button>
                </div>
              </div>
            </div>
          )}
          {textoExpanded && (
            <div className="toggle-options">
              <label className="toggle-item">
                <input type="checkbox" checked={state.theme.textShadow !== false} onChange={(e) => updateTheme({ textShadow: e.target.checked })} />
                <span>Sombra en el texto</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" checked={state.theme.textUppercase === true} onChange={(e) => updateTheme({ textUppercase: e.target.checked })} />
                <span>Texto en mayúsculas</span>
              </label>
              <label className="toggle-item">
                <input type="checkbox" checked={state.theme.showBibleVersion !== false} onChange={(e) => updateTheme({ showBibleVersion: e.target.checked })} />
                <span>Mostrar versión (Biblia)</span>
              </label>
            </div>
          )}
        </section>
      </div>

      <style>{`
        .category-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .category-filters button { padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-elevated); color: var(--text-secondary); font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .category-filters button.active { background: var(--gold); color: #000; border-color: var(--gold); }
        .fondos-view { padding: 20px; height: 100%; overflow-y: auto; }
        .fondos-content { padding: 20px 0; }
        .fondos-section { margin-bottom: 32px; }
        .section-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .section-header-row h2 { margin: 0; }
        .fondos-section h2 { font-size: 1.1rem; margin: 0 0 16px; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
        .segmented-control { display: flex; gap: 8px; flex-wrap: wrap; }
        .segmented-control button { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-elevated); color: var(--text-secondary); font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .segmented-control button.active { background: var(--gold); color: #000; border-color: var(--gold); }
        .options-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .form-group label { display: block; font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; }
        .form-group input[type="text"], .form-group select { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-elevated); color: var(--text-primary); font-size: 14px; }
        .form-group input:focus, .form-group select:focus { outline: none; border-color: var(--gold); }
        .gallery-container label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; }
        .backgrounds-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
        .gallery-item { position: relative; aspect-ratio: 16/9; border-radius: 8px; overflow: hidden; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; }
        .gallery-item:hover { border-color: var(--gold); }
        .gallery-item.active { border-color: var(--gold); }
        .gallery-item img, .gallery-item video { width: 100%; height: 100%; object-fit: cover; }
        .gallery-item .active-overlay { position: absolute; inset: 0; background: rgba(201, 166, 88, 0.3); display: flex; align-items: center; justify-content: center; color: var(--gold); }
        .load-more-btn { display: block; margin: 16px auto 0; padding: 10px 24px; border-radius: 8px; background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border-color); cursor: pointer; font-size: 14px; transition: all 0.2s; }
        .load-more-btn:hover { border-color: var(--gold); color: var(--gold); }
        .toggle-options { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
        .toggle-item { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--text-secondary); cursor: pointer; }
        .toggle-item input { width: 18px; height: 18px; accent-color: var(--gold); }
        .background-options { margin-top: 20px; }
        .backgrounds-gallery.restricted .gallery-item { filter: blur(8px); pointer-events: none; }
        .backgrounds-gallery.restricted .gallery-item:first-child { filter: none; pointer-events: auto; }
        .gallery-blur { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #fff; font-size: 10px; font-weight: 600; }
        .gallery-premium-promo { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px; background: rgba(201, 166, 88, 0.1); border-radius: 12px; border: 1px dashed var(--gold); }
        .gallery-premium-promo span { color: var(--text-secondary); font-size: 14px; }
        .gallery-premium-promo button { margin-top: 8px; padding: 8px 16px; background: var(--gold); color: #000; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
      `}</style>
    </div>
  );
}