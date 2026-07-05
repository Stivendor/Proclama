import { Star, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore } from '@/stores'
import type { LocalMedia } from '@/types'

/** Estante fijo de fondos de letra: el activo (estrella) recibe toda letra proyectada. */
export default function BackgroundShelf() {
  const {
    localMediaList, pinnedBackgroundIds, setPinnedBackgroundIds,
    defaultBackgroundMediaId, setDefaultBackgroundMediaId, updateTheme,
  } = useProjectionStore(useShallow(s => ({
    localMediaList: s.localMediaList,
    pinnedBackgroundIds: s.pinnedBackgroundIds,
    setPinnedBackgroundIds: s.setPinnedBackgroundIds,
    defaultBackgroundMediaId: s.defaultBackgroundMediaId,
    setDefaultBackgroundMediaId: s.setDefaultBackgroundMediaId,
    updateTheme: s.updateTheme,
  })))

  // Miniaturas resueltas por id contra la media local (las blob URLs nunca se persisten).
  const pinned = pinnedBackgroundIds
    .map(id => localMediaList.find(m => m.id === id && m.type === 'image'))
    .filter((m): m is LocalMedia => !!m)

  const deactivate = () => {
    setDefaultBackgroundMediaId(null)
    updateTheme({ backgroundType: 'color' })
  }

  const activate = (item: LocalMedia) => {
    if (defaultBackgroundMediaId === item.id) { deactivate(); return }
    setDefaultBackgroundMediaId(item.id)
    updateTheme({ backgroundType: 'image', backgroundImageUrl: item.url, backgroundThumbnail: undefined })
  }

  const unpin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (defaultBackgroundMediaId === id) deactivate()
    setPinnedBackgroundIds(prev => prev.filter(p => p !== id))
  }

  return (
    <div className="bg-shelf">
      <div className="bg-shelf-header">
        <Star size={12} /> Fondos de letra
      </div>
      {pinned.length === 0 ? (
        <p className="bg-shelf-hint">Fija fondos con el 📌 de tu media local</p>
      ) : (
        <div className="bg-shelf-row">
          {pinned.map(item => (
            <button
              key={item.id}
              className={`bg-shelf-item ${defaultBackgroundMediaId === item.id ? 'active' : ''}`}
              onClick={() => activate(item)}
              title={defaultBackgroundMediaId === item.id
                ? `${item.name} — fondo activo, clic para desactivar`
                : `${item.name} — clic para usarlo en toda letra/versículo`}
            >
              <img src={item.url} alt={item.name} />
              {defaultBackgroundMediaId === item.id && (
                <Star size={10} fill="currentColor" className="bg-shelf-star" />
              )}
              <span
                className="bg-shelf-remove"
                role="button"
                title="Quitar del recuadro"
                onClick={(e) => unpin(item.id, e)}
              >
                <X size={10} />
              </span>
            </button>
          ))}
        </div>
      )}
      <style>{`
        .bg-shelf { border-bottom: 1px solid var(--border); padding: 8px 0; margin-bottom: 8px; }
        .bg-shelf-header {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;
        }
        .bg-shelf-hint { font-size: 11px; color: var(--text-muted); margin: 0; }
        .bg-shelf-row { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }
        .bg-shelf-item {
          position: relative; flex: 0 0 auto; width: 64px; height: 36px;
          border-radius: 6px; overflow: hidden; border: 2px solid transparent;
          padding: 0; cursor: pointer; background: var(--bg-elevated);
        }
        .bg-shelf-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .bg-shelf-item.active { border-color: var(--gold); }
        .bg-shelf-star { position: absolute; top: 2px; left: 2px; color: var(--gold); }
        .bg-shelf-remove {
          position: absolute; top: 2px; right: 2px; width: 14px; height: 14px;
          border-radius: 4px; background: rgba(0,0,0,0.6); color: #fff;
          display: none; align-items: center; justify-content: center;
        }
        .bg-shelf-item:hover .bg-shelf-remove { display: flex; }
      `}</style>
    </div>
  )
}
