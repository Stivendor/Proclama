import { memo, useState } from 'react'
import { Play, List, LayoutGrid, AlertTriangle, AlignJustify } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore, useProjectionStore } from '@/stores'
import ReportSongModal from '@/components/songs/ReportSongModal'

export const LiveSelection = memo(function LiveSelection() {
  const { slides, currentSlide, songTitle, goToSlide, hideText } = useProjectionStore(useShallow(s => ({
    slides: s.state.slides,
    currentSlide: s.state.currentSlide,
    songTitle: s.state.songTitle,
    goToSlide: s.goToSlide,
    hideText: s.state.hideText
  })))
  const { updateTheme, theme } = useProjectionStore(useShallow(s => ({
    updateTheme: s.updateTheme,
    theme: s.state.theme
  })))
  const { liveSlidesViewGrid, setLiveSlidesViewGrid } = useAppStore(useShallow(s => ({
    liveSlidesViewGrid: s.liveSlidesViewGrid,
    setLiveSlidesViewGrid: s.setLiveSlidesViewGrid
  })))

  const [isReportModalOpen, setIsReportModalOpen] = useState(false)

  if (!songTitle) {
    return (
      <div className="live-selection-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px', textAlign: 'center', padding: '24px' }}>
        <Play size={48} opacity={0.1} style={{ marginBottom: 12 }} />
        <h3 style={{ color: 'var(--text-primary)', fontSize: '18px', margin: 0 }}>Proyección inactiva</h3>
        <p style={{ fontSize: '14px', maxWidth: '300px' }}>Selecciona una canción para comenzar a proyectarla en vivo.</p>
      </div>
    )
  }

  return (
    <div className="live-selection">
      <div className="live-selection-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {songTitle}
          </h2>
          <div className="live-meta">Estrofas: {slides.length}</div>
        </div>
        <div className="live-selection-controls">
          <div className="view-toggle-group">
            <span className="control-label">Líneas:</span>
            {[2, 3, 4, 6].map((num) => (
              <button
                key={num}
                className={`toggle-icon-btn text-btn ${theme.linesPerSlide === num ? 'active' : ''}`}
                onClick={() => updateTheme({ linesPerSlide: num })}
              >
                {num}
              </button>
            ))}
            <button
              className={`toggle-icon-btn ${theme.linesPerSlide === 0 ? 'active' : ''}`}
              onClick={() => updateTheme({ linesPerSlide: 0 })}
              title="Original — respeta la separación de estrofas tal como están escritas, sin reorganizar"
            >
              <AlignJustify size={14} />
            </button>
          </div>

          <div className="view-toggle-group">
            <button 
              className={`toggle-icon-btn ${!liveSlidesViewGrid ? 'active' : ''}`}
              onClick={() => setLiveSlidesViewGrid(false)}
              title="Vista de lista (filas)"
            >
              <List size={16} />
            </button>
            <button 
              className={`toggle-icon-btn ${liveSlidesViewGrid ? 'active' : ''}`}
              onClick={() => setLiveSlidesViewGrid(true)}
              title="Vista de cuadrícula"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button 
            className="toggle-icon-btn report-btn"
            onClick={() => setIsReportModalOpen(true)}
            title="Reportar error en la canción"
          >
            <AlertTriangle size={16} />
          </button>
        </div>
      </div>

      <div className={`live-slides-grid ${!liveSlidesViewGrid ? 'as-list' : ''}`}>
        {slides.map((slide, i) => {
          const isActive = i === currentSlide;
          const isHiddenAndActive = isActive && hideText;
          
          return (
            <button
              key={i}
              className={`live-slide-card ${isActive ? 'active' : ''} ${isHiddenAndActive ? 'is-hidden-preview' : ''}`}
              onClick={() => goToSlide(i)}
              title={isHiddenAndActive ? "Presiona para mostrar el texto" : ""}
            >
              <span className="live-slide-number">{i + 1}</span>
              <div className="live-slide-content">
                {slide.lines.map((line, li) => (
                  <div key={li} className="live-slide-line">{line}</div>
                ))}
              </div>
              {slide.label && <span className="live-slide-label">{slide.label}</span>}
              {isHiddenAndActive && <div className="hidden-indicator-preview">OCULTO</div>}
            </button>
          );
        })}
      </div>

      <style>{`
        .live-selection {
           display: flex;
           flex-direction: column;
           flex: 1;
           height: 100%;
           min-height: 0;
           overflow: hidden;
        }
        .live-selection-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
          gap: 16px;
          background: var(--bg-surface);
        }
        .live-meta {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        .live-selection-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .view-toggle-group {
          display: flex;
          background: var(--bg-elevated);
          padding: 3px;
          border-radius: 8px;
          border: 1px solid var(--border);
          align-items: center;
          gap: 2px;
        }
        .control-label {
          font-size: 11px;
          color: var(--text-muted);
          padding: 0 6px 0 4px;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.5px;
        }
        .toggle-icon-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s;
        }
        .toggle-icon-btn.text-btn {
          font-size: 13px;
          font-weight: 600;
          width: 32px;
        }
        .toggle-icon-btn:hover {
          color: var(--text-primary);
        }
        .toggle-icon-btn.active {
          background: var(--bg-surface);
          color: var(--gold);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .report-btn {
          margin-left: 4px;
        }
        .report-btn:hover {
          color: var(--red);
          background: rgba(220, 38, 38, 0.1);
        }
        .live-slides-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          align-content: start;
        }
        .live-slides-grid::-webkit-scrollbar {
          width: 8px;
        }
        .live-slides-grid::-webkit-scrollbar-track {
          background: transparent;
        }
        .live-slides-grid::-webkit-scrollbar-thumb {
          background: var(--gold);
          border-radius: 4px;
        }
        .live-slides-grid.as-list {
          grid-template-columns: 1fr;
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
          min-height: 0;
        }
        .live-slide-card {
          position: relative;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .live-slide-card:hover {
          border-color: var(--border-light);
          transform: translateY(-2px);
          background: var(--bg-hover);
        }
        .live-slide-card.active {
          border-color: var(--gold);
          background: rgba(212, 168, 67, 0.08);
          box-shadow: 0 0 20px rgba(212, 168, 67, 0.15);
        }
        .live-slide-number {
          position: absolute;
          top: 10px;
          left: 12px;
          font-size: 10px;
          font-weight: 800;
          color: var(--text-muted);
          opacity: 0.5;
        }
        .live-slide-content {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .live-slide-line {
          font-family: 'Lora', Georgia, serif;
          font-size: 15px;
          color: var(--text-primary);
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .as-list .live-slide-line {
           white-space: normal;
           font-size: 16px;
        }
        .live-slide-label {
          position: absolute;
          bottom: 10px;
          right: 12px;
          font-size: 9px;
          font-weight: 700;
          color: var(--gold);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .live-slide-card.is-hidden-preview {
          opacity: 0.5;
          filter: grayscale(1);
          border-style: dashed;
        }
        .hidden-indicator-preview {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(220, 38, 38, 0.1);
          color: var(--red);
          font-weight: 900;
          font-size: 1.5rem;
          letter-spacing: 4px;
          pointer-events: none;
        }
      `}</style>
      <ReportSongModal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
      />
    </div>
  )
})
