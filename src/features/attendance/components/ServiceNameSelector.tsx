import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, X, Tag, Plus } from 'lucide-react'

interface ServiceNameSelectorProps {
  serviceName: string
  setServiceName: (name: string) => void
  serviceNameTemplates: string[]
  onAddTemplate: (name: string) => void
  onDeleteTemplate: (name: string) => void
  onEnter?: () => void
}

export default function ServiceNameSelector({
  serviceName,
  setServiceName,
  serviceNameTemplates,
  onAddTemplate,
  onDeleteTemplate,
  onEnter,
}: ServiceNameSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="service-name-combo" ref={dropdownRef}>
      <div
        className={`service-name-selector${showDropdown ? ' open' : ''}`}
        onClick={() => setShowDropdown(v => !v)}
      >
        <span className={serviceName ? 'service-name-value' : 'service-name-placeholder'}>
          {serviceName || 'Seleccionar o escribir nombre...'}
        </span>
        <ChevronDown size={14} className={`service-chevron${showDropdown ? ' rotated' : ''}`} />
      </div>
      
      {showDropdown && (
        <div className="service-name-dropdown">
          {/* Saved templates */}
          {serviceNameTemplates.length > 0 && (
            <>
              <div className="service-dropdown-section-label">Plantillas guardadas</div>
              {serviceNameTemplates.map((tpl, idx) => (
                <div key={idx} className={`service-name-option-row${serviceName === tpl ? ' selected' : ''}`}>
                  <button
                    className="service-name-option-btn"
                    onClick={() => {
                      setServiceName(tpl)
                      setShowDropdown(false)
                    }}
                  >
                    {tpl}
                    {serviceName === tpl && <Check size={13} />}
                  </button>
                  <button
                    className="btn-icon service-name-option-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteTemplate(tpl)
                      if (serviceName === tpl) setServiceName('')
                    }}
                    title="Eliminar plantilla"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="service-name-divider" />
            </>
          )}

          {/* Add new template */}
          <div className="service-dropdown-section-label">
            <Tag size={11} />
            Añadir plantilla
          </div>
          <div className="service-name-add-row">
            <input
              type="text"
              className="input"
              placeholder="Ej. Culto Dominical..."
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newTemplateName.trim()) {
                  const name = newTemplateName.trim()
                  if (!serviceNameTemplates.includes(name)) {
                    onAddTemplate(name)
                    setServiceName(name)
                  }
                  setNewTemplateName('')
                  setShowDropdown(false)
                }
              }}
              onClick={e => e.stopPropagation()}
            />
            <button
              className="btn-icon"
              disabled={!newTemplateName.trim() || serviceNameTemplates.includes(newTemplateName.trim())}
              onClick={(e) => {
                e.stopPropagation()
                const name = newTemplateName.trim()
                if (name && !serviceNameTemplates.includes(name)) {
                  onAddTemplate(name)
                  setServiceName(name)
                }
                setNewTemplateName('')
                setShowDropdown(false)
              }}
              title="Guardar como plantilla"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="service-name-divider" />

          {/* Manual one-off name */}
          <div className="service-dropdown-section-label">Nombre manual (sin guardar)</div>
          <div className="service-name-manual">
            <input
              id="service-name-manual"
              type="text"
              className="input"
              placeholder="Escribir nombre para esta vez..."
              value={serviceNameTemplates.includes(serviceName) ? '' : serviceName}
              onChange={e => setServiceName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowDropdown(false)
                  onEnter?.()
                }
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
