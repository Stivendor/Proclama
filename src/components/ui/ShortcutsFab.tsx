import { useAppStore } from '@/stores'

/**
 * Botón flotante que abre la lista de atajos. Existe porque la tecla `?` no la
 * descubre nadie: el operador tiene que ver que los atajos están ahí.
 */
export default function ShortcutsFab() {
  const setShortcutsOpen = useAppStore(s => s.setShortcutsOpen)

  return (
    <>
      <button
        className="shortcuts-fab"
        onClick={() => setShortcutsOpen(true)}
        title="Atajos de teclado (tecla ?)"
        aria-label="Ver atajos de teclado"
      >
        ?
      </button>
      <style>{`
        .shortcuts-fab {
          position: absolute;
          right: 20px;
          bottom: 20px;
          z-index: 50;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--bg-elevated);
          color: var(--text-muted);
          font-size: 17px;
          font-weight: 700;
          line-height: 1;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
          transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .shortcuts-fab:hover {
          color: var(--gold);
          border-color: var(--gold);
          transform: translateY(-1px);
        }
        .shortcuts-fab:focus-visible {
          outline: 2px solid var(--gold);
          outline-offset: 2px;
        }
      `}</style>
    </>
  )
}
