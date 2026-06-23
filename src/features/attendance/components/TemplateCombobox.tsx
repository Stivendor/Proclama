import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'

interface TemplateComboboxProps {
  id?: string
  value: string
  onChange: (value: string) => void
  templates: string[]
  onAddTemplate: (value: string) => void
  onDeleteTemplate: (value: string) => void
  placeholder?: string
  error?: string
  onClearError?: () => void
  onEnter?: () => void
}

/** Combobox "elegir o crear": escribe o elige de la lista; añade/quita nombres ahí mismo. */
export default function TemplateCombobox({
  id, value, onChange, templates, onAddTemplate, onDeleteTemplate,
  placeholder, error, onClearError, onEnter,
}: TemplateComboboxProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = value.trim().toLowerCase()
  const filtered = q ? templates.filter(t => t.toLowerCase().includes(q)) : templates
  const exactMatch = templates.some(t => t.toLowerCase() === q)
  const canAdd = !!value.trim() && !exactMatch

  function pick(name: string) { onChange(name); setOpen(false) }
  function addNew() {
    const t = value.trim()
    if (!t) return
    if (!exactMatch) onAddTemplate(t)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className={`input${error ? ' input--error' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); onClearError?.(); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (onEnter) onEnter()
              else if (canAdd) addNew()
              else setOpen(false)
            } else if (e.key === 'Escape') setOpen(false)
          }}
          style={{ width: '100%', paddingRight: 36 }}
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label="Mostrar opciones"
          tabIndex={-1}
          style={{
            position: 'absolute', right: 1, top: 1, bottom: 1, width: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', color: 'var(--text-secondary)',
          }}
        >
          <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
      </div>

      {open && (filtered.length > 0 || canAdd) && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)', maxHeight: 220, overflowY: 'auto', padding: 4,
        }}>
          {filtered.map(t => {
            const selected = t === value
            return (
              <div
                key={t}
                onClick={() => pick(t)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
                  background: selected ? 'rgba(212,168,67,0.12)' : 'transparent',
                  color: selected ? 'var(--gold)' : 'var(--text-primary)',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{t}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${t}`}
                  title="Quitar de la lista"
                  onClick={e => { e.stopPropagation(); onDeleteTemplate(t); if (value === t) onChange('') }}
                  style={{ opacity: 0.5, display: 'flex', color: 'inherit', padding: 2 }}
                >
                  <X size={13} />
                </button>
              </div>
            )
          })}

          {canAdd && (
            <div
              onClick={addNew}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6,
                cursor: 'pointer', fontSize: 13, color: 'var(--gold)',
                borderTop: filtered.length ? '1px solid var(--border)' : 'none', marginTop: filtered.length ? 4 : 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <Plus size={14} /> Añadir «{value.trim()}»
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="field-error" role="alert" aria-live="polite" style={{ margin: '6px 0 0' }}>{error}</p>
      )}
    </div>
  )
}
