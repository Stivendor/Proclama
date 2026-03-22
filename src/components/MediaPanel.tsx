import { useRef, useState, DragEvent } from 'react'
import { Image, Film, X, Upload, MonitorPlay, Zap, Plus, Trash2, AlertCircle } from 'lucide-react'
import { useProjectionStore } from '@/stores'
import VideoControls from './VideoControls'

interface LocalMedia {
  id: string
  url: string
  type: 'image' | 'video'
  name: string
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

export default function MediaPanel() {
  const { state, setMedia } = useProjectionStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mediaList, setMediaList] = useState<LocalMedia[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFiles = (files: File[]) => {
    setError(null)
    const validFiles: File[] = []
    const rejectedFiles: string[] = []

    files.forEach(file => {
      const isTypeValid = file.type.startsWith('image/') || file.type.startsWith('video/')
      const isSizeValid = file.size <= MAX_FILE_SIZE

      if (isTypeValid && isSizeValid) {
        validFiles.push(file)
      } else {
        rejectedFiles.push(file.name + (!isTypeValid ? ' (Tipo no válido)' : ' (Demasiado grande)'))
      }
    })

    if (rejectedFiles.length > 0) {
      setError(`No se pudieron cargar ${rejectedFiles.length} archivo(s): ${rejectedFiles.slice(0, 2).join(', ')}${rejectedFiles.length > 2 ? '...' : ''}`)
      setTimeout(() => setError(null), 5000)
    }

    if (validFiles.length === 0) return

    const newItems: LocalMedia[] = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
      name: file.name
    }))

    setMediaList(prev => [...prev, ...newItems])
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    processFiles(files)
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }

  const toggleProjection = (item: LocalMedia) => {
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
    <div 
      className={`media-panel ${isDragging ? 'is-dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="recognition-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MonitorPlay size={14} /> Anuncios / Media Local
        </div>
        {mediaList.length > 0 && (
          <button className="btn-add-mini" onClick={() => fileInputRef.current?.click()} title="Añadir más">
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

      {error && (
        <div className="media-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {state.media?.type === 'video' && <VideoControls />}

      {mediaList.length === 0 ? (
        <div 
          className={`media-upload-zone ${isDragging ? 'dragging' : ''}`} 
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={24} opacity={isDragging ? 0.8 : 0.3} className={isDragging ? 'bounce' : ''} />
          <p>{isDragging ? '¡Suelta para cargar!' : 'Cargar Anuncios (PNG, JPG, MP4)'}</p>
          <span>{isDragging ? 'Formatos soportados' : 'Arrastra aquí o haz clic para buscar'}</span>
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
                  <button className="media-item-delete" onClick={(e) => removeMedia(item.id, e)} title="Eliminar">
                    <X size={12} />
                  </button>
                </div>
              </div>
            )
          })}
          
          <div 
            className={`media-item-add ${isDragging ? 'dragging' : ''}`} 
            onClick={() => fileInputRef.current?.click()}
            title="Añadir anuncios (PNG, JPG, MP4)"
          >
            <Plus size={20} opacity={0.5} />
          </div>
        </div>
      )}

      {isDragging && mediaList.length > 0 && (
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
        }
        .media-panel.is-dragging {
          background: rgba(59, 130, 246, 0.03);
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
        .media-item-delete:hover { background: var(--red); border-color: var(--red); }

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
  )
}
