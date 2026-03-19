import { useRef, useState } from 'react'
import { Image, Film, X, Upload, MonitorPlay, Zap, Plus, Trash2 } from 'lucide-react'
import { useProjectionStore } from '@/stores'
import VideoControls from './VideoControls'

interface LocalMedia {
  id: string
  url: string
  type: 'image' | 'video'
  name: string
}

export default function MediaPanel() {
  const { state, setMedia } = useProjectionStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mediaList, setMediaList] = useState<LocalMedia[]>([])

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newItems: LocalMedia[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name
    }))

    setMediaList(prev => [...prev, ...newItems])
    e.target.value = ''
  }

  const toggleProjection = (item: LocalMedia) => {
    // Si ya es el mismo URL el que está proyectándose, lo quitamos
    if (state.media?.url === item.url) {
      setMedia(null)
    } else {
      setMedia({ url: item.url, type: item.type })
    }
  }

  const removeMedia = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const item = mediaList.find(m => m.id === id)
    if (!item) return

    if (state.media?.url === item.url) {
      setMedia(null)
    }
    
    URL.revokeObjectURL(item.url)
    setMediaList(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="media-panel">
      <div className="recognition-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MonitorPlay size={14} /> Anuncios / Media Local
        </div>
        {mediaList.length > 0 && (
          <button className="btn-add-mini" onClick={() => fileInputRef.current?.click()}>
            <Plus size={14} />
          </button>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFiles} 
        accept="image/*,video/*" 
        multiple
        style={{ display: 'none' }} 
      />

      {state.media?.type === 'video' && <VideoControls />}

      {mediaList.length === 0 ? (
        <div className="media-upload-zone" onClick={() => fileInputRef.current?.click()}>
          <Upload size={24} opacity={0.3} />
          <p>Cargar Imágenes o Videos</p>
          <span>Solo local (no se guarda en la nube)</span>
        </div>
      ) : (
        <div className="media-gallery">
          {mediaList.map((item) => {
            const isProjecting = state.media?.url === item.url
            return (
              <div 
                key={item.id} 
                className={`media-item-card ${isProjecting ? 'projecting' : ''}`}
                onClick={() => toggleProjection(item)}
              >
                <div className="media-item-thumb">
                  {item.type === 'video' ? (
                    <video src={item.url} muted />
                  ) : (
                    <img src={item.url} alt="thumb" />
                  )}
                  {isProjecting && (
                    <div className="projecting-badge">
                      <Zap size={10} fill="currentColor" /> EN VIVO
                    </div>
                  )}
                  <button className="media-item-delete" onClick={(e) => removeMedia(item.id, e)}>
                    <X size={12} />
                  </button>
                </div>
              </div>
            )
          })}
          
          <div className="media-item-add" onClick={() => fileInputRef.current?.click()}>
            <Plus size={20} opacity={0.5} />
          </div>
        </div>
      )}

      <style>{`
        .media-panel { padding: 16px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 12px; }
        .btn-add-mini {
          background: var(--bg-elevated); border: 1px solid var(--border);
          color: var(--text-muted); border-radius: 4px; padding: 2px 6px;
          cursor: pointer; display: flex; align-items: center;
        }
        .btn-add-mini:hover { color: var(--blue); border-color: var(--blue); }

        .media-upload-zone {
          border: 2px dashed var(--border);
          border-radius: var(--radius-sm);
          padding: 32px 16px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.02);
        }
        .media-upload-zone:hover { border-color: var(--blue); background: rgba(59, 130, 246, 0.05); }
        .media-upload-zone p { font-size: 13px; font-weight: 500; margin: 0; }
        .media-upload-zone span { font-size: 11px; color: var(--text-muted); }

        .media-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 10px;
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
        .media-item-delete:hover { background: #ff4d4f; border-color: #ff4d4f; }

        .media-item-add {
          aspect-ratio: 16/10;
          border: 2px dashed var(--border);
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--text-muted);
          transition: all 0.2s;
        }
        .media-item-add:hover { border-color: var(--blue); color: var(--blue); background: rgba(59, 130, 246, 0.05); }
      `}</style>
    </div>
  )
}
