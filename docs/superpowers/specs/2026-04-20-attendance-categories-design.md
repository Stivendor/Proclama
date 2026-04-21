# Diseño: Campos de Asistencia Configurables

## Objetivo
Permitir que el usuario defina los nombres de las categorías de asistencia desde la zona de Notas, ya que pueden variar según la iglesia (ej: "Hermanos", "Hermanas", "Visitas", etc.)

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
  values?: number[]  // nuevo formato array
  caballeros?: number  // backward compat
  damas?: number
  amigos?: number
  ninos?: number
}

interface AttendanceRecord {
  id?: number
  remoteId?: string
  userId: string
  date: string
  serviceName?: string
  values?: number[]  // nuevo formato array
  caballeros?: number  // backward compat
  damas?: number
  amigos?: number
  ninos?: number
  createdAt: string
  updatedAt: string
}
```

## UI en NotasView (NO en Ajustes)

### Grid de categorías
- Tarjetas visuales por categoría con:
  - Input de texto para nombre (editable inline)
  - Input de número para valor
  - Botón "×" para eliminar categoría
- Botón "+ Agregar" para nueva categoría
- Layout grid responsive

### Historial de asistencia
- Tabla con todas las categorías (sin límite de 4)
- Total al final a la derecha
- Soporte dinámico para N categorías

### Gráfico de barras
- Barras segmentadas por color (azul, dorado, verde, púrpura, etc.)
- Muestra cada categoría proporcionalmente

## Proyección

### renderizado dinámico
- Calcula `linesPerSlide = 1 + categories.length + 1` (título + categorías + total)
- Adapta automáticamente al número de categorías

## Exportación CSV
- Soporte para array de valores
- Rellena con ceros si hay menos valores que categorías

## Backward Compatibility
- Si `attendanceCategories` no está configurado, usar defecto
- Datos antiguos (caballeros, damas, amigos, ninos) funcionan automáticamente
- Conversión implícita en lecturas