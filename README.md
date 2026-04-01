# Proclama

Sistema de proyección de alabanzas y Biblia para iglesias, construido con React 18, TypeScript y Vite 6.
Funciona directamente en el navegador, sin instalación, con soporte para uso local, sincronización opcional en la nube y una ventana de proyección independiente.

---

## Índice

1. [Resumen](#resumen)
2. [Funcionalidades](#funcionalidades)
3. [Arquitectura](#arquitectura)
4. [Tecnologías](#tecnologías)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Instalación](#instalación)
7. [Variables de Entorno](#variables-de-entorno)
8. [Base de Datos Supabase](#base-de-datos-supabase)
9. [Scripts](#scripts)
10. [Atajos de Teclado](#atajos-de-teclado)

---

## Resumen

Proclama reúne en una sola aplicación web:

- Biblioteca de canciones con almacenamiento local y sincronización con Supabase.
- Creación y administración de setlists para servicios.
- Proyección en ventana separada para TV o proyector con auto-ajuste de fuente.
- Biblia integrada (RVR1960) con búsqueda por texto, libro o referencia.
- Contador regresivo personalizable con proyección en tiempo real.
- Sección de Notas: asistencia desglosada por categoría, avisos proyectables e historial.
- Fondos personalizables con color, imagen o video.
- Importación y búsqueda online de letras.
- Panel de control en vivo con navegación rápida de estrofas y versículos.
- PWA instalable con soporte offline.

---

## Funcionalidades

### Biblioteca de canciones

- Crear, editar y eliminar canciones con confirmación.
- Buscar por título, artista, letra y etiquetas.
- Buscar e importar letras online (lrclib.net).
- Persistencia local con Dexie para trabajar sin sesión.
- Sincronización con Supabase cuando hay sesión iniciada.

### Setlists

- Crear setlists para cada servicio o reunión.
- Agregar canciones desde la biblioteca local.
- Reordenar canciones con drag and drop.
- Activar una canción directamente desde el setlist.

### Biblia integrada

- Navegación por libros y capítulos (AT y NT).
- Selector de capítulos tipo bento grid — clic directo al capítulo.
- Búsqueda global por texto o referencia directa (`Juan 3:16`).
- Proyección inmediata de versículos y pasajes.
- Historial de versículos proyectados en la sesión actual.

### Proyección en vivo

- Ventana independiente para proyector o segunda pantalla.
- Apertura automática en el segundo monitor usando Window Management API (Chrome/Edge).
- Canvas fijo (1920×1080 para 16:9, 1024×768 para 4:3) escalado con `transform: scale` — inmune a F11 y fullscreen.
- Navegación entre estrofas desde el panel de control.
- Pantalla negra y modo ocultar texto.
- Tema configurable en tiempo real: fuente, tamaño, color, sombra, transición.
- Fondos por color, imagen y video con blur y overlay.
- Auto-ajuste de tamaño de fuente (cálculo matemático puro, sin DOM) con escala manual ajustable.
- Posición del título y referencia bíblica configurable.
- Selector de relación de aspecto: 16:9 y 4:3.

### Contador regresivo

- Configuración de título y duración (minutos y segundos).
- Controles de inicio, pausa, reanudación y reinicio.
- Tema visual independiente con las mismas opciones que la proyección.
- Vista previa en tiempo real dentro de la pestaña.
- Proyección en la ventana de proyección existente.

### Notas del culto

- **Nombre del culto**: campo libre (ej. "Culto Dominical", "Vigilia", "Ayuno").
- **Asistencia desglosada**: Caballeros, Damas, Amigos, Niños con total automático.
- **Proyección de asistencia**: slide con plantilla de tabla proyectable.
- **Avisos**: lista de texto libre con CRUD completo y proyección individual.
- **Historial**: gráfico de barras apiladas + tabla resumen de los últimos 12 cultos.
- **Sincronización**: asistencia sincronizada con Supabase (`attendance_records`); avisos solo locales.
- Selector de fecha para navegar entre cultos anteriores.

### Media y personalización

- Carga de imágenes y videos locales para anuncios.
- Control de reproducción de video desde el panel de control.
- Modo fondo: media detrás del texto.

### Onboarding y UX

- Tour guiado de 4 pasos para nuevos usuarios con spotlight animado.
- Acceso sin cuenta (modo invitado) con datos en IndexedDB local.
- Confirmaciones antes de acciones destructivas.
- Accesibilidad: roles ARIA, `aria-label`, foco gestionado.

---

## Arquitectura

### Comunicación entre ventanas

La ventana principal y la ventana de proyección se comunican mediante `BroadcastChannel` (canal `proclama-projection`):

| Tipo | Dirección | Descripción |
|------|-----------|-------------|
| `PROJECTION_UPDATE` | Principal → Proyección | Estado completo (slides, tema, media) |
| `COUNTDOWN_UPDATE` | Principal → Proyección | Estado del contador regresivo |
| `NEXT_SLIDE` / `PREV_SLIDE` | Principal → Proyección | Navegación de estrofas |
| `GO_TO_SLIDE` | Principal → Proyección | Ir a estrofa específica |
| `MEDIA_COMMAND` | Principal → Proyección | Controlar reproducción de video |
| `MEDIA_STATUS` | Proyección → Principal | Estado de reproducción del video |
| `PING` / `PONG` | Bidireccional | Verificar que la ventana está activa |

### Estado global

- `useAppStore` (Zustand + persist): configuración, auth, vista activa, modo invitado, onboarding.
- `useProjectionStore` (Zustand): estado efímero de la proyección en tiempo real.
- `useCountdownStore` (Zustand + persist): configuración y estado del contador.

### Persistencia

- `Dexie v4` (IndexedDB): canciones, setlists, notas del culto (local/offline).
- `Zustand persist` (localStorage): configuración, tema, modo invitado, onboarding.
- `Supabase`: canciones, setlists y asistencia sincronizados en la nube.

---

## Tecnologías

| Categoría | Tecnología |
|-----------|-----------|
| Frontend | React 18, TypeScript, Vite 6 |
| Estado global | Zustand 4 |
| Persistencia local | Dexie 3 v4 (IndexedDB) |
| Autenticación y nube | Supabase |
| UI e iconografía | CSS personalizado, Lucide React |
| Drag and drop | @dnd-kit/core, @dnd-kit/sortable |
| PWA | vite-plugin-pwa |
| SSG | vite-react-ssg |
| Observabilidad | @vercel/analytics, @vercel/speed-insights |

---

## Estructura del Proyecto

```
src/
├── pages/
│   ├── LandingView.tsx       # Página de entrada con comparativa de planes e interés premium
│   ├── AuthView.tsx          # Formulario de autenticación
│   ├── LibraryView.tsx       # Biblioteca de canciones
│   ├── SongEditor.tsx        # Editor de canciones
│   ├── SetlistsView.tsx      # Gestión de setlists
│   ├── BibleView.tsx         # Biblia integrada con bento de capítulos
│   ├── CountdownView.tsx     # Contador regresivo
│   ├── NotesView.tsx         # Notas del culto (asistencia + avisos + historial)
│   ├── SettingsView.tsx      # Ajustes de la app (tema, aspect ratio, escala)
│   └── ProjectionWindow.tsx  # Ventana de proyección (canvas fijo + scale)
├── components/
│   ├── Sidebar.tsx           # Navegación lateral
│   ├── ControlPanel.tsx      # Panel de control en vivo (slides + escala de fuente)
│   ├── MediaPanel.tsx        # Panel de media local
│   ├── ProjectionPreview.tsx # Preview del operador (canvas fijo escalado)
│   ├── OnboardingFlow.tsx    # Tour guiado de bienvenida
│   ├── OnlineSearchModal.tsx # Búsqueda online de letras
│   ├── VideoControls.tsx     # Controles de video
│   └── ConfirmDialog.tsx     # Diálogo de confirmación
├── stores/
│   ├── index.ts              # AppStore + ProjectionStore (aspectRatio, fontScale)
│   └── countdown.ts          # CountdownStore
├── services/
│   ├── supabase.ts           # Cliente Supabase + helpers (songs, setlists, attendance, premium_interest)
│   ├── projection.ts         # BroadcastChannel + apertura en segundo monitor
│   ├── bible.ts              # Lógica de búsqueda bíblica
│   ├── lyricsParser.ts       # Parser de estrofas
│   └── genius.ts             # Búsqueda de letras
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── usePlan.ts            # Hook freemium: isPremium, canUseGenius, canSync, etc.
│   └── useProjectionFontSize.ts  # calcCanvasFontSize() — cálculo matemático puro
├── db/
│   └── index.ts              # Dexie v4: songs, setlists, settings, church_notes
├── data/
│   └── bible-content.ts      # RVR1960 completa
└── types/
    └── index.ts              # Tipos TypeScript globales
```

---

## Instalación

```bash
git clone https://github.com/tu-usuario/proclama.git
cd proclama
npm install
```

---

## Variables de Entorno

Crea un archivo `.env.local`:

```bash
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

- Supabase es necesario para autenticación y sincronización en la nube.
- La app funciona completamente sin login en modo invitado (datos locales).
- El token de Genius y las credenciales de ACRCloud se configuran desde Ajustes.

---

## Base de Datos Supabase

Además de las tablas estándar (`songs`, `setlists`, `backgrounds`, `profiles`), necesitas crear:

```sql
CREATE TABLE attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  service_name TEXT,
  caballeros   INTEGER NOT NULL DEFAULT 0,
  damas        INTEGER NOT NULL DEFAULT 0,
  amigos       INTEGER NOT NULL DEFAULT 0,
  ninos        INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attendance"
  ON attendance_records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Scripts

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción (TypeScript + SSG)
npm run preview   # Vista previa del build
```

---

## Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| `→` / `↓` / `Espacio` | Siguiente estrofa o versículo |
| `←` / `↑` | Estrofa o versículo anterior |
| `B` | Activar o desactivar pantalla negra |
| `Esc` | Cerrar modales o salir del modo negro |

---

Hecho con amor para servir al Reino de Dios.
