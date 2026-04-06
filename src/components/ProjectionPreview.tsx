import { useState, useEffect, useCallback, memo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { onMessage } from '@/services/projection'
import { useProjectionStore, DEFAULT_THEME, CANVAS_SIZE, useAppStore } from '@/stores'
import { useCountdownStore } from '@/stores/countdown'
import type { ProjectionState, BroadcastMessage, CountdownState } from '@/types'
import { calcCanvasFontSize } from '@/hooks/useProjectionFontSize'

const STORAGE_KEY = 'proclama-preview-collapsed'

interface PreviewState {
  isCollapsed: boolean
  projectionState: ProjectionState | null
  countdownState: CountdownState | null
}

// Helper: Load collapsed state from localStorage
const loadCollapsedState = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'true'
  } catch (error) {
    console.warn('localStorage not available, using default state')
    return false // default to expanded
  }
}

// Helper: Save collapsed state to localStorage
const saveCollapsedState = (collapsed: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed))
  } catch (error) {
    console.warn('Failed to persist preview state')
  }
}

// Helper: Validate projection state
const validateProjectionState = (state: any): ProjectionState | null => {
  if (!state || typeof state !== 'object') return null
  
  return {
    songId: state.songId ?? null,
    songTitle: state.songTitle ?? '',
    slides: Array.isArray(state.slides) ? state.slides : [],
    currentSlide: typeof state.currentSlide === 'number' ? state.currentSlide : 0,
    theme: state.theme ?? DEFAULT_THEME,
    media: state.media ?? null,
    hideText: state.hideText ?? false,
    isBible: state.isBible ?? false
  }
}

