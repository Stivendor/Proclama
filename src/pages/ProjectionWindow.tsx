import { useEffect, useState, useRef } from 'react'
import { onMessage, getChannel, sendMediaStatus } from '@/services/projection'
import type { ProjectionState, BroadcastMessage } from '@/types'
import { DEFAULT_THEME } from '@/stores'

const INITIAL_STATE: ProjectionState = {
  songId: null,
  songTitle: '',
  slides: [],
  currentSlide: 0,
  isBlack: false,
  isLogo: false,
  theme: DEFAULT_THEME,
  media: null
}

export default function ProjectionWindow() {
  const [state, setState] = useState<ProjectionState>(INITIAL_STATE)
  const [visible, setVisible] = useState(true)
  const prevSlideRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Escuchar mensajes de la ventana principal
  useEffect(() => {
    const off = onMessage((msg: BroadcastMessage) => {
      if (msg.type === 'PROJECTION_UPDATE') {
        prevSlideRef.current = state.currentSlide
        setState(msg.payload)
      } else if (msg.type === 'SET_BLACK') {
        setState(s => ({ ...s, isBlack: msg.payload, isLogo: false }))
      } else if (msg.type === 'SET_LOGO') {
        setState(s => ({ ...s, isLogo: msg.payload, isBlack: false }))
      } else if (msg.type === 'MEDIA_COMMAND') {
        const { action, value } = msg.payload
        if (videoRef.current) {
          if (action === 'play') videoRef.current.play().catch(() => null)
          else if (action === 'pause') videoRef.current.pause()
          else if (action === 'seek' && value !== undefined) videoRef.current.currentTime = value
        }
      } else if (msg.type === 'PING') {
        // Responder para que la ventana principal sepa que estamos vivos
        getChannel().postMessage({ type: 'PONG' })
      }
    })
    return off
  }, [state.currentSlide])

  // Reportar estado del video periódicamente
  useEffect(() => {
    if (state.media?.type !== 'video') return

    const interval = setInterval(() => {
      const v = videoRef.current
      if (v && v.readyState >= 1) {
        sendMediaStatus(v.currentTime, v.duration || 0, !v.paused)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [state.media?.url, state.media?.type])

  // Estilos de la ventana de proyección
  useEffect(() => {
    document.body.style.background = '#000'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    document.body.style.cursor = 'none'
    // Intento de fullscreen automático
    document.documentElement.requestFullscreen?.().catch(() => null)
  }, [])

  const { slides, currentSlide, isBlack, isLogo, theme, songTitle, isBible } = state
  const slide = slides[currentSlide]

  const bgStyle: React.CSSProperties = {
    background: theme.backgroundType === 'image' && theme.backgroundImageUrl
      ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
      : theme.backgroundType === 'color' || !theme.backgroundType
        ? theme.background
        : '#000',
  }

  const textStyle: React.CSSProperties = {
    fontFamily: theme.fontFamily,
    fontSize: `${theme.fontSize}px`,
    color: theme.textColor,
    textShadow: theme.textShadow
      ? '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.7)'
      : 'none',
    lineHeight: 1.4,
    position: 'relative',
    zIndex: 10
  }

  return (
    <div className="projection-root" style={{ background: '#000', overflow: 'hidden' }}>
      {/* Capa de Fondo (Imagen/Color) con Blur */}
      <div 
        className="projection-background-base" 
        style={{ 
          position: 'absolute', inset: 0, 
          filter: `blur(${theme.backgroundBlur || 0}px)`,
          transform: `scale(${theme.backgroundBlur ? 1.1 : 1})`,
          zIndex: 0,
          ...bgStyle
        }} 
      />

      {/* Fondo de Video */}
      {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
        <video 
          key={theme.backgroundVideoUrl}
          autoPlay 
          muted 
          loop 
          playsInline
          style={{ 
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', 
            zIndex: 1,
            filter: `blur(${theme.backgroundBlur || 0}px)`,
            transform: `scale(${theme.backgroundBlur ? 1.1 : 1})`
          }}
        >
          <source src={theme.backgroundVideoUrl} type="video/mp4" />
        </video>
      )}

      {/* Capa de oscurecimiento (Overlay para legibilidad) */}
      <div 
        style={{ 
          position: 'absolute', inset: 0, 
          backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})`,
          zIndex: 5 
        }} 
      />

      {/* Proyección de Media (Anuncios) */}
      {state.media && (
        <div className="projection-media-layer" style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#000' }}>
          {state.media.type === 'video' ? (
            <video ref={videoRef} autoPlay loop style={{ width: '100%', height: '100%', objectFit: 'contain' }}>
              <source src={state.media.url} />
            </video>
          ) : (
            <img src={state.media.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
        </div>
      )}

      {/* Negro total */}
      <div className={`projection-black ${isBlack ? 'visible' : ''}`} style={{ zIndex: 30 }} />

      {/* Logo */}
      {isLogo && (
        <div className="projection-logo" style={{ zIndex: 15 }}>
          <div className="logo-placeholder">✝</div>
        </div>
      )}

      {/* Contenido principal */}
      {!isBlack && !isLogo && slide && (
        <div className="projection-content" key={currentSlide}>
          {(theme.showTitle || isBible) && songTitle && (
            <div className="projection-song-title" style={{ fontFamily: theme.fontFamily, color: theme.textColor, opacity: 0.8 }}>
              {songTitle}
            </div>
          )}

          {theme.showVerseLabel && slide.label && (
            <div className="projection-verse-label" style={{ fontFamily: theme.fontFamily, color: theme.textColor }}>
              {slide.label}
            </div>
          )}

          <div className="projection-lines" style={textStyle}>
            {slide.lines.map((line, i) => (
              <div key={i} className="projection-line">{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Pantalla en espera (sin canción) */}
      {!isBlack && !isLogo && !slide && (
        <div className="projection-waiting">
          <div style={{ fontFamily: theme.fontFamily, color: theme.textColor, opacity: 0.15, fontSize: '4rem' }}>
            ✝
          </div>
        </div>
      )}

      {/* Indicador de número de estrofa (discreto, esquina) */}
      {slide && !isBlack && (
        <div className="projection-counter">
          {currentSlide + 1} / {slides.length}
        </div>
      )}
    </div>
  )
}
