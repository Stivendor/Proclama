# Campos de Asistencia Configurables - Plan de Implementación

> **Para agentes:** USAR sub-skill: superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar tarea por tarea.

**Goal:** Permitir que el usuario configure los nombres de categorías de asistencia desde Ajustes

**Architecture:** Agregar campo `attendanceCategories` a AppSettings, actualizar SettingsView con UI de edición, modificar NotesView para usar nombres dinámicos

**Stack:** TypeScript, React, Zustand

---

## Tareas

### Tarea 1: Agregar attendanceCategories a AppSettings

**Archivos:**
- Modificar: `src/types/index.ts:138-142`
- Modificar: `src/stores/index.ts:34-36`

- [ ] **Paso 1: Agregar campo a AppSettings**

En `src/types/index.ts`, línea 142 (después de `defaultTheme`):
```typescript
export interface AppSettings {
  churchName: string
  churchLogoUrl?: string
  defaultTheme: ProjectionTheme
  attendanceCategories: string[]
}
```

- [ ] **Paso 2: Agregar valor por defecto en stores**

En `src/stores/index.ts`, línea 36 (después de `churchLogoUrl`):
```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  churchName: '',
  churchLogoUrl: '',
  defaultTheme: DEFAULT_THEME,
  attendanceCategories: ['Caballeros', 'Damas', 'Amigos', 'Niños'],
}
```

### Tarea 2: Agregar UI de configuración en SettingsView

**Archivos:**
- Modificar: `src/pages/SettingsView.tsx`

- [ ] **Paso 1: Agregar estado para categorías**

Después de línea 66 (`const [showSecret, setShowSecret]`):
```typescript
const [attendanceCategories, setAttendanceCategories] = useState<string[]>(
  settings.attendanceCategories || ['Caballeros', 'Damas', 'Amigos', 'Niños']
)
```

- [ ] **Paso 2: Agregar sección de UI**

Después de sección de Church Name (línea ~170), agregar:
```tsx
<section className="settings-section">
  <div className="settings-section-header">
    <h3>Categorías de Asistencia</h3>
  </div>
  <p className="settings-help-text">
    Define los nombres de las categorías para registrar asistencia
  </p>
  <div className="attendance-categories-list">
    {attendanceCategories.map((cat, idx) => (
      <div key={idx} className="attendance-category-row">
        <input
          type="text"
          className="input"
          value={cat}
          onChange={e => {
            const newCats = [...attendanceCategories]
            newCats[idx] = e.target.value
            setAttendanceCategories(newCats)
          }}
          placeholder="Nombre de categoría"
        />
        <button
          className="btn-icon"
          onClick={() => setAttendanceCategories(cats => cats.filter((_, i) => i !== idx))}
          disabled={attendanceCategories.length <= 1}
          title="Eliminar"
        >
          <X size={14} />
        </button>
      </div>
    ))}
  </div>
  <button
    className="btn-ghost"
    onClick={() => setAttendanceCategories(cats => [...cats, `Categoría ${cats.length + 1}`])}
    disabled={attendanceCategories.length >= 10}
    style={{ marginTop: 8 }}
  >
    <Plus size={14} />
    Agregar categoría
  </button>
</section>
```

- [ ] **Paso 3: Agregar estilos CSS**

Agregar en el CSS de SettingsView:
```css
.attendance-categories-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.attendance-category-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.attendance-category-row .input {
  flex: 1;
}
.settings-help-text {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
```

- [ ] **Paso 4: Guardar categorías al actualizar settings**

En la función que guarda settings, asegurar que attendanceCategories se guarda:
```typescript
updateSettings({ ...settings, attendanceCategories })
```

### Tarea 3: Actualizar NotesView para usar categorías dinámicas

**Archivos:**
- Modificar: `src/pages/NotesView.tsx`

- [ ] **Paso 1: Leer categorías desde settings**

Después de línea ~50 ( estados del store):
```typescript
const attendanceCategories = useAppStore(s => s.settings.attendanceCategories)
```

- [ ] **Paso 2: Actualizar grid de asistencia**

En línea ~717, donde está el map de campos:
```typescript
{attendanceCategories.map((cat, idx) => (
  <div key={idx} className="attendance-field">
    <label htmlFor={`att-${idx}`} className="attendance-field-label">
      {cat}
    </label>
    <input
      id={`att-${idx}`}
      type="number"
      className="input"
      min={0}
      step={1}
      placeholder="0"
      value={att.values?.[idx] ?? att[idx] ?? 0}
      onChange={e => {
        const newValues = [...(att.values || [])]
        newValues[idx] = e.target.value
        setAtt(prev => ({ ...prev, values: newValues }))
      }}
      onKeyDown={e => e.key === 'Enter' && saveAttendance()}
    />
  </div>
))}
```

- [ ] **Paso 3: Actualizar cálculo de total**

En línea ~742, cambiar a:
```typescript
const savedValues = att.values || Object.values(att).filter(v => typeof v === 'number')
const total = savedValues.reduce((sum, v) => sum + parseField(v), 0)
```

- [ ] **Paso 4: Actualizar buildAttendanceLyrics**

Actualizar función en línea 86-97:
```typescript
function buildAttendanceLyrics(values: number[], categories: string[], date: string, name?: string): string {
  const total = values.reduce((a, b) => a + b, 0)
  const title = name ? `${name}  ${formatDate(date)}` : `Asistencia  ${formatDate(date)}`
  const lines = [title]
  categories.forEach((cat, i) => {
    lines.push(`${cat.padEnd(10).slice(0, 10)}  ${values[i] || 0}`)
  })
  lines.push(`Total       ${total}`)
  return lines.join('\n')
}
```

- [ ] **Paso 5: Actualizar proyección de asistencia**

En función projectAttendance, usar categorías dinámicas:
```typescript
const lyrics = buildAttendanceLyrics(
  att.values || Object.values(att).filter(v => typeof v === 'number'),
  attendanceCategories,
  selectedDate,
  serviceName
)
```

### Tarea 4: Actualizar tipos de Attendance

**Archivos:**
- Modificar: `src/types/index.ts:180-200`

- [ ] **Paso 1: Agregar campo values**

Cambiar AttendanceBreakdown y AttendanceRecord para soportar ambos formatos:
```typescript
export interface AttendanceBreakdown {
  values?: number[]  // nuevo formato
  caballeros?: number  // backward compat
  damas?: number
  amigos?: number
  ninos?: number
}

export interface AttendanceRecord {
  id?: number
  remoteId?: string
  userId: string
  date: string
  serviceName?: string
  values?: number[]  // nuevo formato
  caballeros?: number
  damas?: number
  amigos?: number
  ninos?: number
  createdAt: string
  updatedAt: string
}
```

### Tarea 5: Testing y verificación

**Archivos:**
- Testing manual en la app

- [ ] **Paso 1: Verificar que la app inicia sin errores**

```bash
npm run dev
```

- [ ] **Paso 2: Ir a Ajustes y verificar nueva sección**

- [ ] **Paso 3: Agregar/editar nombres de categorías**

- [ ] **Paso 4: Ir a Notas y verificar que muestra las categorías nuevas**

- [ ] **Paso 5: Guardar asistencia y verificar datos**

- [ ] **Paso 6: Proyectar asistencia y verificar nombres**