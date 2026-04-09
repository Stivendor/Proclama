import { useEffect, useRef, useState, useCallback } from 'react'
import { onMessage, getChannel, sendMediaStatus } from '@/services/projection'
import type { ProjectionState, BroadcastMessage, CountdownState, CountdownTheme } from '@/types'
import { DEFAULT_THEME, CANVAS_SIZE, useAppStore } from '@/stores'
import { calcCanvasFontSize } from '@/hooks/useProjectionFontSize'

const INITIAL_STATE: ProjectionState = {
  songId: null, songTitle: '', slides: [], currentSlide: 0, theme: DEFAULT_THEME, media: null
}

export default function ProjectionWindow() {
  const [state, setState] = useState<ProjectionState>(INITIAL_STATE)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
  const [scale, setScale] = useState(1)
  const [fontSize, setFontSize] = useState(72)
  const videoRef = useRef<HTMLVideoElement>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const canvas = CANVAS_SIZE

  // Escalar el canvas fijo al viewport actual
  const updateScale = useCallback(() => {
    const scaleX = window.innerWidth  / canvas.width
    const scaleY = window.innerHeight / canvas.height
    setScale(Math.min(scaleX, scaleY))
  }, [canvas.width, canvas.height])

  useEffect(() => {
    updateScale()
    window.addEventListener('resize', updateScale)
    document.addEventListener('fullscreenchange', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      document.removeEventListener('fullscreenchange', updateScale)
    }
  }, [updateScale])

  // Recalcular font-size contra el canvas fijo (no el viewport)
  const recalcFont = useCallback(() => {
    const { slides, currentSlide, theme, songTitle, isBible } = stateRef.current
    const slide = slides[currentSlide]
    if (!slide) return
    const showTitle = (theme.showTitle || isBible) && songTitle
    const titleAtTop = !!showTitle && (isBible ? theme.verseReferencePosition !== 'bottom' : theme.titlePosition === 'top')
    const titleAtBottom = !!showTitle && (isBible ? theme.verseReferencePosition === 'bottom' : theme.titlePosition === 'bottom')
    const size = calcCanvasFontSize(slide, theme, songTitle, !!isBible, titleAtTop, titleAtBottom)
    setFontSize(size)
  }, [])

  useEffect(() => {
    recalcFont()
  }, [state.slides, state.currentSlide, state.theme, state.songTitle, recalcFont])

  useEffect(() => {
    const off = onMessage((msg: BroadcastMessage) => {
      if (msg.type === 'PROJECTION_UPDATE') setState(msg.payload)
      else if (msg.type === 'MEDIA_COMMAND') {
        const { action, value } = msg.payload
        if (videoRef.current) {
          if (action === 'play') videoRef.current.play().catch(() => null)
          else if (action === 'pause') videoRef.current.pause()
          else if (action === 'seek' && value !== undefined) videoRef.current.currentTime = value
        }
      } else if (msg.type === 'PING') {
        getChannel().postMessage({ type: 'PONG' })
      } else if (msg.type === 'COUNTDOWN_UPDATE') setCountdown(msg.payload)
    })
    return off
  }, [])

  useEffect(() => {
    if (state.media?.type !== 'video') return
    const interval = setInterval(() => {
      const v = videoRef.current
      if (v && v.readyState >= 1) sendMediaStatus(v.currentTime, v.duration || 0, !v.paused)
    }, 500)
    return () => clearInterval(interval)
  }, [state.media?.url, state.media?.type])

  useEffect(() => {
    document.body.style.cssText = 'background:#000;margin:0;overflow:hidden;cursor:none'
    document.documentElement.requestFullscreen?.().catch(() => null)
  }, [])

  const { slides, currentSlide, theme, songTitle, isBible, hideText } = state
  const slide = slides[currentSlide]
  
  // Título solo para Biblia (es la cita bibliográfica)
  const showTitle = isBible && songTitle
  const titleAtTop = showTitle && theme.verseReferencePosition !== 'bottom'
  const titleAtBottom = showTitle && theme.verseReferencePosition === 'bottom'

  const isCountdownActive = countdown && countdown.status !== 'idle'
  const activeTheme = isCountdownActive ? countdown.config.theme : theme

  const bgStyle: React.CSSProperties = {
    background: activeTheme.backgroundType === 'image' && activeTheme.backgroundImageUrl
      ? `url(${activeTheme.backgroundImageUrl}) center/cover no-repeat`
      : activeTheme.backgroundType === 'color' || !activeTheme.backgroundType
        ? activeTheme.background : '#000',
  }

  const bgFilter = `blur(${activeTheme.backgroundBlur || 0}px) brightness(${1 - ((activeTheme.backgroundOverlayOpacity ?? 0.3))})`
  const bgTransform = activeTheme.backgroundBlur ? 'scale(1.05)' : 'none'

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const calcCountdownSize = (theme: CountdownTheme, title: string | undefined, remainingSeconds: number) => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) {
      return { timerFontSize: theme.fontSize || 160, titleFontSize: Math.max(14, Math.floor((theme.fontSize || 160) * 0.25)) }
    }

    const safeWidth = canvas.width * 0.92
    const safeHeight = canvas.height * 0.92
    const titleHeightReserve = title ? safeHeight * 0.16 : 0
    const timerHeightMax = safeHeight - titleHeightReserve
    const timerText = formatTime(remainingSeconds)
    const fontWeight = 900
    const lineHeightFactor = 1.05

    const fits = (size: number) => {
      ctx.font = `${fontWeight} ${size}px ${theme.fontFamily}`
      const textWidth = ctx.measureText(timerText).width
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

  // El canvas fijo se centra y escala al viewport
  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    width: canvas.width, height: canvas.height,
    top: '50%', left: '50%',
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center center',
    overflow: 'hidden',
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>
      <div style={canvasStyle}>
        {/* Fondo */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          filter: bgFilter,
          transform: bgTransform,
          ...bgStyle
        }} />

        {activeTheme.backgroundType === 'video' && activeTheme.backgroundVideoUrl && (
          <video key={activeTheme.backgroundVideoUrl} autoPlay muted loop playsInline style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1,
            filter: bgFilter,
            transform: bgTransform,
          }}>
            <source src={activeTheme.backgroundVideoUrl} type="video/mp4" />
          </video>
        )}

        <div style={{ position: 'absolute', inset: 0, zIndex: 5,
          backgroundColor: `rgba(0,0,0,${activeTheme.backgroundOverlayOpacity ?? 0.3})` }} />

        {state.media && (
          <div style={{ 
            position: 'absolute', inset: 0, zIndex: state.media.isBackgroundMode ? 2 : 20,
            background: state.media.isBackgroundMode ? 'transparent' : '#000',
            filter: state.media.isBackgroundMode ? bgFilter : 'none',
            transform: state.media.isBackgroundMode ? bgTransform : 'none',
          }}>
            {state.media.type === 'video' ? (
              <video ref={videoRef} autoPlay loop
                style={{ width: '100%', height: '100%', objectFit: state.media.isBackgroundMode ? 'cover' : 'contain' }}>
                <source src={state.media.url} />
              </video>
            ) : (
              <img src={state.media.url}
                style={{ width: '100%', height: '100%', objectFit: state.media.isBackgroundMode ? 'cover' : 'contain' }} />
            )}
          </div>
        )}

        {/* Countdown */}
        {isCountdownActive && (() => {
          const countdownSizes = calcCountdownSize(countdown.config.theme, countdown.config.title, countdown.remainingTime)
          return (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              opacity: hideText ? 0 : 1, transition: 'opacity 0.5s ease-in-out',
              fontSize: `${countdownSizes.timerFontSize}px`
            }}>
              {countdown.config.title && (
                <div style={{ fontFamily: activeTheme.fontFamily, color: activeTheme.textColor, opacity: 0.8,
                  fontSize: `${countdownSizes.titleFontSize}px`, marginBottom: '0.5em', textTransform: 'uppercase', letterSpacing: '4px', textShadow: strongShadow }}>
                  {countdown.config.title}
                </div>
              )}
              <div style={{ fontFamily: activeTheme.fontFamily, color: (activeTheme as any).timerColor || activeTheme.textColor,
                fontSize: '1em', fontVariantNumeric: 'tabular-nums', fontWeight: 'bold', textShadow: strongShadow, lineHeight: 1 }}>
                {formatTime(countdown.remainingTime)}
              </div>
            </div>
          )
        })()}

        {/* Slides */}
        {!isCountdownActive && slide && (
          <div key={`${songTitle}-${currentSlide}`} style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: `${canvas.height * 0.07}px ${canvas.width * 0.08}px`,
            boxSizing: 'border-box', textAlign: 'center',
            opacity: hideText ? 0 : 1, transition: 'opacity 0.5s ease-in-out',
            animation: theme.transition === 'slide' ? 'slideUp 0.3s ease-out' : theme.transition === 'fade' ? 'fadeIn 0.4s ease' : 'none'
          }}>
            <div style={textStyle}>
              {titleAtTop && (
                <div style={{ opacity: 1, fontSize: '0.85em',
                  marginBottom: '0.4em', letterSpacing: '0', textShadow: strongShadow }}>
                  {songTitle}
                </div>
              )}
              <div style={{ textShadow: strongShadow }}>
                {slide.lines.map((line, i) => <div key={i}>{line}</div>)}
              </div>
              {titleAtBottom && (
                <div style={{ opacity: 1, fontSize: '0.85em',
                  marginTop: '0.4em', letterSpacing: '0', textShadow: strongShadow }}>
                  {songTitle}
                </div>
              )}
            </div>
          </div>
        )}

        {!isCountdownActive && !slide && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
            opacity: hideText ? 0 : 1, transition: 'opacity 0.5s ease-in-out' 
          }}>
            <div style={{ fontFamily: theme.fontFamily, color: theme.textColor, opacity: 0.15, fontSize: '8rem' }}>✝</div>
          </div>
        )}

        {!isCountdownActive && slide && (
          <div style={{ position: 'absolute', bottom: 16, right: 24, zIndex: 20,
            color: 'rgba(255,255,255,0.3)', fontSize: '1.2rem', fontFamily: 'monospace' }}>
            {currentSlide + 1} / {slides.length}
          </div>
        )}
      </div>
    </div>
  )
}
