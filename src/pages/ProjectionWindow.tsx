import { useEffect, useRef, useState, useCallback } from 'react'
import { onMessage, getChannel, sendMediaStatus } from '@/services/projection'
import type { ProjectionState, BroadcastMessage, CountdownState, CountdownTheme, TickerState } from '@/types'
import { DEFAULT_THEME, useAppStore } from '@/stores'
import { calcCanvasFontSize } from '@/hooks/useProjectionFontSize'
import ProjectionBackground from '@/components/projection/ProjectionBackground'


const INITIAL_STATE: ProjectionState = {
  songId: null, songTitle: '', slides: [], currentSlide: 0, theme: DEFAULT_THEME, media: null
}

export default function ProjectionWindow() {
  const [state, setState] = useState<ProjectionState>(INITIAL_STATE)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  // Gana lo último que el operador proyectó: contador/reloj o contenido (canción/Biblia/media).
  // Así no hay que ocultar el contador para mostrar una letra: al proyectar contenido, se oculta solo.
  const [showTimer, setShowTimer] = useState(false)
  const prevCdStatus = useRef<CountdownState['status'] | undefined>(undefined)
  const [ticker, setTicker] = useState<TickerState | null>(null)
  const [now, setNow] = useState(() => new Date())
  // Canvas dinámico: se adapta al viewport real (soporta pantallas verticales, horizontales, cualquier resolución)
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [fontSize, setFontSize] = useState(72)
  const videoRef = useRef<HTMLVideoElement>(null)
  const ytPlayerRef = useRef<any>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Actualiza el tamaño del canvas al tamaño real del viewport
  const updateCanvasSize = useCallback(() => {
    setCanvasSize({ width: window.innerWidth, height: window.innerHeight })
  }, [])

  useEffect(() => {
    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    document.addEventListener('fullscreenchange', updateCanvasSize)
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      document.removeEventListener('fullscreenchange', updateCanvasSize)
    }
  }, [updateCanvasSize])

  // Recalcular font-size contra el canvas dinámico
  const recalcFont = useCallback(() => {
    const { slides, currentSlide, theme, songTitle, isBible } = stateRef.current
    const slide = slides[currentSlide]
    if (!slide) return
    const showTitle = (theme.showTitle || isBible) && songTitle
    const titleAtTop = !!showTitle && (isBible ? theme.verseReferencePosition !== 'bottom' : theme.titlePosition === 'top')
    const titleAtBottom = !!showTitle && (isBible ? theme.verseReferencePosition === 'bottom' : theme.titlePosition === 'bottom')
    const size = calcCanvasFontSize(slide, theme, songTitle, !!isBible, titleAtTop, titleAtBottom, canvasSize)
    setFontSize(size)
  }, [canvasSize])

  useEffect(() => {
    recalcFont()
  }, [state.slides, state.currentSlide, state.theme, state.songTitle, recalcFont])

  useEffect(() => {
    const off = onMessage((msg: BroadcastMessage) => {
      if (msg.type === 'PROJECTION_UPDATE') {
        setState(msg.payload)
        // Proyectar contenido (slides o media) toma prioridad y oculta contador/reloj
        if (msg.payload.slides?.length || msg.payload.media) setShowTimer(false)
      }
      else if (msg.type === 'MEDIA_COMMAND') {
        const { action, value } = msg.payload
        if (stateRef.current.media?.type === 'youtube' && ytPlayerRef.current) {
          const player = ytPlayerRef.current
          try {
            if (action === 'play') player.playVideo()
            else if (action === 'pause') player.pauseVideo()
            else if (action === 'seek' && value !== undefined) player.seekTo(value, true)
          } catch (e) {
            console.error('Error commanding YouTube player:', e)
          }
        } else if (videoRef.current) {
          if (action === 'play') videoRef.current.play().catch(() => null)
          else if (action === 'pause') videoRef.current.pause()
          else if (action === 'seek' && value !== undefined) videoRef.current.currentTime = value
        }
      } else if (msg.type === 'PING') {
        getChannel().postMessage({ type: 'PONG' })
      } else if (msg.type === 'COUNTDOWN_UPDATE') {
        setCountdown(msg.payload)
        const prev = prevCdStatus.current
        const st = msg.payload.status
        // Mostrar el contador/reloj solo ante una acción del operador (arranque o reloj),
        // no en los ticks de cada segundo (no deben robar el foco al contenido).
        if (st === 'clock' || (st === 'running' && prev !== 'running')) setShowTimer(true)
        else if (st === 'idle') setShowTimer(false)
        prevCdStatus.current = st
      }
      else if (msg.type === 'TICKER_UPDATE') setTicker(msg.payload)
    })
    return off
  }, [])

  useEffect(() => {
    if (state.media?.type !== 'video' && state.media?.type !== 'youtube') return
    const interval = setInterval(() => {
      if (state.media?.type === 'youtube') {
        const player = ytPlayerRef.current
        if (player && typeof player.getCurrentTime === 'function' && typeof player.getPlayerState === 'function') {
          try {
            const currentTime = player.getCurrentTime()
            const duration = player.getDuration() || 0
            const playerState = player.getPlayerState()
            const isPlaying = playerState === 1 // YT.PlayerState.PLAYING is 1
            sendMediaStatus(currentTime, duration, isPlaying)
          } catch (e) {}
        }
      } else {
        const v = videoRef.current
        if (v && v.readyState >= 1) sendMediaStatus(v.currentTime, v.duration || 0, !v.paused)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [state.media?.url, state.media?.type])

  // Reloj en vivo: solo corre cuando el modo reloj está activo
  useEffect(() => {
    if (countdown?.status !== 'clock') return
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [countdown?.status])

  useEffect(() => {
    document.body.style.cssText = 'background:#000;margin:0;overflow:hidden'
    document.documentElement.requestFullscreen?.().catch(() => null)
    // Avisa al control para que reemita el estado actual (contador/reloj/banda) si esta ventana
    // se abrió o recargó después de activarlos.
    getChannel().postMessage({ type: 'PROJECTION_READY' } as BroadcastMessage)
  }, [])

  const { slides, currentSlide, theme, songTitle, songArtist, isBible, hideText } = state
  const slide = slides[currentSlide]

  // Título solo para Biblia (es la cita bibliográfica)
  const showTitle = isBible && songTitle
  const titleAtTop = showTitle && theme.verseReferencePosition !== 'bottom'
  const titleAtBottom = showTitle && theme.verseReferencePosition === 'bottom'

  const isCountdownActive = showTimer && countdown && countdown.status !== 'idle'
  const activeTheme = isCountdownActive ? countdown.config.theme : theme

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const formatClock = (d: Date) => {
    const h24 = d.getHours()
    const ampm = h24 >= 12 ? 'PM' : 'AM'
    const h12 = h24 % 12 || 12
    return `${h12}:${d.getMinutes().toString().padStart(2, '0')} ${ampm}`
  }

  const calcCountdownSize = (theme: CountdownTheme, title: string | undefined, timerText: string) => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) {
      return {
        timerFontSize: theme.fontSize || 160,
        titleFontSize: Math.max(14, Math.floor((theme.fontSize || 160) * 0.25))
      }
    }

    // Usa canvasSize dinámico para que el countdown también escale correctamente
    const safeWidth = canvasSize.width * 0.92
    const safeHeight = canvasSize.height * 0.92
    // Reserva de altura constante: sin ella, el reloj (sin título) crece más que el contador y se desborda.
    const titleHeightReserve = safeHeight * 0.16
    const timerHeightMax = safeHeight - titleHeightReserve
    const fontWeight = 900
    const lineHeightFactor = 1.05

    // tabular-nums hace que cada dígito ocupe el ancho del más ancho; medimos con '0'
    // para no subestimar (p.ej. "11:29" tiene "1" angostos pero se renderizan anchos).
    const measureText = timerText.replace(/[0-9]/g, '0')
    const fits = (size: number) => {
      ctx.font = `${fontWeight} ${size}px ${theme.fontFamily}`
      const textWidth = ctx.measureText(measureText).width
      const textHeight = size * lineHeightFactor
      return textWidth <= safeWidth && textHeight <= timerHeightMax
    }

    let lo = 10
    let hi = Math.max(theme.fontSize || 160, Math.floor(timerHeightMax))
    let best = lo

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2)
      if (fits(mid)) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }

    const timerFontSize = Math.max(10, best)
    const titleFontSize = title
      ? Math.min(Math.max(12, Math.floor(timerFontSize * 0.22)), Math.floor(titleHeightReserve * 0.75))
      : 0

    return { timerFontSize, titleFontSize }
  }

  const strongShadow = activeTheme.textShadow
    ? `
      0 0 10px rgba(0,0,0,1), 
      0 0 20px rgba(0,0,0,0.8),
      -2px -2px 0px #000,
       2px -2px 0px #000,
      -2px  2px 0px #000,
       2px  2px 0px #000,
       0px -3px 0px #000,
       0px  3px 0px #000,
      -3px  0px 0px #000,
       3px  0px 0px #000
    `
    : 'none'

  const textStyle: React.CSSProperties = {
    fontFamily: theme.fontFamily, fontWeight: 900, color: theme.textColor,
    lineHeight: 1.15, textTransform: theme.textUppercase ? 'uppercase' : 'none',
    textAlign: 'center', wordBreak: 'break-word', width: '100%',
    fontSize: `${fontSize}px`,
  }

  // El canvas ocupa exactamente el viewport: sin scale, sin transform de centrado
  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    width: canvasSize.width,
    height: canvasSize.height,
    top: 0,
    left: 0,
    overflow: 'hidden',
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>
      <div style={canvasStyle}>
        <ProjectionBackground
          variant="live"
          theme={theme}
          media={state.media}
          mediaVideoRef={videoRef}
          ytPlayerRef={ytPlayerRef}
        />

        {/* Countdown / Reloj */}
        {isCountdownActive && (() => {
          const isClock = countdown.status === 'clock'
          const displayText = isClock ? formatClock(now) : formatTime(countdown.remainingTime)
          const title = isClock ? undefined : countdown.config.title
          const countdownSizes = calcCountdownSize(countdown.config.theme, title, displayText)
          return (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              opacity: hideText ? 0 : 1, transition: 'opacity 0.5s ease-in-out',
              fontSize: `${countdownSizes.timerFontSize}px`
            }}>
              {title && (
                <div style={{
                  fontFamily: activeTheme.fontFamily, color: activeTheme.textColor, opacity: 0.8,
                  fontSize: `${countdownSizes.titleFontSize}px`, marginBottom: '0.5em',
                  textTransform: 'uppercase', letterSpacing: '4px', textShadow: strongShadow
                }}>
                  {title}
                </div>
              )}
              <div style={{
                fontFamily: activeTheme.fontFamily,
                color: (activeTheme as any).timerColor || activeTheme.textColor,
                fontSize: '1em', fontVariantNumeric: 'tabular-nums',
                fontWeight: 'bold', textShadow: strongShadow, lineHeight: 1
              }}>
                {displayText}
              </div>
            </div>
          )
        })()}

        {/* Slides */}
        {!isCountdownActive && slide && (
          <div key={`${songTitle}-${currentSlide}`} style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: `${canvasSize.height * 0.07}px ${canvasSize.width * 0.08}px`,
            boxSizing: 'border-box', textAlign: 'center',
            opacity: hideText ? 0 : 1, transition: 'opacity 0.5s ease-in-out',
            animation: theme.transition === 'slide' ? 'slideUp 0.3s ease-out' : theme.transition === 'fade' ? 'fadeIn 0.4s ease' : 'none'
          }}>
            <div style={textStyle}>
              {titleAtTop && (
                <div style={{
                  opacity: 1, fontSize: '0.7em',
                  marginBottom: '0.4em', letterSpacing: '0', textShadow: strongShadow
                }}>
                  {songTitle}{isBible && theme.showBibleVersion && songArtist && ` (${songArtist})`}
                </div>
              )}
              <div style={{ textShadow: strongShadow }}>
                {slide.lines.map((line, i) => (
                  <div key={i}>
                    {/* Biblia paralela: separa los dos idiomas con una línea divisoria */}
                    {isBible && i > 0 && (
                      <div style={{
                        width: '35%', height: '2px', margin: '0.3em auto',
                        background: theme.textColor, opacity: 0.35,
                      }} />
                    )}
                    {line}
                  </div>
                ))}
              </div>
              {titleAtBottom && (
                <div style={{
                  opacity: 1, fontSize: '0.7em',
                  marginTop: '0.4em', letterSpacing: '0', textShadow: strongShadow
                }}>
                  {songTitle}{isBible && theme.showBibleVersion && songArtist && ` (${songArtist})`}
                </div>
              )}
            </div>
          </div>
        )}

        {!isCountdownActive && !slide && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
            opacity: hideText ? 0 : 1, transition: 'opacity 0.5s ease-in-out'
          }}>
            <div style={{ fontFamily: theme.fontFamily, color: theme.textColor, opacity: 0.15, fontSize: '8rem' }}></div>
          </div>
        )}

        {!isCountdownActive && slide && (
          <div style={{
            position: 'absolute', bottom: 16, right: 24, zIndex: 20,
            color: 'rgba(255,255,255,0.3)', fontSize: '1.2rem', fontFamily: 'monospace'
          }}>
            {currentSlide + 1} / {slides.length}
          </div>
        )}

        {/* Banda de avisos (ticker) */}
        {ticker?.active && ticker.text.trim() && (
          <div style={{
            position: 'absolute', left: 0, right: 0, zIndex: 30,
            top: ticker.position === 'top' ? 0 : undefined,
            bottom: ticker.position === 'bottom' ? 0 : undefined,
            background: 'rgba(0,0,0,0.65)', overflow: 'hidden', whiteSpace: 'nowrap',
            padding: `${Math.round(canvasSize.height * 0.012)}px 0`,
          }}>
            <div style={{
              display: 'inline-block', paddingLeft: '100%', willChange: 'transform',
              animation: `ticker-scroll ${(Math.max(12, Math.round(ticker.text.length * 0.35)) / (ticker.speed || 1)).toFixed(1)}s linear infinite`,
              color: '#fff', fontFamily: theme.fontFamily, fontWeight: 700,
              fontSize: `${Math.round(canvasSize.height * 0.05)}px`,
              textShadow: '0 2px 6px rgba(0,0,0,0.8)',
            }}>
              {ticker.text}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes ticker-scroll { from { transform: translateX(0) } to { transform: translateX(-100%) } }`}</style>
    </div>
  )
}