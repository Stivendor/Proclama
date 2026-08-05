import { Keyboard, X } from 'lucide-react'

/** Mantener sincronizado con el switch de src/hooks/useKeyboardShortcuts.ts */
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Navegación',
    items: [
      ['Alt + 1…8', 'Ir a Canciones, Setlists, Biblia, Temporizador, Avisos, Notas, Fondos, Ajustes'],
      ['Alt + N', 'Nueva canción'],
      ['?', 'Mostrar u ocultar esta lista'],
    ],
  },
  {
    title: 'Proyección',
    items: [
      ['Alt + P', 'Abrir la ventana de proyección'],
      ['→ ↓ Espacio PageDown', 'Slide siguiente'],
      ['← ↑ PageUp', 'Slide anterior'],
      ['Alt + B', 'Ocultar el texto (funciona en todas las vistas)'],
      ['T', 'Ocultar el texto (no aplica en la Biblia)'],
      ['Esc', 'Volver a mostrar el texto'],
    ],
  },
  {
    title: 'Biblia',
    items: [
      ['→ Espacio PageDown', 'Proyectar el versículo siguiente'],
      ['← PageUp', 'Proyectar el versículo anterior'],
      ['Cualquier letra', 'Abrir la búsqueda rápida de pasaje'],
    ],
  },
]

export default function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal shortcuts-modal" onClick={e => e.stopPropagation()}>
        <div className="shortcuts-header">
          <h2><Keyboard size={18} /> Atajos de teclado</h2>
          <button className="btn-icon" onClick={onClose} title="Cerrar"><X size={16} /></button>
        </div>
        <div className="shortcuts-body">
          {GROUPS.map(group => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.items.map(([keys, description]) => (
                  <div key={keys} className="shortcuts-row">
                    <dt><kbd>{keys}</kbd></dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="shortcuts-foot">Los atajos no actúan mientras escribes en un campo de texto.</p>
      </div>
      <style>{`
        .shortcuts-modal { max-width: 560px; width: 100%; }
        .shortcuts-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .shortcuts-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; }
        .shortcuts-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 18px; max-height: 60vh; overflow-y: auto; }
        .shortcuts-body h3 { margin: 0 0 8px; font-size: 11px; letter-spacing: 1px; color: var(--text-muted); text-transform: uppercase; }
        .shortcuts-body dl { margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .shortcuts-row { display: flex; align-items: baseline; gap: 12px; }
        .shortcuts-row dt { flex: 0 0 190px; }
        .shortcuts-row dd { margin: 0; font-size: 13px; color: var(--text-muted); }
        .shortcuts-modal kbd {
          font-family: inherit; font-size: 11px; font-weight: 600;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: 6px; padding: 3px 8px; white-space: nowrap;
        }
        .shortcuts-foot { margin: 0; padding: 12px 20px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-muted); }
      `}</style>
    </div>
  )
}
