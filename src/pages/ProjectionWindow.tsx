import { useEffect, useRef, useState, useCallback } from 'react'
import { onMessage, getChannel, sendMediaStatus } from '@/services/projection'
import type { ProjectionState, BroadcastMessage, CountdownState, CountdownTheme } from '@/types'
import { DEFAULT_THEME, useAppStore } from '@/stores'
import { calcCanvasFontSize } from '@/hooks/useProjectionFontSize'

function getYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function loadYoutubeAPI(callback: () => void) {
  if ((window as any).YT && (window as any).YT.Player) {
    callback();
    return;
  }
  
  const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
  if (existingScript) {
    const interval = setInterval(() => {
      if ((window as any).YT && (window as any).YT.Player) {
        clearInterval(interval);
        callback();
      }
    }, 100);
    return;
  }

  const previousCallback = (window as any).onYouTubeIframeAPIReady;
  (window as any).onYouTubeIframeAPIReady = () => {
    if (previousCallback) previousCallback();
    callback();
  };

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
}

function YoutubePlayerContainer({ url, ytPlayerRef, objectFit }: { url: string; ytPlayerRef: React.MutableRefObject<any>; objectFit: 'cover' | 'contain' }) {
  const containerId = 'youtube-player-element';
  const videoId = getYoutubeId(url);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!videoId) return;

    let destroyed = false;
    let player: any = null;

    loadYoutubeAPI(() => {
      if (destroyed) return;
      
      player = new (window as any).YT.Player(containerId, {
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          mute: 0,
        },
        events: {
          onReady: (event: any) => {
            if (destroyed) return;
            playerRef.current = event.target;
            ytPlayerRef.current = event.target;
            event.target.playVideo();
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.ENDED) {
              event.target.playVideo();
            }
          }
        }
      });
    });

    return () => {
      destroyed = true;
      if (player && typeof player.destroy === 'function') {
        player.destroy();
      }
      ytPlayerRef.current = null;
    };
  }, [videoId, ytPlayerRef]);

  if (!videoId) {
    return (
      <div style={{ color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        Enlace de YouTube no válido
      </div>
    );
  }

  const isCover = objectFit === 'cover';
  
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#000'
    }}>
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          ...(isCover ? {
            width: '177.77777778vh',
            height: '56.25vw',
            minWidth: '100%',
            minHeight: '100%',
          } : {
            width: '100%',
            height: '100%',
          })
        }}
      >
        <div id={containerId} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}


const INITIAL_STATE: ProjectionState = {
  songId: null, songTitle: '', slides: [], currentSlide: 0, theme: DEFAULT_THEME, media: null
}

export default function ProjectionWindow() {
  const [state, setState] = useState<ProjectionState>(INITIAL_STATE)
  const [countdown, setCountdown] = useState<CountdownState | null>(null)
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
      if (msg.type === 'PROJECTION_UPDATE') setState(msg.payload)
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
      } else if (msg.type === 'COUNTDOWN_UPDATE') setCountdown(msg.payload)
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

  useEffect(() => {
    document.body.style.cssText = 'background:#000;margin:0;overflow:hidden'
    document.documentElement.requestFullscreen?.().catch(() => null)
  }, [])

  const { slides, currentSlide, theme, songTitle, songArtist, isBible, hideText } = state
  const slide = slides[currentSlide]

  // Título solo para Biblia (es la cita bibliográfica)
  const showTitle = isBible && songTitle
  const titleAtTop = showTitle && theme.verseReferencePosition !== 'bottom'
  const titleAtBottom = showTitle && theme.verseReferencePosition === 'bottom'

  const isCountdownActive = countdown && countdown.status !== 'idle'
  const activeTheme = isCountdownActive ? countdown.config.theme : theme

  const bgStyle: React.CSSProperties = {
    background: theme.backgroundType === 'image' && theme.backgroundImageUrl
      ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
      : theme.backgroundType === 'color' || !theme.backgroundType
        ? theme.background : '#000',
  }

  const bgFilter = `blur(${theme.backgroundBlur || 0}px)`
  const bgTransform = theme.backgroundBlur ? 'scale(1.05)' : 'none'

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const calcCountdownSize = (theme: CountdownTheme, title: string | undefined, remainingSeconds: number) => {
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
        {/* Fondo */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          filter: bgFilter,
          transform: bgTransform,
          ...bgStyle
        }} />

        {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
          <video key={theme.backgroundVideoUrl} autoPlay muted loop playsInline style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1,
            filter: bgFilter,
            transform: bgTransform,
          }}>
            <source src={theme.backgroundVideoUrl} type="video/mp4" />
          </video>
        )}


        <div style={{
          position: 'absolute', inset: 0, zIndex: 5,
          backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})`
        }} />

        {state.media && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: state.media.isBackgroundMode ? 2 : 20,
            background: state.media.isBackgroundMode ? 'transparent' : '#000',
            filter: state.media.isBackgroundMode ? bgFilter : 'none',
            transform: state.media.isBackgroundMode ? bgTransform : 'none',
          }}>
            {state.media.type === 'video' ? (
              <video
                key={state.media.url}
                ref={videoRef}
                src={state.media.url}
                autoPlay loop
                style={{ width: '100%', height: '100%', objectFit: state.media.objectFit || (state.media.isBackgroundMode ? 'cover' : 'contain') }}
              />
            ) : state.media.type === 'youtube' ? (
              <YoutubePlayerContainer
                url={state.media.url}
                ytPlayerRef={ytPlayerRef}
                objectFit={state.media.objectFit || (state.media.isBackgroundMode ? 'cover' : 'contain')}
              />
            ) : (
              <img src={state.media.url}
                style={{ width: '100%', height: '100%', objectFit: state.media.objectFit || (state.media.isBackgroundMode ? 'cover' : 'contain') }} />
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
                <div style={{
                  fontFamily: activeTheme.fontFamily, color: activeTheme.textColor, opacity: 0.8,
                  fontSize: `${countdownSizes.titleFontSize}px`, marginBottom: '0.5em',
                  textTransform: 'uppercase', letterSpacing: '4px', textShadow: strongShadow
                }}>
                  {countdown.config.title}
                </div>
              )}
              <div style={{
                fontFamily: activeTheme.fontFamily,
                color: (activeTheme as any).timerColor || activeTheme.textColor,
                fontSize: '1em', fontVariantNumeric: 'tabular-nums',
                fontWeight: 'bold', textShadow: strongShadow, lineHeight: 1
              }}>
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
                {slide.lines.map((line, i) => <div key={i}>{line}</div>)}
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
      </div>
    </div>
  )
}