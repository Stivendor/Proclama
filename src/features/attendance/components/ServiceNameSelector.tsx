import { Plus, X } from 'lucide-react'

interface ServiceNameSelectorProps {
  serviceName: string
  setServiceName: (name: string) => void
  serviceNameTemplates: string[]
  onAddTemplate: (name: string) => void
  onDeleteTemplate: (name: string) => void
  onEnter: () => void
  error?: string
  onClearError?: () => void
}

export default function ServiceNameSelector({
  serviceName,
  setServiceName,
  serviceNameTemplates,
  onAddTemplate,
  onDeleteTemplate,
  onEnter,
  error,
  onClearError
}: ServiceNameSelectorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="service-name-manual"
          type="text"
          className={`input${error ? ' input--error' : ''}`}
          placeholder="Nombre del culto..."
          value={serviceName}
          onChange={e => {
            setServiceName(e.target.value)
            onClearError?.()
          }}
          onKeyDown={e => e.key === 'Enter' && onEnter()}
          style={{ flex: 1 }}
        />
        <button
          className="btn-ghost"
          onClick={() => {
            const trimmed = serviceName.trim()
            if (trimmed && !serviceNameTemplates.includes(trimmed)) {
              onAddTemplate(trimmed)
            }
          }}
          disabled={!serviceName.trim() || serviceNameTemplates.includes(serviceName.trim())}
          title="Guardar etiqueta"
          style={{ 
            height: '38px', 
            width: '38px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {serviceNameTemplates.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {serviceNameTemplates.map(template => (
            <div
              key={template}
              onClick={() => { setServiceName(template); onClearError?.() }}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                background: serviceName === template ? 'rgba(212, 168, 67, 0.15)' : 'var(--bg-elevated)',
                color: serviceName === template ? 'var(--gold)' : 'var(--text-secondary)',
                border: `1px solid ${serviceName === template ? 'var(--gold)' : 'var(--border)'}`,
                transition: 'all 0.1s ease',
              }}
            >
              {template}
              <button
                style={{
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.5,
                  color: 'inherit'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteTemplate(template)
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="field-error" role="alert" aria-live="polite" style={{ margin: 0 }}>{error}</p>
      )}
    </div>
  )
}
