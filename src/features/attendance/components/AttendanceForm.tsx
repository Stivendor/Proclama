import { Plus, X, Check } from 'lucide-react'
import { parseField } from '../utils/validation'

interface AttendanceFormProps {
  categories: string[]
  onUpdateCategories: (newCats: string[]) => void
  values: string[]
  onChangeValues: (newValues: string[]) => void
  onSave: () => void
  isLoading: boolean
  error: string
  onClearError: () => void
  readonlyCategories?: boolean
}

export default function AttendanceForm({
  categories,
  onUpdateCategories,
  values,
  onChangeValues,
  onSave,
  isLoading,
  error,
  onClearError,
  readonlyCategories = false,
}: AttendanceFormProps) {
  
  const total = values.reduce((sum, v) => sum + parseField(v), 0)

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {categories.map((cat, idx) => (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
            <input
              type="text"
              className="input"
              value={cat}
              onChange={e => {
                if (readonlyCategories) return;
                const newCats = [...categories]
                newCats[idx] = e.target.value
                onUpdateCategories(newCats)
              }}
              placeholder="Nombre"
              readOnly={readonlyCategories}
              style={{ flex: 1, fontWeight: 600, border: readonlyCategories ? 'none' : undefined, background: readonlyCategories ? 'transparent' : undefined }}
            />
            <input
              id={`att-${idx}`}
              type="number"
              className="input"
              min={0}
              step={1}
              placeholder="#"
              style={{ width: 60, textAlign: "center" }}
              value={values[idx] ?? ''}
              onChange={e => {
                const newValues = [...values]
                newValues[idx] = e.target.value
                onChangeValues(newValues)
                onClearError()
              }}
              onKeyDown={e => e.key === 'Enter' && onSave()}
            />
            {!readonlyCategories && (
              <button
                className="btn-icon"
                onClick={() => {
                  const newCats = categories.filter((_, i) => i !== idx)
                  onUpdateCategories(newCats)
                }}
                disabled={categories.length <= 1}
                title="Eliminar categoría"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        
        {!readonlyCategories && (
          <button
            className="btn-ghost"
            onClick={() => {
              const newCat = `Categoría ${categories.length + 1}`
              onUpdateCategories([...categories, newCat])
            }}
            title="Agregar nueva categoría"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px dashed var(--border)" }}
          >
            <Plus size={14} />
            Agregar
          </button>
        )}
      </div>

      <div className="attendance-total-row">
        <span className="attendance-total-label">Total</span>
        <span className="attendance-total-value">
          {isLoading ? <span style={{ opacity: 0.3 }}>–</span> : total}
        </span>
        <button className="btn-primary" onClick={onSave} style={{ marginLeft: 'auto' }}>
          <Check size={14} />
          Guardar
        </button>
      </div>

      {error && (
        <p className="field-error" role="alert" aria-live="polite">{error}</p>
      )}
    </>
  )
}
