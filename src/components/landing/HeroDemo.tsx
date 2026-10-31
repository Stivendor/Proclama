import { useEffect, useRef, useState } from 'react'
import { t } from '@/i18n'

// Demo del hero: el gesto que el operador repite cada domingo. A la izquierda
// su ventana con las estrofas; a la derecha lo que ve la congregación. Un
// cursor avanza estrofa por estrofa hasta que el visitante hace clic: desde ese
// momento la demo es suya y el autoplay no vuelve.
// La letra es "Santo, Santo, Santo" (trad. Juan B. Cabrera / R. Heber), de
// dominio público: nada de letras con derechos en la página comercial.

const VERSES = 4
const STEP_MS = 3400
const FIRST_STEP_MS = 1800

type Cursor = { x: number; y: number; press: boolean }

export default function HeroDemo({ language }: { language: 'es' | 'en' }) {
  const verses = Array.from({ length: VERSES }, (_, i) => t(language, `landing.demo.v${i + 1}`))
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  const [cursor, setCursor] = useState<Cursor | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeRef = useRef(0)

  useEffect(() => {
    const root = rootRef.current
    if (!auto || !root) return
    // Autoplay no esencial: con movimiento reducido la demo queda quieta y clicable.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let timers: number[] = []
    let running = false
    let inView = false

    const pointAt = (i: number, press: boolean) => {
      const card = cardRefs.current[i]
      const body = bodyRef.current
      if (!card || !body) return
      const c = card.getBoundingClientRect()
      const b = body.getBoundingClientRect()
      setCursor({ x: c.left - b.left + c.width * 0.72, y: c.top - b.top + c.height * 0.62, press })
    }

    const step = () => {
      const next = (activeRef.current + 1) % VERSES
      pointAt(next, false)
      timers.push(window.setTimeout(() => setCursor((p) => p && { ...p, press: true }), 650))
      timers.push(window.setTimeout(() => {
        activeRef.current = next
        setActive(next)
        setCursor((p) => p && { ...p, press: false })
      }, 790))
      timers.push(window.setTimeout(step, STEP_MS))
    }

    const start = () => {
      if (running) return
      running = true
      pointAt(activeRef.current, false)
      timers.push(window.setTimeout(step, FIRST_STEP_MS))
    }
    const stop = () => {
      running = false
      timers.forEach(clearTimeout)
      timers = []
    }
    const sync = () => (inView && !document.hidden ? start() : stop())

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      sync()
    }, { threshold: 0.35 })
    io.observe(root)
    document.addEventListener('visibilitychange', sync)

    return () => {
      stop()
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [auto])

  const choose = (i: number) => {
    setAuto(false)
    setCursor(null)
    activeRef.current = i
    setActive(i)
  }

  return (
    <div className="lp-demo" ref={rootRef}>
      <div className="lp-window lp-demo-operator">
        <div className="lp-window-bar">
          <span className="lp-window-title">{t(language, 'landing.dual.operator')}</span>
        </div>
        <div className="lp-demo-body" ref={bodyRef}>
          <div className="lp-demo-song">
            <strong>{t(language, 'landing.demo.song')}</strong>
            <span>{t(language, 'landing.demo.meta')}</span>
          </div>
          <div className="lp-demo-verses">
            {verses.map((v, i) => (
              <button
                key={i}
                ref={(el) => { cardRefs.current[i] = el }}
                className={i === active ? 'is-active' : undefined}
                aria-pressed={i === active}
                onClick={() => choose(i)}
              >
                <span className="lp-demo-num">{i + 1}</span>
                <span className="lp-demo-lines">{v.split('\n').slice(0, 3).join('\n')}</span>
              </button>
            ))}
          </div>
          <p className="lp-demo-hint">{t(language, 'landing.demo.hint')}</p>
          {cursor && (
            <svg
              className={`lp-demo-cursor${cursor.press ? ' is-press' : ''}`}
              style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
              width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"
            >
              <path d="M3 2l13 7.2-5.6 1.4L7.6 16z" fill="#f2f4f7" stroke="#08090b" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      <div className="lp-window lp-demo-audience">
        <div className="lp-window-bar">
          <span className="lp-window-title">{t(language, 'landing.dual.audience')}</span>
          <span className="lp-demo-live">{t(language, 'landing.demo.live')}</span>
        </div>
        <div className="lp-stage lp-demo-stage">
          {verses.map((v, i) => (
            <p key={i} className={i === active ? 'is-on' : undefined} aria-hidden={i !== active}>{v}</p>
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .lp-demo {
          display: grid;
          grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
          gap: 20px;
          align-items: stretch;
          text-align: left;
        }
        /* La ventana del operador ocupa la misma altura que la proyección. */
        .lp-demo-operator { display: flex; flex-direction: column; }
        .lp-demo-body { position: relative; flex: 1; display: flex; flex-direction: column; padding: 18px; }
        .lp-demo-song { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .lp-demo-song strong { font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: var(--fg); }
        .lp-demo-song span { font-size: 12px; color: var(--fg-2); }
        .lp-demo-verses { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; gap: 8px; }
        .lp-demo-verses button {
          display: flex; gap: 10px; align-items: flex-start;
          min-height: 64px; padding: 10px 12px;
          border: 1px solid var(--line); border-radius: 8px;
          background: var(--raised); color: var(--fg-2);
          font-family: inherit; text-align: left; cursor: pointer;
          transition: border-color .15s ease, background-color .15s ease, color .15s ease;
        }
        .lp-demo-verses button:hover { border-color: var(--line-2); color: var(--fg); }
        .lp-demo-verses button.is-active {
          border-color: var(--accent);
          background: rgba(201,166,88,0.08);
          color: var(--fg);
        }
        .lp-demo-num { flex: 0 0 auto; font-size: 11px; font-weight: 600; line-height: 1.6; color: var(--fg-2); font-variant-numeric: tabular-nums; }
        .is-active .lp-demo-num { color: var(--accent); }
        .lp-demo-lines {
          font-size: 12px; line-height: 1.5; white-space: pre-line;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .lp-demo-hint { margin: 12px 0 0; font-size: 12px; color: var(--fg-2); }
        .lp-demo-cursor {
          position: absolute; top: 0; left: 0; z-index: 3;
          pointer-events: none;
          transition: transform .6s cubic-bezier(0.16, 1, 0.3, 1);
          filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));
        }
        .lp-demo-cursor path { transform-origin: 3px 2px; transition: transform .12s ease-out; }
        .lp-demo-cursor.is-press path { transform: scale(0.82); }

        .lp-demo-live { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--fg-2); }
        .lp-demo-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #e05555; }

        /* El lienzo escala con su ancho, igual que la proyección real
           (lienzo fijo + transform): el texto nunca se desborda. */
        .lp-demo-stage {
          position: relative;
          container-type: inline-size;
          background: linear-gradient(180deg, #0c0e13 0%, #000 100%);
        }
        .lp-demo-stage p {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          margin: 0; padding: 0 7cqi;
          font-size: 3.7cqi; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em;
          text-align: center; white-space: pre-line; color: #fff;
          text-shadow: 0 2px 14px rgba(0,0,0,0.6);
          opacity: 0;
          transition: opacity .45s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-demo-stage p.is-on { opacity: 1; }

        @media (max-width: 820px) {
          .lp-demo { grid-template-columns: minmax(0, 1fr); gap: 12px; }
          .lp-demo-audience { order: -1; }
          .lp-demo-cursor { display: none; }
          .lp-demo-verses button { min-height: 72px; }
        }
      ` }} />
    </div>
  )
}
