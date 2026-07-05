import { useRef, useState, DragEvent, useEffect, useMemo } from "react";
import { Image, X, Upload, MonitorPlay, Zap, Plus, Trash2, AlertCircle, Folder, FolderPlus, Pencil, FolderX, Youtube, Star } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useProjectionStore } from "@/stores";
import VideoControls from "./VideoControls";
import BackgroundShelf from "./BackgroundShelf";
import { db } from "@/db";
import { usePlan } from "@/hooks/usePlan";

import { LocalMedia } from "@/types";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

function getYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function MediaPanel() {
  const {
    media,
    songId,
    isBible,
    setMedia,
    toggleMediaBackground,
    localMediaList,
    setLocalMediaList,
    localMediaFolders,
    setLocalMediaFolders,
    selectedMediaFolderId,
    setSelectedMediaFolderId,
    toggleMediaObjectFit,
    updateTheme,
    defaultBackgroundMediaId,
    setDefaultBackgroundMediaId,
  } =
    useProjectionStore(
      useShallow((s) => ({
        media: s.state.media,
        songId: s.state.songId,
        isBible: s.state.isBible,
        setMedia: s.setMedia,
        toggleMediaBackground: s.toggleMediaBackground,
        localMediaList: s.localMediaList,
        setLocalMediaList: s.setLocalMediaList,
        localMediaFolders: s.localMediaFolders,
        setLocalMediaFolders: s.setLocalMediaFolders,
        selectedMediaFolderId: s.selectedMediaFolderId,
        setSelectedMediaFolderId: s.setSelectedMediaFolderId,
        toggleMediaObjectFit: s.toggleMediaObjectFit,
        updateTheme: s.updateTheme,
        defaultBackgroundMediaId: s.defaultBackgroundMediaId,
        setDefaultBackgroundMediaId: s.setDefaultBackgroundMediaId,
      })),
    );
  const state = { media, songId, isBible };
  const { isPremium, mediaLimits, canManageMediaFolders } = usePlan();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"newest" | "name" | "size">("newest");
  const [showFolderPremiumInfo, setShowFolderPremiumInfo] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadPersistedMedia = async () => {
      setLoading(true);
      try {
        const [rows, folders] = await Promise.all([
          db.local_media.toArray(),
          db.local_media_folders.orderBy("name").toArray(),
        ]);
        if (cancelled) return;

        const loaded: LocalMedia[] = rows.map((row) => {
          let url = "";
          if (row.type === "youtube") {
            url = row.youtubeUrl || "";
          } else if (row.file) {
            url = URL.createObjectURL(row.file);
            objectUrlsRef.current[row.id] = url;
          }
          return {
            id: row.id,
            url,
            type: row.type,
            name: row.name,
            size: row.size,
            createdAt: row.createdAt,
            folderId: row.folderId ?? null,
          };
        });
        setLocalMediaList(loaded);
        setLocalMediaFolders(folders);
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
  }, [setLocalMediaFolders, setLocalMediaList]);

  useEffect(() => {
    if (selectedMediaFolderId && !localMediaFolders.some((folder) => folder.id === selectedMediaFolderId)) {
      setSelectedMediaFolderId(null);
    }
  }, [localMediaFolders, selectedMediaFolderId, setSelectedMediaFolderId]);

  // Fondo predeterminado: el blob URL caduca al recargar, así que cuando la lista
  // local se (re)carga, refrescamos theme.backgroundImageUrl con la URL nueva.
  // ponytail: solo corrige la URL caducada cuando el fondo YA es esa imagen; no
  // fuerza la imagen si el usuario cambió a color. Si MediaPanel no está montado,
  // la URL persistida queda obsoleta hasta que se monte.
  useEffect(() => {
    if (!defaultBackgroundMediaId) return;
    const item = localMediaList.find((m) => m.id === defaultBackgroundMediaId);
    if (!item) {
      // La imagen default fue eliminada → limpiar la marca.
      setDefaultBackgroundMediaId(null);
      return;
    }
    if (item.type !== "image") return;
    const t = useProjectionStore.getState().state.theme;
    if (t.backgroundType === "image" && t.backgroundImageUrl !== item.url) {
      updateTheme({ backgroundType: "image", backgroundImageUrl: item.url });
    }
  }, [localMediaList, defaultBackgroundMediaId, setDefaultBackgroundMediaId, updateTheme]);

  const toggleDefaultBackground = (item: LocalMedia, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type !== "image") return;
    if (defaultBackgroundMediaId === item.id) {
      setDefaultBackgroundMediaId(null);
      updateTheme({ backgroundType: "color" });
    } else {
      setDefaultBackgroundMediaId(item.id);
      updateTheme({ backgroundType: "image", backgroundImageUrl: item.url, backgroundThumbnail: undefined });
    }
  };

  const currentTotalBytes = useMemo(
    () => localMediaList.reduce((acc, item) => acc + (item.size || 0), 0),
    [localMediaList],
  );

  const sortedMediaList = useMemo(() => {
    const scoped = localMediaList.filter((item) => (item.folderId ?? null) === selectedMediaFolderId);
    const clone = [...scoped];
    if (sortBy === "name") return clone.sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (sortBy === "size") return clone.sort((a, b) => b.size - a.size);
    return clone.sort((a, b) => b.createdAt - a.createdAt);
  }, [localMediaList, selectedMediaFolderId, sortBy]);

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
          folderId: selectedMediaFolderId,
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
          folderId: selectedMediaFolderId,
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

  const promptFolderName = (title: string, initial = "", excludeId?: string) => {
    const value = window.prompt(title, initial)?.trim();
    if (!value) return null;
    if (value.length > 40) {
      setError("El nombre de carpeta no puede superar 40 caracteres.");
      return null;
    }
    const duplicated = localMediaFolders.some(
      (folder) => folder.id !== excludeId && folder.name.toLowerCase() === value.toLowerCase(),
    );
    if (duplicated) {
      setError("Ya existe una carpeta con ese nombre.");
      return null;
    }
    return value;
  };

  const createFolder = async () => {
    if (!canManageMediaFolders) {
      setError("La gestión de carpetas es una función premium.");
      return;
    }
    const name = promptFolderName("Nombre de la nueva carpeta");
    if (!name) return;
    const now = Date.now();
    const id = crypto.randomUUID();
    const folder = { id, name, createdAt: now, updatedAt: now };
    try {
      await db.local_media_folders.add(folder);
      setLocalMediaFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setSelectedMediaFolderId(id);
    } catch (err) {
      console.error("Error creating media folder:", err);
      setError("No se pudo crear la carpeta.");
    }
  };

  const renameFolder = async (folderId: string) => {
    if (!canManageMediaFolders) {
      setError("La gestión de carpetas es una función premium.");
      return;
    }
    const current = localMediaFolders.find((folder) => folder.id === folderId);
    if (!current) return;
    const name = promptFolderName("Nuevo nombre de carpeta", current.name, current.id);
    if (!name || name.toLowerCase() === current.name.toLowerCase()) return;
    const updatedAt = Date.now();
    try {
      await db.local_media_folders.update(folderId, { name, updatedAt });
      setLocalMediaFolders((prev) =>
        prev
          .map((folder) => (folder.id === folderId ? { ...folder, name, updatedAt } : folder))
          .sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
    } catch (err) {
      console.error("Error renaming media folder:", err);
      setError("No se pudo renombrar la carpeta.");
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!canManageMediaFolders) {
      setError("La gestión de carpetas es una función premium.");
      return;
    }
    const current = localMediaFolders.find((folder) => folder.id === folderId);
    if (!current) return;
    if (!window.confirm(`¿Eliminar carpeta "${current.name}"? Los archivos volverán a Raíz.`)) return;
    try {
      await db.transaction("rw", db.local_media, db.local_media_folders, async () => {
        await db.local_media.where("folderId").equals(folderId).modify({ folderId: null });
        await db.local_media_folders.delete(folderId);
      });
      setLocalMediaList((prev) =>
        prev.map((item) => (item.folderId === folderId ? { ...item, folderId: null } : item)),
      );
      setLocalMediaFolders((prev) => prev.filter((folder) => folder.id !== folderId));
      if (selectedMediaFolderId === folderId) setSelectedMediaFolderId(null);
    } catch (err) {
      console.error("Error deleting media folder:", err);
      setError("No se pudo eliminar la carpeta.");
    }
  };

  const moveMediaToFolder = async (id: string, folderId: string | null) => {
    if (!canManageMediaFolders) {
      setError("La gestión de carpetas es una función premium.");
      return;
    }
    try {
      await db.local_media.update(id, { folderId });
      setLocalMediaList((prev) => prev.map((item) => (item.id === id ? { ...item, folderId } : item)));
    } catch (err) {
      console.error("Error moving media file:", err);
      setError("No se pudo mover el archivo.");
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
        name: item.name,
      });
    }
  };

  const handleAddYoutube = async () => {
    setError(null);
    if (!youtubeUrl.trim()) return;
    const videoId = getYoutubeId(youtubeUrl);
    if (!videoId) {
      setError("Enlace de YouTube no válido.");
      return;
    }

    const name = window.prompt("Nombre para el video de YouTube (ej: Video de bienvenida)", "Video de YouTube")?.trim();
    if (name === null) return; // cancelado
    const finalName = name || `YouTube: ${videoId}`;

    // Validar límites
    if (localMediaList.length >= mediaLimits.maxFiles) {
      setError(`Límite alcanzado: máximo ${mediaLimits.maxFiles} archivos en tu plan.`);
      return;
    }

    const now = Date.now();
    const id = crypto.randomUUID();
    try {
      await db.local_media.put({
        id,
        name: finalName,
        type: "youtube",
        size: 0,
        createdAt: now,
        youtubeUrl: youtubeUrl.trim(),
        folderId: selectedMediaFolderId,
      });

      const newItem: LocalMedia = {
        id,
        url: youtubeUrl.trim(),
        type: "youtube",
        name: finalName,
        size: 0,
        createdAt: now,
        folderId: selectedMediaFolderId,
      };

      setLocalMediaList((prev) => [...prev, newItem]);
      setYoutubeUrl("");
    } catch (err) {
      console.error("Error saving youtube media:", err);
      setError("No se pudo guardar el video de YouTube.");
    }
  };

  const removeMedia = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = localMediaList.find((m) => m.id === id);
    if (!item) return;

    if (state.media?.url === item.url) {
      setMedia(null);
    }

    if (defaultBackgroundMediaId === id) {
      setDefaultBackgroundMediaId(null);
      updateTheme({ backgroundType: "color" });
    }

    try {
      await db.local_media.delete(id);
    } catch (err) {
      console.error("Error deleting local media:", err);
    }

    if (item.type !== "youtube") {
      URL.revokeObjectURL(item.url);
      delete objectUrlsRef.current[id];
    }
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
      if (defaultBackgroundMediaId) {
        setDefaultBackgroundMediaId(null);
        updateTheme({ backgroundType: "color" });
      }
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
      <BackgroundShelf />
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

      <div className="media-folders-row">
        <button
          className={`media-folder-chip ${selectedMediaFolderId === null ? "active" : ""}`}
          onClick={() => setSelectedMediaFolderId(null)}
          title="Ver archivos en raíz"
        >
          <Folder size={12} /> Raíz
        </button>
        {localMediaFolders.map((folder) => (
          <div key={folder.id} className={`media-folder-chip-wrap ${selectedMediaFolderId === folder.id ? "active" : ""}`}>
            <button
              className={`media-folder-chip ${selectedMediaFolderId === folder.id ? "active" : ""}`}
              onClick={() => setSelectedMediaFolderId(folder.id)}
              title={`Abrir carpeta ${folder.name}`}
            >
              <Folder size={12} /> {folder.name}
            </button>
            {canManageMediaFolders && (
              <>
                <button className="media-folder-action" title="Renombrar carpeta" onClick={() => void renameFolder(folder.id)}>
                  <Pencil size={10} />
                </button>
                <button className="media-folder-action danger" title="Eliminar carpeta" onClick={() => void deleteFolder(folder.id)}>
                  <FolderX size={10} />
                </button>
              </>
            )}
          </div>
        ))}
        {canManageMediaFolders && (
          <button className="media-folder-add" title="Nueva carpeta" onClick={createFolder}>
            <FolderPlus size={12} /> Nueva
          </button>
        )}
        {!canManageMediaFolders && (
          <button
            className="media-folder-premium-info-trigger"
            title="Ver ventajas premium para carpetas"
            onClick={() => setShowFolderPremiumInfo((prev) => !prev)}
          >
            <FolderPlus size={12} /> Ventajas Premium
          </button>
        )}
      </div>
      {!canManageMediaFolders && showFolderPremiumInfo && (
        <div className="media-premium-popup" role="status">
          <div className="media-premium-popup-header">
            <strong>Gestion de carpetas Premium</strong>
            <button
              className="media-premium-popup-close"
              onClick={() => setShowFolderPremiumInfo(false)}
              title="Cerrar"
            >
              <X size={12} />
            </button>
          </div>
          <ul className="media-premium-popup-list">
            <li>Crea carpetas para organizar anuncios por evento o temporada.</li>
            <li>Renombra y elimina carpetas sin perder archivos (vuelven a Raiz).</li>
            <li>Mueve archivos entre carpetas y manten la libreria ordenada.</li>
            <li>El plan free sube hasta 5 archivos; con Premium es ilimitado.</li>
          </ul>
        </div>
      )}

      <div className="media-limits">
        <span>
          {localMediaList.length}
          {Number.isFinite(mediaLimits.maxFiles) ? `/${mediaLimits.maxFiles}` : ""} archivos
        </span>
        <span>
          {formatBytes(currentTotalBytes)}
          {Number.isFinite(mediaLimits.maxTotalBytes) ? ` / ${formatBytes(mediaLimits.maxTotalBytes)}` : ""}
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

      {(state.media?.type === "video" || state.media?.type === "youtube") && <VideoControls />}

      <div className="youtube-input-row">
        <input
          type="text"
          placeholder="Pegar enlace de YouTube..."
          value={youtubeUrl}
          onChange={(e) => setYoutubeUrl(e.target.value)}
          className="youtube-url-input"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAddYoutube();
          }}
        />
        <button className="btn-add-youtube" onClick={handleAddYoutube} title="Agregar video de YouTube">
          <Plus size={14} /> <Youtube size={14} />
        </button>
      </div>

      {loading ? (
        <div className="media-upload-zone">
          <p>Cargando media local...</p>
        </div>
      ) : sortedMediaList.length === 0 ? (
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
                  ) : item.type === "youtube" ? (
                    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a24" }}>
                      <img src={`https://img.youtube.com/vi/${getYoutubeId(item.url)}/mqdefault.jpg`} alt="youtube-thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" }}>
                        <Youtube size={24} className="youtube-play-icon" />
                      </div>
                    </div>
                  ) : (
                    <img src={item.url} alt="thumb" />
                  )}
                  {isProjecting && (
                    <div className="projecting-badge">
                      <Zap size={10} fill="currentColor" /> EN VIVO
                    </div>
                  )}
                  {item.type === "image" && (
                    <button
                      className={`media-item-default ${defaultBackgroundMediaId === item.id ? "active" : ""}`}
                      onClick={(e) => toggleDefaultBackground(item, e)}
                      title={defaultBackgroundMediaId === item.id ? "Fondo predeterminado — clic para quitar" : "Usar como fondo predeterminado (se aplica a toda letra/versículo)"}
                    >
                      <Star size={12} fill={defaultBackgroundMediaId === item.id ? "currentColor" : "none"} />
                    </button>
                  )}
                  <button className="media-item-delete" onClick={(e) => void removeMedia(item.id, e)} title="Eliminar">
                    <X size={12} />
                  </button>
                </div>
                <div className="media-item-meta" title={`${item.name} · ${formatBytes(item.size)}`}>
                  <span>{item.name}</span>
                  {canManageMediaFolders && (
                    <select
                      className="media-move-select"
                      value={item.folderId ?? "__root__"}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const nextFolderId = e.target.value === "__root__" ? null : e.target.value;
                        void moveMediaToFolder(item.id, nextFolderId);
                      }}
                    >
                      <option value="__root__">Raíz</option>
                      {localMediaFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  )}
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
        .youtube-input-row {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }
        .youtube-url-input {
          flex: 1;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 6px 12px;
          color: var(--text-primary);
          font-size: 12px;
          outline: none;
          transition: border-color 0.2s;
        }
        .youtube-url-input:focus {
          border-color: var(--gold);
        }
        .btn-add-youtube {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .btn-add-youtube:hover {
          border-color: var(--gold);
          color: var(--text-primary);
          background: rgba(212, 175, 55, 0.05);
        }
        .youtube-play-icon {
          color: #ef4444;
          transition: transform 0.2s, color 0.2s;
        }
        .media-item-card:hover .youtube-play-icon {
          transform: scale(1.15);
          color: #ff0000;
          filter: drop-shadow(0 0 6px rgba(255, 0, 0, 0.6));
        }

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
          flex-wrap: nowrap;
        }

        .btn-media-toggle {
          flex: 1 1 0;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
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
        .media-folders-row {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .media-folder-chip-wrap {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--border);
          border-radius: 999px;
          overflow: hidden;
          background: var(--bg-elevated);
        }
        .media-folder-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 4px 10px;
          font-size: 11px;
          cursor: pointer;
        }
        .media-folder-chip.active,
        .media-folder-chip-wrap.active .media-folder-chip {
          color: var(--blue);
          font-weight: 700;
        }
        .media-folder-action {
          border: none;
          border-left: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .media-folder-action:hover { color: var(--blue); }
        .media-folder-action.danger:hover { color: var(--red); }
        .media-folder-add {
          border: 1px dashed var(--border);
          background: transparent;
          color: var(--text-muted);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .media-folder-add:hover {
          border-color: var(--blue);
          color: var(--blue);
        }
        .media-folder-premium-info-trigger {
          border: 1px solid rgba(212, 175, 55, 0.35);
          background: rgba(212, 175, 55, 0.12);
          color: var(--gold);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }
        .media-folder-premium-info-trigger:hover {
          border-color: var(--gold);
          background: rgba(212, 175, 55, 0.2);
        }
        .media-premium-popup {
          border: 1px solid rgba(212, 175, 55, 0.45);
          background: rgba(212, 175, 55, 0.1);
          border-radius: 8px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          animation: slideIn 0.2s ease;
        }
        .media-premium-popup-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: var(--gold);
          font-size: 12px;
        }
        .media-premium-popup-close {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          background: transparent;
          color: var(--gold);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .media-premium-popup-close:hover {
          background: rgba(212, 175, 55, 0.2);
        }
        .media-premium-popup-list {
          margin: 0;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 11px;
          color: #f5e8b2;
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
        }

        .media-gallery {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
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
        }
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

        .media-item-default {
          position: absolute; top: 4px; right: 26px;
          width: 18px; height: 18px; border-radius: 4px;
          background: rgba(0,0,0,0.6); color: white;
          border: 1px solid rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity 0.2s; cursor: pointer;
        }
        .media-item-card:hover .media-item-default { opacity: 1; }
        .media-item-default:hover { color: var(--gold); border-color: var(--gold); }
        .media-item-default.active {
          opacity: 1;
          color: var(--gold);
          border-color: var(--gold);
          background: rgba(212, 175, 55, 0.2);
        }
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
          display: flex;
          align-items: center;
          gap: 6px;
          justify-content: space-between;
        }
        .media-item-meta span {
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .media-move-select {
          background: rgba(0, 0, 0, 0.5);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 4px;
          font-size: 9px;
          max-width: 70px;
        }

        .media-item-add {
          aspect-ratio: 16/10;
          border: 2px dashed var(--border);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-muted);
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
