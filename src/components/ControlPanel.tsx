import { ChevronLeft, ChevronRight, Eye, EyeOff, Image, X } from 'lucide-react'
import { useProjectionStore } from '@/stores'

export default function ControlPanel() {
  const { state, nextSlide, prevSlide, goToSlide, setBlack, setLogo, clearSong } = useProjectionStore()
  const { slides, currentSlide, isBlack, isLogo, songTitle } = state

  if (!songTitle && slides.length === 0) {
    return (
      <div className="control-panel empty">
        <div className="control-empty-msg">
          <Eye size={32} opacity={0.3} />
          <p>Ninguna canción activa</p>
          <span>Selecciona una canción de la biblioteca</span>
        </div>
      </div>
    )
  }

  return (
    <div className="control-panel compact-sidebar">
      {/* Controles de navegación */}
      <div className="control-nav">
        <button className="btn-nav" onClick={prevSlide} disabled={currentSlide === 0}>
          <ChevronLeft size={20} />
          Anterior
        </button>
        <button className="btn-nav primary" onClick={nextSlide} disabled={currentSlide >= slides.length - 1}>
          Siguiente
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Botones Negro / Logo */}
      <div className="control-special">
        <button
          className={`btn-special ${isBlack ? 'active-black' : ''}`}
          onClick={() => setBlack(!isBlack)}
          title="Tecla B"
        >
          {isBlack ? <EyeOff size={16} /> : <Eye size={16} />}
          {isBlack ? 'Mostrar' : 'Negro'}
        </button>
        <button
          className={`btn-special ${isLogo ? 'active-logo' : ''}`}
          onClick={() => setLogo(!isLogo)}
        >
          <Image size={16} />
          Logo
        </button>
      </div>
    </div>
  )
}
