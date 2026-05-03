import { Type, Eye } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useProjectionStore } from '@/stores'
import MediaPanel from './MediaPanel'

export default function ControlPanel() {
  const { slides, currentSlide, hideText, songTitle, nextSlide, prevSlide, goToSlide, setHideText, clearSong } = useProjectionStore(useShallow(s => ({
    slides: s.state.slides,
    currentSlide: s.state.currentSlide,
    hideText: s.state.hideText,
    songTitle: s.state.songTitle,
    nextSlide: s.nextSlide,
    prevSlide: s.prevSlide,
    goToSlide: s.goToSlide,
    setHideText: s.setHideText,
    clearSong: s.clearSong
  })))

  if (!songTitle && slides.length === 0) {
    return (
      <div className="control-panel empty">
        <div className="control-empty-msg">
          <Eye size={32} opacity={0.3} />
          <p>Ninguna canción activa</p>
          <span>Selecciona una canción de la biblioteca</span>
        </div>
        <MediaPanel />
      </div>
    )
  }

  return (
    <div className="control-panel compact-sidebar">
      <div className="control-song-header">
        <div className="control-song-title">{songTitle}</div>
      </div>


      <div className="control-special">
        <button
          className={`btn-special ${hideText ? 'active-hide' : ''}`}
          onClick={() => setHideText(!hideText)}
          style={{ width: '100%' }}
          title="Ocultar solo el texto (Mantener fondo)"
        >
          {hideText ? <Type size={16} opacity={0.5} /> : <Type size={16} />}
          {hideText ? 'Mostrar Texto' : 'Ocultar Texto'}
        </button>
      </div>

      <style>{`
        .active-hide {
          background: rgba(59, 130, 246, 0.2) !important;
          border-color: var(--blue) !important;
          color: var(--blue) !important;
        }
      `}</style>

      <MediaPanel />
    </div>
  )
}
