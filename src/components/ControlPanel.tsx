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
    <div className="control-panel">
      {/* Canción activa */}
      <div className="control-song-header">
        <div>
          <div className="control-song-title">{songTitle}</div>
          <div className="control-song-progress">
            Estrofa {currentSlide + 1} / {slides.length}
          </div>
        </div>
        <button className="btn-icon danger" onClick={clearSong} title="Cerrar canción">
          <X size={14} />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${slides.length > 0 ? ((currentSlide + 1) / slides.length) * 100 : 0}%` }}
        />
      </div>

      {/* Tamaño de texto de estrofas */}
      <div className="slides-size-control">
        <span>Tamaño</span>
        <input
          type="range" min="11" max="22" step="1"
          defaultValue={13}
          onChange={e => {
            document.documentElement.style.setProperty(
              '--slide-preview-size', `${e.target.value}px`
            )
          }}
        />
      </div>
      
      {/* Lista de estrofas */}
      <div className="slides-list">
        {slides.map((slide, i) => (
          <button
            key={i}
            className={`slide-item ${i === currentSlide ? 'active' : ''}`}
            onClick={() => goToSlide(i)}
          >
            {slide.label && <span className="slide-label">{slide.label}</span>}
            <span className="slide-preview">{slide.lines[0]}</span>
            {slide.lines[1] && <span className="slide-preview dim">{slide.lines[1]}</span>}
          </button>
        ))}
      </div>

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