function ProjectionPreview() {
  const [state, setState] = useState<PreviewState>({
    isCollapsed: loadCollapsedState(),
    projectionState: null,
    countdownState: null
  })

  const [showSyncWarning, setShowSyncWarning] = useState(false)

  // Subscribe to Zustand store for real-time updates
  useEffect(() => {
    // Set initial state from store
    const initialState = useProjectionStore.getState().state
    setState(prev => ({
      ...prev,
      projectionState: initialState
    }))

    // Subscribe to store changes - the callback receives the full store state
    const unsubscribe = useProjectionStore.subscribe((storeState) => {
      setState(prev => ({
        ...prev,
        projectionState: storeState.state
      }))
    })
    
    return unsubscribe
  }, [])

  // Subscribe to countdown store for real-time updates
  useEffect(() => {
    // Set initial countdown state
    const countdownStore = useCountdownStore.getState()
    const initialCountdown: CountdownState = {
      status: countdownStore.status,
      remainingTime: countdownStore.remainingTime,
      config: countdownStore.config
    }
    setState(prev => ({
      ...prev,
      countdownState: initialCountdown
    }))

    // Subscribe to countdown store changes
    const unsubscribe = useCountdownStore.subscribe((countdownStore) => {
      const newCountdown: CountdownState = {
        status: countdownStore.status,
        remainingTime: countdownStore.remainingTime,
        config: countdownStore.config
      }
      setState(prev => ({
        ...prev,
        countdownState: newCountdown
      }))
    })
    
    return unsubscribe
  }, [])

  // Subscribe to BroadcastChannel for projection updates
  useEffect(() => {
    try {
      const unsubscribe = onMessage((msg: BroadcastMessage) => {
        if (msg.type === 'PROJECTION_UPDATE') {
          const validated = validateProjectionState(msg.payload)
          if (validated) {
            setState(prev => ({ ...prev, projectionState: validated }))
          }
        } else if (msg.type === 'COUNTDOWN_UPDATE') {
          setState(prev => ({ ...prev, countdownState: msg.payload }))
        }
      })
      return unsubscribe
    } catch (error) {
      console.warn('BroadcastChannel not supported, preview will use store state only')
      setShowSyncWarning(true)
    }
  }, [])

  const toggleCollapse = useCallback(() => {
    setState(prev => {
      const newCollapsed = !prev.isCollapsed
      saveCollapsedState(newCollapsed)
      return { ...prev, isCollapsed: newCollapsed }
    })
  }, [])

  const { isCollapsed, projectionState, countdownState } = state
  const isCountdownActive = countdownState && countdownState.status !== 'idle'
  const canvas = CANVAS_SIZE

  // Helper: Format countdown time as MM:SS
  const formatTime = (totalSeconds: number): string => {
    const clamped = Math.max(0, Math.floor(totalSeconds))
    const m = Math.floor(clamped / 60)
    const s = clamped % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Render slide content usando canvas fijo escalado
  const renderSlideContent = () => {
    if (!projectionState || projectionState.slides.length === 0) {
      return (
        <div className="preview-empty-state">
          <div style={{ opacity: 0.3, fontSize: '2rem' }}>✝</div>
        </div>
      )
    }

    const { slides, currentSlide, theme, songTitle, isBible, hideText } = projectionState
    const slide = slides[currentSlide]
    if (!slide) return null

    const showTitle = !!(isBible && songTitle)
    const titleAtTop = showTitle && theme.verseReferencePosition !== 'bottom'
    const titleAtBottom = showTitle && theme.verseReferencePosition === 'bottom'

    const fontSize = calcCanvasFontSize(slide, theme, songTitle, !!isBible, titleAtTop, titleAtBottom)
    const textShadow = theme.textShadow 
      ? '0 0 10px rgba(0,0,0,1), -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 2px 2px 0px #000' 
      : 'none'

    return (
      <>
        <div style={{
          position: 'absolute', inset: 0,
          background: theme.backgroundType === 'image' && theme.backgroundImageUrl
            ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
            : theme.backgroundType === 'color' || !theme.backgroundType ? theme.background : '#000',
          filter: `brightness(${1 - (theme.backgroundDarkness || 0)})`,
        }} />
        {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
          <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src={theme.backgroundVideoUrl} type="video/mp4" />
          </video>
        )}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})` }} />
        {!hideText && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: `${canvas.height * 0.07}px ${canvas.width * 0.08}px`,
            boxSizing: 'border-box', textAlign: 'center',
            fontFamily: theme.fontFamily, fontWeight: 900, color: theme.textColor,
            lineHeight: 1.15, textTransform: theme.textUppercase ? 'uppercase' : 'none',
            fontSize: `${fontSize}px`, wordBreak: 'break-word',
          }}>
            {titleAtTop && (
              <div style={{ opacity: 1, fontSize: '0.85em', marginBottom: '0.4em', textShadow }}>
                {songTitle}
              </div>
            )}
            <div style={{ textShadow }}>
              {slide.lines.map((line, i) => <div key={i}>{line}</div>)}
            </div>
            {titleAtBottom && (
              <div style={{ opacity: 1, fontSize: '0.85em', marginTop: '0.4em', textShadow }}>
                {songTitle}
              </div>
            )}
          </div>
        )}
        {projectionState.media && (
          <div style={{ position: 'absolute', inset: 0, zIndex: projectionState.media.isBackgroundMode ? 2 : 20,
            background: projectionState.media.isBackgroundMode ? 'transparent' : '#000' }}>
            {projectionState.media.type === 'video' ? (
              <video autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: projectionState.media.isBackgroundMode ? 'cover' : 'contain' }}>
                <source src={projectionState.media.url} type="video/mp4" />
              </video>
            ) : (
              <img src={projectionState.media.url} alt="" style={{ width: '100%', height: '100%', objectFit: projectionState.media.isBackgroundMode ? 'cover' : 'contain' }} />
            )}
          </div>
        )}
      </>
    )
  }

  // Render countdown content
  const renderCountdownContent = () => {
    if (!countdownState) return null
    const theme = countdownState.config.theme
    const textShadow = theme.textShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none'
    return (
      <>
        <div style={{
          position: 'absolute', inset: 0,
          background: theme.backgroundType === 'image' && theme.backgroundImageUrl
            ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
            : theme.backgroundType === 'color' || !theme.backgroundType ? theme.background : '#000',
          filter: `brightness(${1 - (theme.backgroundDarkness || 0)})`,
        }} />
        {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
          <video autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src={theme.backgroundVideoUrl} type="video/mp4" />
          </video>
        )}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})` }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: theme.fontFamily, color: theme.textColor,
          fontSize: `${canvas.height * 0.18}px`,
        }}>
          {countdownState.config.title && (
            <div style={{ fontSize: '0.25em', opacity: 0.8, marginBottom: '0.5em', textTransform: 'uppercase', letterSpacing: '4px', textShadow }}>
              {countdownState.config.title}
            </div>
          )}
          <div style={{ fontSize: '1em', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', textShadow }}>
            {formatTime(countdownState.remainingTime)}
          </div>
        </div>
      </>
    )
  }

  // Render preview content (countdown or slides)
  const renderPreviewContent = () => {
    if (isCountdownActive) {
      return renderCountdownContent()
    }
    return renderSlideContent()
  }

  return (
    <div className={`projection-preview ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      {/* Header */}
      <div className="projection-preview-header">
        <div className="preview-header-left">
          <span className="preview-label">Preview</span>
          {showSyncWarning && (
            <span className="preview-sync-warning" title="Preview may not be synchronized">⚠</span>
          )}
          {!isCollapsed && projectionState && projectionState.slides.length > 0 && (
            <span className="preview-slide-indicator">
              {projectionState.currentSlide + 1} / {projectionState.slides.length}
            </span>
          )}
        </div>
        <div className="preview-header-center">
          {!isCollapsed && projectionState?.songTitle && (
            <span className="preview-song-title">{projectionState.songTitle}</span>
          )}
        </div>
        <button 
          className="preview-collapse-toggle" 
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expand preview' : 'Collapse preview'}
        >
          {isCollapsed ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="projection-preview-content">
          {/* Canvas fijo escalado al tamaño del preview — idéntico a la proyección real */}
          <div className="projection-preview-viewport" style={{ position: 'relative', overflow: 'hidden',
            aspectRatio: `${canvas.width} / ${canvas.height}` }}>
            <div style={{
              position: 'absolute',
              width: canvas.width, height: canvas.height,
              top: '50%', left: '50%',
              transformOrigin: 'center center',
              // El scale se calcula via CSS usando container queries — usamos scale relativo al ancho del preview
              transform: `translate(-50%, -50%) scale(var(--preview-scale, 1))`,
            }}
              ref={el => {
                if (!el) return
                const ro = new ResizeObserver(() => {
                  const parent = el.parentElement
                  if (!parent) return
                  const s = Math.min(parent.clientWidth / canvas.width, parent.clientHeight / canvas.height)
                  el.style.setProperty('--preview-scale', String(s))
                  el.style.transform = `translate(-50%, -50%) scale(${s})`
                })
                ro.observe(el.parentElement!)
              }}
            >
              {renderPreviewContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ProjectionPreview)
