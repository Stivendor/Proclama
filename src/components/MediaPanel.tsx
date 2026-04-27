import { useRef, useState, DragEvent, useEffect, useMemo } from "react";
import { Image, X, Upload, MonitorPlay, Zap, Plus, Trash2, AlertCircle } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useProjectionStore } from "@/stores";
import VideoControls from "./VideoControls";
import { db } from "@/db";
import { usePlan } from "@/hooks/usePlan";

import { LocalMedia } from "@/types";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export default function MediaPanel() {
  const { media, songId, isBible, setMedia, toggleMediaBackground, localMediaList, setLocalMediaList, toggleMediaObjectFit } =
    useProjectionStore(
      useShallow((s) => ({
        media: s.state.media,
        songId: s.state.songId,
        isBible: s.state.isBible,
        setMedia: s.setMedia,
        toggleMediaBackground: s.toggleMediaBackground,
        localMediaList: s.localMediaList,
        setLocalMediaList: s.setLocalMediaList,
        toggleMediaObjectFit: s.toggleMediaObjectFit,
      })),
    );
  const state = { media, songId, isBible };
  const { isPremium, mediaLimits } = usePlan();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "name" | "size">("newest");

  useEffect(() => {
    let cancelled = false;

    const loadPersistedMedia = async () => {
      setLoading(true);
      try {
        const rows = await db.local_media.toArray();
        if (cancelled) return;

        const loaded: LocalMedia[] = rows.map((row) => {
          const url = URL.createObjectURL(row.file);
          objectUrlsRef.current[row.id] = url;
          return {
            id: row.id,
            url,
            type: row.type,
            name: row.name,
            size: row.size,
            createdAt: row.createdAt,
          };
        });
        setLocalMediaList(loaded);
      } catch (err) {
        console.error("Error loading local media:", err);
        setError("No se pudo cargar la media local guardada.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPersistedMedia();

    return () => {
      cancelled = true;
      Object.values(objectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = {};
    };
  }, [setLocalMediaList]);

  const currentTotalBytes = useMemo(
    () => localMediaList.reduce((acc, item) => acc + (item.size || 0), 0),
    [localMediaList],
  );

  const sortedMediaList = useMemo(() => {
    const clone = [...localMediaList];
    if (sortBy === "name") return clone.sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (sortBy === "size") return clone.sort((a, b) => b.size - a.size);
    return clone.sort((a, b) => b.createdAt - a.createdAt);
  }, [localMediaList, sortBy]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const processFiles = async (files: File[]) => {
    setError(null);
    const validFiles: File[] = [];
    const rejectedFiles: string[] = [];

    files.forEach((file) => {
      const isTypeValid =
        file.type.startsWith("image/") || file.type.startsWith("video/");
      const isSizeValid = file.size <= MAX_FILE_SIZE;

      if (isTypeValid && isSizeValid) {
        validFiles.push(file);
      } else {
        rejectedFiles.push(
          file.name +
          (!isTypeValid ? " (Tipo no válido)" : " (Demasiado grande)"),
        );
      }
    });

    if (rejectedFiles.length > 0) {
      setError(
        `No se pudieron cargar ${rejectedFiles.length} archivo(s): ${rejectedFiles.slice(0, 2).join(", ")}${rejectedFiles.length > 2 ? "..." : ""}`,
      );
      setTimeout(() => setError(null), 5000);
    }

    if (validFiles.length === 0) return;

    const existingByName = new Map(localMediaList.map((m) => [m.name.toLowerCase(), m]));
    const filesToPersist: File[] = [];
    const idsToReplace: string[] = [];

    validFiles.forEach((file) => {
      const existing = existingByName.get(file.name.toLowerCase());
      if (existing && isPremium) {
        idsToReplace.push(existing.id);
      }
      if (!existing || isPremium) {
        filesToPersist.push(file);
      }
    });

    const bytesToRemove = idsToReplace.reduce((acc, id) => {
      const item = localMediaList.find((m) => m.id === id);
      return acc + (item?.size || 0);
    }, 0);
    const finalBytes = currentTotalBytes - bytesToRemove + filesToPersist.reduce((acc, file) => acc + file.size, 0);
    const finalFilesCount = localMediaList.length - idsToReplace.length + filesToPersist.length;

    if (finalFilesCount > mediaLimits.maxFiles) {
      setError(`Límite alcanzado: máximo ${mediaLimits.maxFiles} archivos en tu plan.`);
      return;
    }
    if (finalBytes > mediaLimits.maxTotalBytes) {
      setError(`Límite de espacio alcanzado (${formatBytes(mediaLimits.maxTotalBytes)}).`);
      return;
    }

    try {
      for (const id of idsToReplace) {
        await db.local_media.delete(id);
        const oldUrl = objectUrlsRef.current[id];
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        delete objectUrlsRef.current[id];
      }

      const now = Date.now();
      const newItems: LocalMedia[] = [];
      for (const file of filesToPersist) {
        const id = crypto.randomUUID();
        await db.local_media.put({
          id,
          name: file.name,
          type: file.type.startsWith("video/") ? "video" : "image",
          size: file.size,
          createdAt: now,
          file,
        });
        const url = URL.createObjectURL(file);
        objectUrlsRef.current[id] = url;
        newItems.push({
          id,
          url,
          type: file.type.startsWith("video/") ? "video" : "image",
          name: file.name,
          size: file.size,
          createdAt: now,
        });
      }

      setLocalMediaList((prev) => {
        const replaced = prev.filter((item) => !idsToReplace.includes(item.id));
        return [...replaced, ...newItems];
      });
    } catch (err) {
      console.error("Error persisting media:", err);
      setError("No se pudo guardar la media local.");
    }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    void processFiles(files);
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    void processFiles(files);
  };

  const toggleProjection = (item: LocalMedia) => {
    if (state.media?.url === item.url) {
      setMedia(null);
    } else {
      setMedia({
        url: item.url,
        type: item.type,
        isBackgroundMode: true,
      });
    }
  };

  const removeMedia = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = localMediaList.find((m) => m.id === id);
    if (!item) return;

    if (state.media?.url === item.url) {
      setMedia(null);
    }

    try {
      await db.local_media.delete(id);
    } catch (err) {
      console.error("Error deleting local media:", err);
    }

    URL.revokeObjectURL(item.url);
    delete objectUrlsRef.current[id];
    setLocalMediaList((prev) => prev.filter((m) => m.id !== id));
  };

  const clearAllMedia = async () => {
    if (!isPremium) return;
    if (!window.confirm("¿Eliminar todos los anuncios guardados?")) return;
    try {
      await db.local_media.clear();
      Object.values(objectUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = {};
      setMedia(null);
      setLocalMediaList([]);
    } catch (err) {
      console.error("Error clearing media:", err);
      setError("No se pudo limpiar la media local.");
    }
  };

  return (
    <div
      className={`media-panel ${isDragging ? "is-dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="recognition-header"
        style={{ justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MonitorPlay size={14} /> Anuncios / Media Local
        </div>
        {localMediaList.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isPremium && (
              <>
                <select
                  className="media-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "newest" | "name" | "size")}
                  title="Ordenar media"
                >
                  <option value="newest">Recientes</option>
                  <option value="name">Nombre</option>
                  <option value="size">Peso</option>
                </select>
                <button className="btn-add-mini danger" onClick={clearAllMedia} title="Limpiar todo">
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <button
              className="btn-add-mini"
              onClick={() => fileInputRef.current?.click()}
              title="Añadir más"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="media-limits">
        <span>
          {localMediaList.length}/{mediaLimits.maxFiles} archivos
        </span>
        <span>
          {formatBytes(currentTotalBytes)} / {formatBytes(mediaLimits.maxTotalBytes)}
        </span>
        {isPremium && <span className="media-premium-badge">Premium</span>}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFiles}
        accept="image/*,video/*"
        multiple
        style={{ display: "none" }}
      />

      {error && (
        <div className="media-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {state.media && (
        <div className="media-controls-row">
          <button
            className={`btn-media-toggle ${state.media.isBackgroundMode ? "active" : ""}`}
            onClick={toggleMediaBackground}
            title={
              state.media.isBackgroundMode
                ? "Cambiar a modo Presentación (Pantalla completa)"
                : "Cambiar a modo Fondo (Debajo del texto)"
            }
          >
            {state.media.isBackgroundMode ? (
              <Zap size={14} />
            ) : (
              <MonitorPlay size={14} />
            )}
            {state.media.isBackgroundMode
              ? "Fondo Dinámico Activo"
              : "Usar como Fondo"}
          </button>
          
          <button
            className={`btn-media-toggle ${(state.media.objectFit || (state.media.isBackgroundMode ? 'cover' : 'contain')) === 'cover' ? "active" : ""}`}
            onClick={toggleMediaObjectFit}
            title={
              (state.media.objectFit || (state.media.isBackgroundMode ? 'cover' : 'contain')) === 'cover'
                ? "Ajustar imagen (sin recortar)"
                : "Estirar imagen (llenar pantalla)"
            }
          >
            <Image size={14} />
            {(state.media.objectFit || (state.media.isBackgroundMode ? 'cover' : 'contain')) === 'cover'
              ? "Estirado"
              : "Ajustado"}
          </button>
        </div>
      )}

      {state.media?.type === "video" && <VideoControls />}

      {loading ? (
        <div className="media-upload-zone">
          <p>Cargando media local...</p>
        </div>
      ) : localMediaList.length === 0 ? (
        <div
          className={`media-upload-zone ${isDragging ? "dragging" : ""}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload
            size={24}
            opacity={isDragging ? 0.8 : 0.3}
            className={isDragging ? "bounce" : ""}
          />
          <p>
            {isDragging
              ? "¡Suelta para cargar!"
              : "Cargar Anuncios (PNG, JPG, MP4)"}
          </p>
          <span>
            {isDragging
              ? "Formatos soportados"
              : "Hasta 500MB · Arrastra aquí o haz clic"}
          </span>
        </div>
      ) : (
        <div className="media-gallery-container">
          <div className="media-gallery">
            {sortedMediaList.map((item) => {
            const isProjecting = state.media?.url === item.url;
            return (
              <div
                key={item.id}
                className={`media-item-card ${isProjecting ? "projecting" : ""}`}
                onClick={() => toggleProjection(item)}
              >
                <div className="media-item-thumb">
                  {item.type === "video" ? (
                    <video src={item.url} muted />
                  ) : (
                    <img src={item.url} alt="thumb" />
                  )}
                  {isProjecting && (
                    <div className="projecting-badge">
                      <Zap size={10} fill="currentColor" /> EN VIVO
                    </div>
                  )}
                  <button className="media-item-delete" onClick={(e) => void removeMedia(item.id, e)} title="Eliminar">
                    <X size={12} />
                  </button>
                </div>
                <div className="media-item-meta" title={`${item.name} · ${formatBytes(item.size)}`}>
                  <span>{item.name}</span>
                </div>
              </div>
            );
          })}

          <div
            className={`media-item-add ${isDragging ? "dragging" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            title="Añadir anuncios (PNG, JPG, MP4)"
          >
            <Plus size={20} opacity={0.5} />
          </div>
        </div>
      </div>
      )}

      {isDragging && localMediaList.length > 0 && (
        <div className="drag-overlay">
          <Upload size={32} />
          <p>Suelta para añadir archivos</p>
        </div>
      )}

      <style>{`
        .media-panel { 
          padding: 16px; 
          border-top: 1px solid var(--border); 
          display: flex; 
          flex-direction: column; 
          gap: 12px; 
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .media-panel.is-dragging {
          background: rgba(59, 130, 246, 0.03);
        }

        .media-controls-row {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }

        .btn-media-toggle {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          color: var(--text-muted);
          transition: all 0.2s;
        }

        .btn-media-toggle:hover {
          border-color: var(--gold);
          color: var(--text-primary);
        }

        .btn-media-toggle.active {
          background: var(--gold);
          border-color: var(--gold);
          color: black;
          box-shadow: 0 4px 12px rgba(212, 175, 55, 0.2);
        }

        .media-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(224, 85, 85, 0.1);
          border: 1px solid var(--red-dim);
          border-radius: 6px;
          color: var(--red);
          font-size: 11px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .btn-add-mini {
          background: var(--bg-elevated); border: 1px solid var(--border);
          color: var(--text-muted); border-radius: 4px; padding: 2px 6px;
          cursor: pointer; display: flex; align-items: center;
        }
        .btn-add-mini:hover { color: var(--blue); border-color: var(--blue); }
        .btn-add-mini.danger:hover { color: var(--red); border-color: var(--red); }
        .media-sort-select {
          background: var(--bg-elevated);
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 11px;
          padding: 3px 6px;
        }
        .media-limits {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }
        .media-premium-badge {
          background: rgba(212, 175, 55, 0.2);
          color: var(--gold);
          border: 1px solid rgba(212, 175, 55, 0.4);
          border-radius: 999px;
          padding: 1px 8px;
          font-weight: 700;
        }

        .media-upload-zone {
          border: 2px dashed var(--border);
          border-radius: var(--radius-sm);
          padding: 32px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.02);
        }
        .media-upload-zone:hover, .media-upload-zone.dragging { 
          border-color: var(--blue); 
          background: rgba(59, 130, 246, 0.08); 
          color: var(--blue);
        }
        .media-upload-zone.dragging span { color: var(--blue); opacity: 0.8; }
        
        .media-upload-zone p { font-size: 13px; font-weight: 500; margin: 0; }
        .media-upload-zone span { font-size: 11px; color: var(--text-muted); }

        .media-gallery-container {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 10px;
          max-height: 300px;
          overflow-y: auto;
        }

        .media-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 10px;
          align-content: start;
        }

        .media-item-card {
          position: relative;
          aspect-ratio: 16/10;
          border-radius: 6px;
          overflow: hidden;
          background: #000;
          cursor: pointer;
          border: 1px solid var(--border);
          transition: all 0.2s;
        }
        .media-item-card:hover { transform: scale(1.05); border-color: var(--blue); }
        .media-item-card.projecting { border-color: var(--gold); box-shadow: 0 0 10px rgba(212, 175, 55, 0.4); border-width: 2px; }

        .media-item-thumb { width: 100%; height: 100%; position: relative; }
        .media-item-thumb img, .media-item-thumb video { width: 100%; height: 100%; object-fit: cover; }

        .projecting-badge {
          position: absolute; top: 4px; left: 4px;
          background: var(--gold); color: black;
          font-size: 8px; font-weight: 800; padding: 2px 5px;
          border-radius: 2px; display: flex; align-items: center; gap: 3px;
        }

        .media-item-delete {
          position: absolute; top: 4px; right: 4px;
          width: 18px; height: 18px; border-radius: 4px;
          background: rgba(0,0,0,0.6); color: white;
          border: 1px solid rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s;
        }
        .media-item-card:hover .media-item-delete { opacity: 1; }
        .media-item-delete:hover { background: var(--red); border-color: var(--red); }
        .media-item-meta {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.75), transparent);
          color: white;
          font-size: 9px;
          padding: 8px 6px 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .media-item-add {
          aspect-ratio: 16/10;
          border: 2px dashed var(--border);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-muted);
          transition: all 0.2s;
        }
        .media-item-add:hover, .media-item-add.dragging { 
          border-color: var(--blue); 
          color: var(--blue); 
          background: rgba(59, 130, 246, 0.05); 
        }

        .drag-overlay {
          position: absolute;
          inset: 0;
          background: rgba(9, 12, 18, 0.85);
          backdrop-filter: blur(2px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          z-index: 10;
          border-radius: var(--radius-sm);
          color: var(--blue);
          border: 2px dashed var(--blue);
          margin: 12px;
          pointer-events: none;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .bounce {
          animation: bounce 1s infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
