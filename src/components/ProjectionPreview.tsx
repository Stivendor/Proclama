import { useState, useEffect, useCallback, memo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { onMessage } from '@/services/projection'
import { useProjectionStore, DEFAULT_THEME } from '@/stores'
import { useCountdownStore } from '@/stores/countdown'
import type { ProjectionState, BroadcastMessage, CountdownState } from '@/types'

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

  // Helper: Format countdown time as MM:SS
  const formatTime = (totalSeconds: number): string => {
    const clamped = Math.max(0, Math.floor(totalSeconds))
    const m = Math.floor(clamped / 60)
    const s = clamped % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Render slide content
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

    const showTitle = (theme.showTitle || isBible) && songTitle
    const titleAtTop = showTitle && (isBible ? (theme.verseReferencePosition !== 'bottom') : (theme.titlePosition === 'top'))
    const titleAtBottom = showTitle && (isBible ? (theme.verseReferencePosition === 'bottom') : (theme.titlePosition === 'bottom'))

    const textShadow = theme.textShadow
      ? '1px 1px 2px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.6)'
      : 'none'

    return (
      <>
        {/* Background */}
        <div 
          className="preview-background"
          style={{
            position: 'absolute',
            inset: 0,
            background: theme.backgroundType === 'image' && theme.backgroundImageUrl
              ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
              : theme.backgroundType === 'color' || !theme.backgroundType
                ? theme.background
                : '#000',
            filter: `blur(${(theme.backgroundBlur || 0) * 0.5}px) brightness(${1 - (theme.backgroundDarkness || 0)})`,
            transform: theme.backgroundBlur ? 'scale(1.05)' : 'scale(1)'
          }}
        />

        {/* Background Video */}
        {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: `blur(${(theme.backgroundBlur || 0) * 0.5}px) brightness(${1 - (theme.backgroundDarkness || 0)})`,
              transform: theme.backgroundBlur ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            <source src={theme.backgroundVideoUrl} type="video/mp4" />
          </video>
        )}

        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})`
          }}
        />

        {/* Text Content */}
        {!hideText && (
          <div
            className="preview-text-content"
            style={{
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8%',
              height: '100%',
              fontFamily: theme.fontFamily,
              color: theme.textColor,
              textAlign: 'center',
              fontSize: '0.7rem',
              lineHeight: 1.3,
              textTransform: theme.textUppercase ? 'uppercase' : 'none'
            }}
          >
            {titleAtTop && (
              <div
                style={{
                  opacity: isBible ? 1 : 0.7,
                  fontSize: isBible ? '1em' : '0.35em',
                  marginBottom: '0.3em',
                  letterSpacing: isBible ? '0' : '2px',
                  fontWeight: 700,
                  textShadow
                }}
              >
                {songTitle}
              </div>
            )}

            {theme.showVerseLabel && slide.label && (
              <div
                style={{
                  fontSize: '0.4em',
                  opacity: 0.6,
                  marginBottom: '0.2em',
                  textShadow
                }}
              >
                {slide.label}
              </div>
            )}

            <div style={{ textShadow, wordBreak: 'break-word' }}>
              {slide.lines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>

            {titleAtBottom && (
              <div
                style={{
                  opacity: isBible ? 1 : 0.7,
                  fontSize: isBible ? '1em' : '0.35em',
                  marginTop: '0.3em',
                  letterSpacing: isBible ? '0' : '2px',
                  fontWeight: 700,
                  textShadow
                }}
              >
                {songTitle}
              </div>
            )}
          </div>
        )}

        {/* Media Content */}
        {projectionState.media && (
          <div
            className="preview-media-layer"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: projectionState.media.isBackgroundMode ? 2 : 20,
              background: projectionState.media.isBackgroundMode ? 'transparent' : '#000'
            }}
          >
            {projectionState.media.type === 'video' ? (
              <video
                autoPlay
                muted
                loop
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: projectionState.media.isBackgroundMode ? 'cover' : 'contain'
                }}
                onError={(e) => {
                  console.warn('Failed to load preview media:', projectionState.media?.url)
                  e.currentTarget.style.display = 'none'
                }}
              >
                <source src={projectionState.media.url} type="video/mp4" />
              </video>
            ) : (
              <img
                src={projectionState.media.url}
                alt="Preview media"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: projectionState.media.isBackgroundMode ? 'cover' : 'contain'
                }}
                onError={(e) => {
                  console.warn('Failed to load preview media:', projectionState.media?.url)
                  e.currentTarget.style.display = 'none'
                }}
              />
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
    const textShadow = theme.textShadow
      ? '1px 1px 2px rgba(0,0,0,0.8), 0 0 5px rgba(0,0,0,0.6)'
      : 'none'

    return (
      <>
        {/* Background */}
        <div
          className="preview-background"
          style={{
            position: 'absolute',
            inset: 0,
            background: theme.backgroundType === 'image' && theme.backgroundImageUrl
              ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
              : theme.backgroundType === 'color' || !theme.backgroundType
                ? theme.background
                : '#000',
            filter: `blur(${(theme.backgroundBlur || 0) * 0.5}px) brightness(${1 - (theme.backgroundDarkness || 0)})`,
            transform: theme.backgroundBlur ? 'scale(1.05)' : 'scale(1)'
          }}
        />

        {/* Background Video */}
        {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
          <video
            autoPlay
            muted
            loop
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: `blur(${(theme.backgroundBlur || 0) * 0.5}px) brightness(${1 - (theme.backgroundDarkness || 0)})`,
              transform: theme.backgroundBlur ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            <source src={theme.backgroundVideoUrl} type="video/mp4" />
          </video>
        )}

        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})`
          }}
        />

        {/* Countdown Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: theme.fontFamily,
            color: theme.textColor
          }}
        >
          {countdownState.config.title && (
            <div
              style={{
                fontSize: '0.5rem',
                opacity: 0.8,
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                textShadow
              }}
            >
              {countdownState.config.title}
            </div>
          )}
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              fontVariantNumeric: 'tabular-nums',
              textShadow
            }}
          >
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
          <div className="projection-preview-viewport">
            {renderPreviewContent()}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ProjectionPreview)
