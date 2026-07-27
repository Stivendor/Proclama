import { useState, useEffect, useCallback, memo } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Tv2 } from 'lucide-react'
import { onMessage, openProjectionWindow } from '@/services/projection'
import { useProjectionStore, DEFAULT_THEME, CANVAS_SIZE, useAppStore } from '@/stores'
import { useCountdownStore } from '@/features/countdown'
import type { ProjectionState, BroadcastMessage, CountdownState } from '@/types'
import { calcCanvasFontSize } from '@/hooks/useProjectionFontSize'
import ProjectionBackground from '@/components/projection/ProjectionBackground'

const STORAGE_KEY = 'proclama-preview-collapsed'
const MEDIA_KEY = 'proclama-preview-media'

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

// Helper: Load media state from localStorage
const loadMediaState = (): boolean => {
  try {
    const stored = localStorage.getItem(MEDIA_KEY)
    return stored !== 'false'
  } catch (error) {
    return true // default to showing media
  }
}

// Helper: Save media state to localStorage
const saveMediaState = (show: boolean): void => {
  try {
    localStorage.setItem(MEDIA_KEY, String(show))
  } catch (error) {
    console.warn('Failed to persist media state')
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
  const { updateTheme, setHideText, state: projStore } = useProjectionStore(
    (s) => ({ updateTheme: s.updateTheme, setHideText: s.setHideText, state: s.state })
  )
  const theme = projStore.theme
  const {
    textColor = '#ffffff', fontFamily = 'Montserrat', textUppercase = true,
    textShadow: textShadowEnabled = true, transition = 'fade',
    verseReferencePosition = 'bottom', backgroundBlur = 0,
    backgroundOverlayOpacity = 0.3, showBibleVersion = true, fontScale = 1
  } = theme
  const hideText = projStore.hideText
  const [state, setState] = useState<PreviewState>({
    isCollapsed: loadCollapsedState(),
    projectionState: null,
    countdownState: null
  })

  const [showSyncWarning, setShowSyncWarning] = useState(false)
  const [showMedia, setShowMedia] = useState(loadMediaState)

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

  const toggleShowMedia = useCallback(() => {
    const newShowMedia = !showMedia
    setShowMedia(newShowMedia)
    saveMediaState(newShowMedia)
  }, [showMedia])

  const setProjectionWindow = useProjectionStore(s => s.setProjectionWindow)

  const handleOpenProjection = useCallback(() => {
    const w = openProjectionWindow()
    setProjectionWindow(w)
  }, [setProjectionWindow])

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

  const renderSlideContent = () => {
    if (!projectionState) {
      return (
        <div className="preview-empty-state">
          <div style={{ opacity: 0.3, fontSize: '2rem' }}></div>
        </div>
      )
    }

    const { slides, currentSlide, theme, songTitle, songArtist, isBible, hideText } = projectionState
    const slide = slides[currentSlide]

    const showTitle = !!(isBible && songTitle)
    const titleAtTop = showTitle && theme.verseReferencePosition !== 'bottom'
    const titleAtBottom = showTitle && theme.verseReferencePosition === 'bottom'

    const fontSize = slide ? calcCanvasFontSize(slide, theme, songTitle, !!isBible, titleAtTop, titleAtBottom) : 0
    const textShadow = theme.textShadow 
      ? '0 0 10px rgba(0,0,0,1), -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000, 2px 2px 0px #000' 
      : 'none'

    return (
      <>
        {showMedia && (
          <ProjectionBackground variant="preview" theme={theme} media={projectionState.media} />
        )}

        {slide ? (
          <div key={`${songTitle}-${currentSlide}`} style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: `${canvas.height * 0.07}px ${canvas.width * 0.08}px`,
            boxSizing: 'border-box', textAlign: 'center',
            fontFamily: theme.fontFamily, fontWeight: 900, color: theme.textColor,
            lineHeight: 1.15, textTransform: theme.textUppercase ? 'uppercase' : 'none',
            fontSize: `${fontSize}px`, wordBreak: 'break-word',
            opacity: hideText ? 0 : 1, transition: 'opacity 0.5s ease-in-out',
            animation: theme.transition === 'slide' ? 'slideUp 0.3s ease-out' : theme.transition === 'fade' ? 'fadeIn 0.4s ease' : 'none'
          }}>
            {titleAtTop && (
              <div style={{ opacity: 1, fontSize: '0.7em', marginBottom: '0.4em', textShadow }}>
                {songTitle}{isBible && theme.showBibleVersion && songArtist && ` (${songArtist})`}
              </div>
            )}
            <div style={{ textShadow }}>
              {slide.lines.map((line, i) => <div key={i}>{line}</div>)}
            </div>
            {titleAtBottom && (
              <div style={{ opacity: 1, fontSize: '0.7em', marginTop: '0.4em', textShadow }}>
                {songTitle}{isBible && theme.showBibleVersion && songArtist && ` (${songArtist})`}
              </div>
            )}
          </div>
        ) : (
          <div className="preview-empty-state">
            <div style={{ opacity: 0.3, fontSize: '2rem' }}></div>
          </div>
        )}
      </>
    )
  }

  // Render countdown content
  const renderCountdownContent = () => {
    if (!countdownState) return null
    const countdownTheme = countdownState.config.theme
    const mainTheme = projectionState?.theme || DEFAULT_THEME
    const textShadow = countdownTheme.textShadow ? '1px 1px 2px rgba(0,0,0,0.8)' : 'none'
    const bgFilter = `blur(${mainTheme.backgroundBlur || 0}px) brightness(${1 - ((mainTheme.backgroundOverlayOpacity ?? 0.3))})`

    return (
      <>
        <ProjectionBackground variant="preview" theme={mainTheme} media={null} filter={bgFilter} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: countdownTheme.fontFamily, color: countdownTheme.textColor,
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
          <button
            className={`preview-media-toggle ${showMedia ? 'active' : ''}`}
            onClick={toggleShowMedia}
            title={showMedia ? 'Ocultar fondo' : 'Mostrar fondo'}
            style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: showMedia ? 'var(--gold)' : 'transparent', color: showMedia ? '#000' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}
          >
            Fondo
          </button>
          {!isCollapsed && projectionState && projectionState.slides.length > 0 && (
            <span className="preview-slide-indicator">
              {projectionState.currentSlide + 1} / {projectionState.slides.length}
            </span>
          )}
        </div>
        <div className="preview-header-center">
          <button className="btn-projection" onClick={handleOpenProjection} title="Abrir ventana de proyección">
            <Tv2 size={16} />
            Abrir Proyección
          </button>
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

          <div className="preview-canvas-controls-left">
            <div className="preview-canvas-row">
              <label><span>Color de Texto</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => updateTheme({ textColor: e.target.value })}
                />
                <span className="preview-value-text">{textColor}</span>
              </div>
            </div>
            <div className="preview-canvas-row">
              <label><span>Fuente</span></label>
              <select
                value={fontFamily}
                onChange={(e) => updateTheme({ fontFamily: e.target.value })}
              >
                <option value="Montserrat">Montserrat</option>
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Georgia">Georgia</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Verdana">Verdana</option>
                <option value="Impact">Impact</option>
              </select>
            </div>
            <div className="preview-canvas-row">
              <label><span>Tamaño: </span>{Math.round(fontScale * 100)}%</label>
              <input
                type="range" min="0.1" max="1.0" step="0.05"
                value={fontScale}
                onChange={(e) => updateTheme({ fontScale: Number(e.target.value) })}
                style={{ width: '80px' }}
              />
            </div>
            <div className="preview-canvas-row">
              <label><span>Transición</span></label>
              <select
                value={transition}
                onChange={(e) => updateTheme({ transition: e.target.value as any })}
              >
                <option value="fade">Fade (suave)</option>
                <option value="slide">Slide</option>
                <option value="instant">Instant</option>
              </select>
            </div>
            <div className="preview-canvas-row">
              <label>Posición Cita</label>
              <div className="preview-canvas-btns">
                <button className={verseReferencePosition === 'top' ? 'active' : ''} onClick={() => updateTheme({ verseReferencePosition: 'top' as any })}>Arriba</button>
                <button className={verseReferencePosition === 'bottom' || !verseReferencePosition ? 'active' : ''} onClick={() => updateTheme({ verseReferencePosition: 'bottom' as any })}>Abajo</button>
              </div>
            </div>
            <div className="preview-canvas-row">
              <label>
                <input
                  type="checkbox"
                  checked={textShadowEnabled}
                  onChange={(e) => updateTheme({ textShadow: e.target.checked })}
                />
                Sombra en el texto
              </label>
            </div>
            <div className="preview-canvas-row">
              <label>
                <input
                  type="checkbox"
                  checked={textUppercase}
                  onChange={(e) => updateTheme({ textUppercase: e.target.checked })}
                />
                Texto en mayúsculas
              </label>
            </div>
            <div className="preview-canvas-row">
              <label>
                <input
                  type="checkbox"
                  checked={showBibleVersion}
                  onChange={(e) => updateTheme({ showBibleVersion: e.target.checked })}
                />
                Mostrar versión (Biblia)
              </label>
            </div>
          </div>
          <div className="preview-canvas-controls-right">
            <div className="preview-canvas-slider-group">
              <label><span>Blur: </span>{backgroundBlur}px</label>
              <input
                type="range" min="0" max="50"
                value={backgroundBlur}
                onChange={(e) => updateTheme({ backgroundBlur: Number(e.target.value) })}
              />
            </div>
            <div className="preview-canvas-slider-group">
              <label><span>Oscurecer: </span>{Math.round(backgroundOverlayOpacity * 100)}%</label>
              <input
                type="range" min="0" max="0.9" step="0.05"
                value={backgroundOverlayOpacity}
                onChange={(e) => updateTheme({ backgroundOverlayOpacity: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="preview-canvas-controls-extra">
            <button
              className={`preview-hide-text-btn ${hideText ? 'active' : ''}`}
              onClick={() => setHideText(!hideText)}
              title={hideText ? 'Mostrar Texto' : 'Ocultar Texto'}
            >
              {hideText ? <Eye size={18} /> : <EyeOff size={18} />}
              <span>{hideText ? 'Mostrar' : 'Ocultar'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(ProjectionPreview)
