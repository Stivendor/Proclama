import { useState, useEffect, useRef, forwardRef } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useAppStore } from '@/stores'

// ─── Tour steps ───────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    selector: '[data-tour="new-song"]',
    title: 'Crea tu primera canción',
    desc: 'Haz clic aquí para agregar una canción nueva. Escribe la letra separando estrofas con una línea en blanco.',
    position: 'bottom' as const,
  },
  {
    selector: '.btn-projection',
    title: 'Abre la proyección',
    desc: 'Esto abre una segunda ventana para tu proyector o pantalla. Arrástrala a la pantalla que quieras.',
    position: 'right' as const,
  },
  {
    selector: '.nav-item[aria-current="page"], .nav-item:first-of-type',
    title: 'Navega entre secciones',
    desc: 'Biblioteca, Setlists, Biblia y Ajustes. Cada sección tiene su función en el servicio.',
    position: 'right' as const,
  },
  {
    selector: '.right-panel',
    title: 'Fondos y anuncios',
    desc: 'Tu galería de medios: sube imágenes y videos, organízalos en carpetas y fija fondos de letra para proyectarlos detrás de las canciones y versículos.',
    position: 'left' as const,
  },
] as const

type Position = 'right' | 'left' | 'top' | 'bottom'

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tooltip = forwardRef<HTMLDivElement, {
  step: number
  total: number
  title: string
  desc: string
  position: Position
  targetRect: TargetRect
  isLast: boolean
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}>(({ step, total, title, desc, position, targetRect, isLast, onNext, onPrev, onSkip }, ref) => {
  const GAP = 16
  const TIP_W = 280
  const TIP_H = 180

  let top = 0
  let left = 0

  if (position === 'right') {
    left = targetRect.left + targetRect.width + GAP
    top = targetRect.top + targetRect.height / 2 - TIP_H / 2
  } else if (position === 'left') {
    left = targetRect.left - TIP_W - GAP
    top = targetRect.top + targetRect.height / 2 - TIP_H / 2
  } else if (position === 'bottom') {
    top = targetRect.top + targetRect.height + GAP
    left = targetRect.left + targetRect.width / 2 - TIP_W / 2
  } else {
    top = targetRect.top - TIP_H - GAP
    left = targetRect.left + targetRect.width / 2 - TIP_W / 2
  }

  // Clamp to viewport
  const vw = window.innerWidth
  const vh = window.innerHeight
  top = Math.max(12, Math.min(top, vh - TIP_H - 12))
  left = Math.max(12, Math.min(left, vw - TIP_W - 12))

  return (
    <div
      ref={ref}
      className={`ob-tooltip pos-${position}`}
      role="dialog"
      aria-modal="false"
      aria-label={`Paso ${step + 1} de ${total}: ${title}`}
      tabIndex={-1}
      style={{ top, left }}
    >
      <div className="ob-tooltip-step">Paso {step + 1} de {total}</div>
      <div className="ob-tooltip-title">{title}</div>
      <p className="ob-tooltip-desc">{desc}</p>

      <div className="ob-tooltip-footer">
        <div className="ob-dots" aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`ob-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>

        <div className="ob-tooltip-actions">
          <button className="ob-skip" onClick={onSkip} aria-label="Saltar tour" style={{ display: 'none' }}>
            Saltar
          </button>
          <button
            className="ob-btn-nav"
            onClick={onPrev}
            disabled={step === 0}
            aria-label="Paso anterior"
          >
            <ChevronLeft size={14} />
          </button>
          {isLast ? (
            <button className="ob-btn-finish" onClick={onNext} aria-label="Finalizar tour">
              Listo <X size={12} />
            </button>
          ) : (
            <button
              className="ob-btn-nav ob-btn-next"
              onClick={onNext}
              aria-label="Siguiente paso"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

Tooltip.displayName = 'Tooltip'

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingFlow() {
  const { setOnboardingDone } = useAppStore()
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const current = TOUR_STEPS[step]
  const isLast = step === TOUR_STEPS.length - 1

  // Measure target element
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(current.selector) as HTMLElement | null
      if (!el) { setTargetRect(null); return }
      const r = el.getBoundingClientRect()
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step, current.selector])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return // no se puede saltar
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLast) setOnboardingDone(true)
        else setStep(s => s + 1)
      } else if (e.key === 'ArrowLeft' && step > 0) {
        setStep(s => s - 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [step, isLast, setOnboardingDone])

  // Focus tooltip on step change
  useEffect(() => {
    tooltipRef.current?.focus()
  }, [step])

  const finish = () => setOnboardingDone(true)
  const next = () => (isLast ? finish() : setStep(s => s + 1))
  const prev = () => setStep(s => s - 1)

  return (
    <>
      {/* Dim overlay — sin onClick para forzar completar el tour */}
      <div className="ob-overlay" aria-hidden="true" />

      {/* Spotlight */}
      {targetRect && (
        <div
          className="ob-spotlight"
          aria-hidden="true"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Tooltip anchored to target */}
      {targetRect && (
        <Tooltip
          ref={tooltipRef}
          step={step}
          total={TOUR_STEPS.length}
          title={current.title}
          desc={current.desc}
          position={current.position}
          targetRect={targetRect}
          isLast={isLast}
          onNext={next}
          onPrev={prev}
          onSkip={finish}
        />
      )}

      {/* Fallback when target element not found */}
      {!targetRect && (
        <div className="ob-fallback" role="dialog" aria-modal="true" aria-label="Tour de bienvenida">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            {current.title} — {current.desc}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-primary" onClick={next}>{isLast ? 'Finalizar' : 'Siguiente'}</button>
          </div>
        </div>
      )}

      <style>{`
        .ob-overlay {
          position: fixed; inset: 0; z-index: 900;
          background: rgba(6, 8, 16, 0.72);
          pointer-events: all;
          animation: ob-fade 0.3s ease;
        }
        @keyframes ob-fade { from { opacity: 0 } to { opacity: 1 } }

        .ob-spotlight {
          position: fixed; z-index: 901;
          border-radius: 10px;
          box-shadow:
            0 0 0 4px var(--gold),
            0 0 0 9999px rgba(6, 8, 16, 0.72);
          pointer-events: none;
          transition:
            top 0.3s cubic-bezier(0.16,1,0.3,1),
            left 0.3s cubic-bezier(0.16,1,0.3,1),
            width 0.3s cubic-bezier(0.16,1,0.3,1),
            height 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        .ob-tooltip {
          position: fixed; z-index: 902;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 18px 20px;
          width: 280px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
          animation: ob-tooltip-in 0.25s cubic-bezier(0.16,1,0.3,1);
          outline: none;
        }
        @keyframes ob-tooltip-in {
          from { opacity: 0; transform: translateY(6px) scale(0.97) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }

        .ob-tooltip::before {
          content: '';
          position: absolute;
          width: 10px; height: 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          transform: rotate(45deg);
        }
        .ob-tooltip.pos-right::before  { left: -6px; top: 20px; border-right: none; border-top: none; }
        .ob-tooltip.pos-left::before   { right: -6px; top: 20px; border-left: none; border-bottom: none; }
        .ob-tooltip.pos-bottom::before { top: -6px; left: 20px; border-bottom: none; border-right: none; }
        .ob-tooltip.pos-top::before    { bottom: -6px; left: 20px; border-top: none; border-left: none; }

        .ob-tooltip-step {
          font-size: 11px; font-weight: 600; color: var(--gold);
          text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;
        }
        .ob-tooltip-title {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px; line-height: 1.3;
        }
        .ob-tooltip-desc {
          font-size: 13px; color: var(--text-secondary);
          line-height: 1.55; margin-bottom: 16px;
        }
        .ob-tooltip-footer {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .ob-dots { display: flex; gap: 7px; align-items: center; }
        /* El activo se estira con scaleX en vez de animar width (sin layout thrash);
           el gap de 7px deja sitio para que la pastilla crezca sin tocar al vecino. */
        .ob-dot {
          width: 6px; height: 6px; border-radius: 3px;
          background: var(--border);
          transition: background 0.2s, transform 0.2s;
        }
        .ob-dot.active { background: var(--gold); transform: scaleX(2.667); }
        .ob-tooltip-actions { display: flex; gap: 6px; align-items: center; }

        .ob-btn-nav {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--bg-elevated); border: 1px solid var(--border);
          color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
        }
        .ob-btn-nav:hover { background: var(--bg-hover); color: var(--text-primary); }
        .ob-btn-nav:disabled { opacity: 0.3; cursor: not-allowed; }
        .ob-btn-nav:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
        .ob-btn-next { background: var(--bg-elevated); color: var(--gold); border-color: var(--gold); }

        .ob-btn-finish {
          display: flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 8px;
          background: var(--gold); color: #0d1117;
          font-size: 12px; font-weight: 700; cursor: pointer;
          border: none; transition: opacity 0.15s;
        }
        .ob-btn-finish:hover { opacity: 0.88; }
        .ob-btn-finish:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

        .ob-skip {
          font-size: 11px; color: var(--text-muted); cursor: pointer;
          background: none; border: none; padding: 4px;
          transition: color 0.15s;
        }
        .ob-skip:hover { color: var(--text-secondary); }

        .ob-fallback {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
          z-index: 902; background: var(--bg-surface);
          border: 1px solid var(--border); border-radius: 12px;
          padding: 16px 20px; width: 340px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }

        @media (prefers-reduced-motion: reduce) {
          .ob-overlay, .ob-spotlight, .ob-tooltip { animation: none; transition: none; }
        }
      `}</style>
    </>
  )
}
