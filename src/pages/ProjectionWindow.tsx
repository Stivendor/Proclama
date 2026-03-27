import { useEffect, useState, useRef } from 'react'
import { onMessage, getChannel, sendMediaStatus } from '@/services/projection'
import type { ProjectionState, BroadcastMessage, CountdownState } from '@/types'
import { DEFAULT_THEME } from '@/stores'

const INITIAL_STATE: ProjectionState = {
  songId: null,
  songTitle: '',
  slides: [],
  currentSlide: 0,
  theme: DEFAULT_THEME,
  media: null
}

export default function ProjectionWindow() {
  const [state, setState] = useState<ProjectionState>(INITIAL_STATE)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  const [visible, setVisible] = useState(true)
  const prevSlideRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Escuchar mensajes de la ventana principal
  useEffect(() => {
    const off = onMessage((msg: BroadcastMessage) => {
      if (msg.type === 'PROJECTION_UPDATE') {
        prevSlideRef.current = state.currentSlide
        setState(msg.payload)
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
      } else if (msg.type === 'COUNTDOWN_UPDATE') {
        setCountdown(msg.payload)
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

  const { slides, currentSlide, theme, songTitle, isBible, hideText } = state
  const slide = slides[currentSlide]

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [autoFontSize, setAutoFontSize] = useState(theme.fontSize)

  // Calcule auto font size
  useEffect(() => {
    if (!theme.fontSizeMax || !containerRef.current || !contentRef.current || !slide) return

    const container = containerRef.current
    const content = contentRef.current

    let min = 20
    let max = 300 // Max sensible font size
    let best = min

    // We need to measure with the actual font family
    content.style.fontFamily = theme.fontFamily
    content.style.visibility = 'hidden'
    content.style.position = 'absolute'
    content.style.left = '0'
    content.style.top = '0'
    content.style.width = '90vw' // Match the 90% width in the real render
    
    while (min <= max) {
      let mid = Math.floor((min + max) / 2)
      content.style.fontSize = `${mid}px`
      
      // Check if it fits vertically and horizontally
      // We use 0.85 of height to leave room for some padding and better aesthetics
      const fitsHeight = content.scrollHeight <= container.clientHeight * 0.85
      // Horizontal check: if scrollWidth is > width of container, it's overflowing (even if wrapping)
      const fitsWidth = content.scrollWidth <= container.clientWidth * 0.95

      if (fitsHeight && fitsWidth) {
        best = mid
        min = mid + 1
      } else {
        max = mid - 1
      }
    }

    setAutoFontSize(best)
    content.style.visibility = ''
    content.style.position = ''
    content.style.width = ''
    content.style.fontSize = ''
    content.style.left = ''
    content.style.top = ''
  }, [slide, theme.fontSizeMax, theme.fontFamily, theme.titlePosition, theme.verseReferencePosition, songTitle])

  const isCountdownActive = countdown && countdown.status !== 'idle'

  const activeTheme = isCountdownActive ? countdown.config.theme : theme

  const bgStyle: React.CSSProperties = {
    background: activeTheme.backgroundType === 'image' && activeTheme.backgroundImageUrl
      ? `url(${activeTheme.backgroundImageUrl}) center/cover no-repeat`
      : activeTheme.backgroundType === 'color' || !activeTheme.backgroundType
        ? activeTheme.background
        : '#000',
  }

  const finalFontSize = theme.fontSizeMax ? autoFontSize : activeTheme.fontSize

  const textStyle: React.CSSProperties = {
    fontFamily: activeTheme.fontFamily,
    fontSize: `${finalFontSize}px`,
    color: activeTheme.textColor,
    textShadow: activeTheme.textShadow
      ? '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.7)'
      : 'none',
    lineHeight: 1.3,
    position: 'relative',
    zIndex: 10,
    width: '90%',
    margin: '0 auto'
  }

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const showTitle = (theme.showTitle || isBible) && songTitle
  const titleAtTop = showTitle && (isBible ? (theme.verseReferencePosition !== 'bottom') : (theme.titlePosition === 'top'))
  const titleAtBottom = showTitle && (isBible ? (theme.verseReferencePosition === 'bottom') : (theme.titlePosition === 'bottom'))

  return (
    <div className="projection-root" ref={containerRef} style={{ 
      position: 'relative', 
      width: '100vw', 
      height: '100vh', 
      background: '#000', 
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Capa de Fondo (Imagen/Color) con Blur */}
      <div 
        className="projection-background-base" 
        style={{ 
          position: 'absolute', inset: 0, 
          filter: `blur(${activeTheme.backgroundBlur || 0}px)`,
          transform: `scale(${activeTheme.backgroundBlur ? 1.1 : 1})`,
          zIndex: 0,
          ...bgStyle
        }} 
      />

      {/* Fondo de Video */}
      {activeTheme.backgroundType === 'video' && activeTheme.backgroundVideoUrl && (
        <video 
          key={activeTheme.backgroundVideoUrl}
          autoPlay 
          muted 
          loop 
          playsInline
          style={{ 
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', 
            zIndex: 1,
            filter: `blur(${activeTheme.backgroundBlur || 0}px)`,
            transform: `scale(${activeTheme.backgroundBlur ? 1.1 : 1})`
          }}
        >
          <source src={activeTheme.backgroundVideoUrl} type="video/mp4" />
        </video>
      )}

      {/* Capa de oscurecimiento (Overlay para legibilidad) */}
      <div 
        style={{ 
          position: 'absolute', inset: 0, 
          backgroundColor: `rgba(0,0,0,${activeTheme.backgroundOverlayOpacity ?? 0.3})`,
          zIndex: 5 
        }} 
      />

      {/* Proyección de Media (Anuncios) */}
      {state.media && (
        <div 
          className="projection-media-layer" 
          style={{ 
            position: 'absolute', inset: 0, 
            zIndex: state.media.isBackgroundMode ? 2 : 20, 
            background: state.media.isBackgroundMode ? 'transparent' : '#000',
            filter: state.media.isBackgroundMode ? `blur(${activeTheme.backgroundBlur || 0}px)` : 'none',
            transform: state.media.isBackgroundMode && activeTheme.backgroundBlur ? 'scale(1.1)' : 'scale(1)'
          }}
        >
          {state.media.type === 'video' ? (
            <video 
              ref={videoRef} 
              autoPlay 
              loop 
              style={{ width: '100%', height: '100%', objectFit: state.media.isBackgroundMode ? 'cover' : 'contain' }}
            >
              <source src={state.media.url} />
            </video>
          ) : (
            <img 
              src={state.media.url} 
              style={{ width: '100%', height: '100%', objectFit: state.media.isBackgroundMode ? 'cover' : 'contain' }} 
            />
          )}
        </div>
      )}

      {/* Negro total y Logo eliminados por el usuario */}


      {/* Contenido principal Countdown */}
      {isCountdownActive && !hideText && (
        <div className="projection-content countdown-projection" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 10,
          margin: '0 auto'
        }}>
          {countdown.config.title && (
            <div style={{
              fontFamily: activeTheme.fontFamily,
              color: activeTheme.textColor,
              opacity: 0.8,
              fontSize: '0.35em', // Relative to parent
              marginBottom: '3vh',
              textTransform: 'uppercase',
              letterSpacing: '4px',
              textShadow: activeTheme.textShadow ? '0 4px 30px rgba(0,0,0,0.9)' : 'none'
            }}>
              {countdown.config.title}
            </div>
          )}
          <div style={{
            fontFamily: activeTheme.fontFamily,
            color: (activeTheme as any).timerColor || activeTheme.textColor,
            fontSize: '1em',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 'bold',
            textShadow: activeTheme.textShadow ? '0 8px 40px rgba(0,0,0,0.9)' : 'none',
            lineHeight: 1
          }}>
            {formatTime(countdown.remainingTime)}
          </div>
        </div>
      )}

      {/* Contenido principal Slides */}
      {!isCountdownActive && !hideText && slide && (
        <div className="projection-content" key={currentSlide} style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', margin: '0 auto', width: '100%'
        }}>
          <div ref={contentRef} style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '100%',
            fontSize: `${finalFontSize}px`, // This is the base font size
            fontFamily: theme.fontFamily,
            color: theme.textColor
          }}>
            {titleAtTop && (
              <div className="projection-song-title" style={{ 
                opacity: 0.8,
                fontSize: '0.3em',
                marginBottom: '0.5em',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                {songTitle}
              </div>
            )}

            {theme.showVerseLabel && slide.label && (
              <div className="projection-verse-label" style={{ 
                fontSize: '0.4em',
                opacity: 0.6,
                marginBottom: '0.2em'
              }}>
                {slide.label}
              </div>
            )}

            <div className="projection-lines" style={{
              fontSize: '1em', // Base font size
              textShadow: activeTheme.textShadow
                ? '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.7)'
                : 'none',
              lineHeight: 1.25,
              width: '90%',
              margin: '0 auto'
            }}>
              {slide.lines.map((line, i) => (
                <div key={i} className="projection-line">{line}</div>
              ))}
            </div>

            {titleAtBottom && (
              <div className="projection-song-title" style={{ 
                opacity: 0.8,
                fontSize: '0.3em',
                marginTop: '0.5em',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                {songTitle}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pantalla en espera (sin canción) */}
      {!isCountdownActive && !hideText && !slide && (
        <div className="projection-waiting">
          <div style={{ fontFamily: theme.fontFamily, color: theme.textColor, opacity: 0.15, fontSize: '4rem' }}>
            ✝
          </div>
        </div>
      )}

      {/* Indicador de número de estrofa (discreto, esquina) */}
      {!isCountdownActive && slide && (
        <div className="projection-counter">
          {currentSlide + 1} / {slides.length}
        </div>
      )}
    </div>
  )
}
