import { useEffect, useState, useRef, useLayoutEffect, useCallback } from 'react'
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

// Safe area padding (percentage of viewport) — prevents text from bleeding off TV edges
const SAFE_PADDING_X = 0.06 // 6% each side
const SAFE_PADDING_Y = 0.05 // 5% top/bottom

export default function ProjectionWindow() {
  const [state, setState] = useState<ProjectionState>(INITIAL_STATE)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
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
    document.documentElement.requestFullscreen?.().catch(() => null)
  }, [])

  const { slides, currentSlide, theme, songTitle, isBible, hideText } = state
  const slide = slides[currentSlide]

  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [fittedFontSize, setFittedFontSize] = useState(48)

  const showTitle = (theme.showTitle || isBible) && songTitle
  const titleAtTop = showTitle && (isBible ? (theme.verseReferencePosition !== 'bottom') : (theme.titlePosition === 'top'))
  const titleAtBottom = showTitle && (isBible ? (theme.verseReferencePosition === 'bottom') : (theme.titlePosition === 'bottom'))

  // Robust auto-fit: binary search using actual container pixel dimensions
  const calculateFit = useCallback(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure || !slide) return

    // Available area = viewport minus safe padding
    const availW = container.clientWidth * (1 - SAFE_PADDING_X * 2)
    const availH = container.clientHeight * (1 - SAFE_PADDING_Y * 2)

    // Cap max to a sensible bound relative to viewport height
    let lo = 8
    let hi = Math.min(Math.floor(availH * 0.45), 500)
    let best = lo

    // Set measurement element width to match available width
    measure.style.width = `${availW}px`

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      measure.style.fontSize = `${mid}px`

      // Use 98% of available height as safety margin for sub-pixel rounding
      const fits = measure.scrollHeight <= availH * 0.98 && measure.scrollWidth <= availW
      if (fits) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    setFittedFontSize(best)
  }, [slide, theme.fontFamily, theme.textUppercase, isBible, titleAtTop, titleAtBottom, theme.showVerseLabel, songTitle])

  // Recalculate on slide change or window resize
  useLayoutEffect(() => {
    if (!slide) return
    // Small delay to ensure the measurement element has rendered with updated styles
    requestAnimationFrame(() => calculateFit())

    window.addEventListener('resize', calculateFit)
    return () => window.removeEventListener('resize', calculateFit)
  }, [calculateFit])

  const isCountdownActive = countdown && countdown.status !== 'idle'
  const activeTheme = isCountdownActive ? countdown.config.theme : theme

  const bgStyle: React.CSSProperties = {
    background: activeTheme.backgroundType === 'image' && activeTheme.backgroundImageUrl
      ? `url(${activeTheme.backgroundImageUrl}) center/cover no-repeat`
      : activeTheme.backgroundType === 'color' || !activeTheme.backgroundType
        ? activeTheme.background
        : '#000',
  }

  // Always auto-fit: use the largest font size that fits the screen
  const finalFontSize = fittedFontSize

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }



  // Shared text shadow for strong TV readability
  const strongShadow = activeTheme.textShadow
    ? '1px 1px 3px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.9), 0 4px 20px rgba(0,0,0,0.7), 0 8px 40px rgba(0,0,0,0.5)'
    : 'none'

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

      {/* ── Hidden measurement element (off-screen, matches visible rendering exactly) ── */}
      {slide && (
        <div
          ref={measureRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-99999px',
            top: 0,
            visibility: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontFamily: theme.fontFamily,
            fontWeight: 700,
            lineHeight: 1.3,
            textAlign: 'center',
            wordBreak: 'break-word',
            textTransform: theme.textUppercase ? 'uppercase' : 'none',
          }}
        >
          {titleAtTop && (
            <div style={{ fontSize: isBible ? '1em' : '0.35em', marginBottom: '0.4em', letterSpacing: isBible ? '0' : '2px' }}>
              {songTitle}
            </div>
          )}
          {theme.showVerseLabel && slide.label && (
            <div style={{ fontSize: '0.4em', marginBottom: '0.2em' }}>
              {slide.label}
            </div>
          )}
          {slide.lines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          {titleAtBottom && (
            <div style={{ fontSize: isBible ? '1em' : '0.35em', marginTop: '0.4em', letterSpacing: isBible ? '0' : '2px' }}>
              {songTitle}
            </div>
          )}
        </div>
      )}

      {/* Contenido principal Countdown */}
      {isCountdownActive && !hideText && (
        <div className="projection-content countdown-projection" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 10,
          padding: `${SAFE_PADDING_Y * 100}vh ${SAFE_PADDING_X * 100}vw`,
          boxSizing: 'border-box'
        }}>
          {countdown.config.title && (
            <div style={{
              fontFamily: activeTheme.fontFamily,
              color: activeTheme.textColor,
              opacity: 0.8,
              fontSize: '0.35em',
              marginBottom: '3vh',
              textTransform: 'uppercase',
              letterSpacing: '4px',
              textShadow: strongShadow
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
            textShadow: strongShadow,
            lineHeight: 1
          }}>
            {formatTime(countdown.remainingTime)}
          </div>
        </div>
      )}

      {/* ── Contenido principal Slides ── */}
      {!isCountdownActive && !hideText && slide && (
        <div className="projection-content" key={`${songTitle}-${currentSlide}`} style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center',
          padding: `${SAFE_PADDING_Y * 100}vh ${SAFE_PADDING_X * 100}vw`,
          boxSizing: 'border-box'
        }}>
          <div ref={contentRef} style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: '100%',
            maxWidth: '100%',
            fontSize: `${finalFontSize}px`,
            fontFamily: theme.fontFamily,
            fontWeight: 700,
            color: theme.textColor,
            lineHeight: 1.3,
            textTransform: theme.textUppercase ? 'uppercase' : 'none',
          }}>
            {titleAtTop && (
              <div className="projection-song-title" style={{ 
                opacity: isBible ? 1 : 0.7,
                fontSize: isBible ? '1em' : '0.35em',
                marginBottom: '0.4em',
                textTransform: 'inherit',
                letterSpacing: isBible ? '0' : '3px',
                fontWeight: 700,
                textShadow: strongShadow
              }}>
                {songTitle}
              </div>
            )}

            {theme.showVerseLabel && slide.label && (
              <div className="projection-verse-label" style={{ 
                fontSize: '0.4em',
                opacity: 0.6,
                marginBottom: '0.2em',
                textShadow: strongShadow
              }}>
                {slide.label}
              </div>
            )}

            <div className="projection-lines" style={{
              textShadow: strongShadow,
              lineHeight: 1.3,
              width: '100%',
              wordBreak: 'break-word',
            }}>
              {slide.lines.map((line, i) => (
                <div key={i} className="projection-line">{line}</div>
              ))}
            </div>

            {titleAtBottom && (
              <div className="projection-song-title" style={{ 
                opacity: isBible ? 1 : 0.7,
                fontSize: isBible ? '1em' : '0.35em',
                marginTop: '0.4em',
                textTransform: 'inherit',
                letterSpacing: isBible ? '0' : '3px',
                fontWeight: 700,
                textShadow: strongShadow
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
