# Diseño: Campos de Asistencia Configurables

## Objetivo
Permitir que el usuario defina los nombres de las categorías de asistencia en Ajustes, ya que pueden variar según la iglesia (ej: "Visitas", "Hernanos", etc.)

## Estructura de datos

### AppSettings (`types/index.ts`)
```typescript
interface AppSettings {
  // ...campos existentes
  attendanceCategories: string[]
}
```
- Valor por defecto: `['Caballeros', 'Damas', 'Amigos', 'Niños']`

### AttendanceBreakdown y AttendanceRecord (`types/index.ts`)
```typescript
interface AttendanceBreakdown {
  values: number[]  // array paralelo a attendanceCategories
}

interface AttendanceRecord {
  // ...campos existentes
  values: number[]  // mantiene backward compatibility
}
```

## UI en Ajustes

### Nueva sección "Categorías de Asistencia"
- Título: "Categorías de Asistencia"
- Lista editable:
  - Input de texto para cada nombre
  - Botón "×" para eliminar
  - Botón "+" para agregar nuevo campo
- Validación: mínimo 1 categoría, máximo 10

## NotasView

### Renderizado dinámico
- Lee `settings.attendanceCategories`
- Mapea índices a inputs
- Total = suma de todos los values

### Proyección
- Usa nombres configurados para mostrar asistencia

## Backward Compatibility
- Si `attendanceCategories` no está configurado, usar defecto
- Datos antiguos (caballeros, damas, amigos, ninos) se migran automáticamente al primer save

## Tareas
1. Agregar `attendanceCategories` a AppSettings
2. Agregar UI de configuración en SettingsView
3. Actualizar NotesView para usar categorías dinámicas
4. Actualizar proyecciones y reportes