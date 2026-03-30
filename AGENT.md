# Proclama — Agent Context

## Propósito

Proclama es un sistema de proyección de alabanzas y Biblia para iglesias, diseñado para reemplazar soluciones de pago como EasyWorship o HolyLyrics. Funciona completamente en el navegador, es instalable como PWA y sincroniza datos en la nube vía Supabase.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | React 18 + TypeScript + Vite 6 |
| Estado global | Zustand (con `persist` para settings) |
| DB local (offline) | Dexie (IndexedDB) v4 + `dexie-react-hooks` |
| DB cloud | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Comunicación entre ventanas | BroadcastChannel API |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Iconos | lucide-react |
| PWA | vite-plugin-pwa (autoUpdate, workbox) |
| SSG | vite-react-ssg |
| Observabilidad | @vercel/analytics + @vercel/speed-insights |
| Estilos | Vanilla CSS (sin framework CSS) |
| Alias de imports | `@/` → `src/` |

---

## Estructura del Proyecto

```
src/
├── App.tsx                  # Raíz: detecta ventana de proyección, maneja auth, migración guest→user
├── main.tsx                 # Entry point React
├── index.css                # Estilos globales (variables CSS, layout, componentes)
│
├── types/index.ts           # Todos los tipos TypeScript del dominio
├── stores/index.ts          # Zustand stores: useProjectionStore + useAppStore
├── stores/countdown.ts      # Zustand store: useCountdownStore (persiste config)
│
├── db/index.ts              # Dexie DB v4: songs, setlists, settings, church_notes
│
├── services/
│   ├── supabase.ts          # Cliente Supabase + CRUD songs/setlists/settings/backgrounds/attendance
│   ├── projection.ts        # BroadcastChannel: envío/recepción de mensajes entre ventanas
│   ├── lyricsParser.ts      # parseLyrics() → Slide[], cleanLyricsText(), slidesToText()
│   ├── bible.ts             # fetchChapter(), searchGlobal(), getBookSuggestion(), BIBLE_BOOKS
│   ├── acrcloud.ts          # recognizeAudio() + captureAudioSample() (HMAC-SHA1 via Web Crypto)
│   └── genius.ts            # searchSongs() + fetchLyrics() via lrclib.net (sin API key)
│
├── hooks/
│   ├── useKeyboardShortcuts.ts  # →/←/Space/B/Esc para control de proyección
│   └── useAudioRecognition.ts   # Hook de reconocimiento de audio con ACRCloud
│
├── components/
│   ├── Sidebar.tsx          # Nav: Biblioteca, Setlists, Biblia, Contador, Notas, Ajustes
│   ├── ControlPanel.tsx     # Panel derecho: navegación de slides, Negro, Logo, lista de slides
│   ├── MediaPanel.tsx       # Panel de media: carga imagen/video para anuncios en proyección
│   ├── RecognitionPanel.tsx # UI del reconocimiento de audio (ACRCloud)
│   ├── VideoControls.tsx    # Controles de video proyectado (play/pause/seek)
│   ├── OnlineSearchModal.tsx # Modal de búsqueda online de letras (lrclib.net)
│   ├── OnboardingFlow.tsx   # Tour guiado de 4 pasos para nuevos usuarios
│   └── ConfirmDialog.tsx    # Diálogo de confirmación reutilizable
│
├── pages/
│   ├── LandingView.tsx      # Pantalla de bienvenida (usuario no autenticado)
│   ├── AuthView.tsx         # Vista de autenticación
│   ├── LibraryView.tsx      # Biblioteca de canciones con búsqueda y filtros
│   ├── SongEditor.tsx       # Editor de canción (crear/editar, con preview de slides)
│   ├── SetlistsView.tsx     # Gestión de setlists con drag & drop
│   ├── BibleView.tsx        # Navegador de Biblia con búsqueda global
│   ├── CountdownView.tsx    # Contador regresivo configurable con proyección
│   ├── NotesView.tsx        # Notas del culto: asistencia desglosada + avisos + historial
│   ├── SettingsView.tsx     # Ajustes: auth, tema de proyección, API keys
│   └── ProjectionWindow.tsx # Ventana de proyección (detectada por window.name)
│
└── data/
    ├── bible-content.ts     # Biblia RVR1960 completa en JSON local
    └── bible-raw.json       # Datos crudos de la Biblia
```

---

## Arquitectura de Proyección (Dual-Window)

La proyección usa dos ventanas del mismo origen comunicadas por `BroadcastChannel('proclama-projection')`:

- **Ventana principal** (`/`): operador controla slides, tema, negro, logo, media
- **Ventana de proyección** (`/projection` o `window.name === 'proclama-projection'`): solo renderiza, escucha mensajes

`App.tsx` detecta si es la ventana de proyección con:
```ts
const IS_PROJECTION = window.name === 'proclama-projection' || window.location.pathname === '/projection'
```

### Tipos de mensajes BroadcastMessage
```
PROJECTION_UPDATE  → estado completo (slides, tema, media, flags)
NEXT_SLIDE / PREV_SLIDE / GO_TO_SLIDE
MEDIA_COMMAND      → play/pause/seek para video de anuncios
MEDIA_STATUS       → reportado por ProjectionWindow al main (currentTime, duration, isPlaying)
COUNTDOWN_UPDATE   → estado del contador regresivo
PING / PONG        → heartbeat para detectar si la ventana está viva
```

### Auto-fit de fuente en ProjectionWindow
- Algoritmo de búsqueda binaria que maximiza el tamaño de fuente sin desbordamiento
- Cap configurable via `theme.maxFontSize` (usado por NotesView para avisos y asistencia)
- Recalcula en cada cambio de slide y en resize de ventana

### Capas Z-index en ProjectionWindow
```
z:0  → fondo (color/imagen con blur)
z:1  → video de fondo (motion background)
z:5  → overlay oscuro (backgroundOverlayOpacity)
z:10 → texto (slides)
z:15 → logo
z:20 → media de anuncios (imagen/video)
z:30 → pantalla negra
```

---

## Modelo de Datos

### Song
```ts
{ id?, userId?, churchId?, title, artist, lyrics, key, tags[], language, sourceUrl?,
  usageCount, isPublic, isVerified, createdAt, updatedAt }
```

### Setlist
```ts
{ id?, userId?, churchId?, name, date, songIds[], notes?, createdAt, updatedAt }
```

### Slide
```ts
{ index, label, lines[] }
```
- Generado por `parseLyrics()` desde `song.lyrics`
- Máximo 4 líneas por slide (configurable)

### ProjectionTheme
```ts
{ background, backgroundType, backgroundImageUrl?, backgroundVideoUrl?,
  backgroundBlur, backgroundOverlayOpacity, fontFamily, fontSize, textColor, textShadow,
  transition, showTitle, showVerseLabel, fontSizeMax?, titlePosition?,
  verseReferencePosition?, textUppercase?, maxFontSize? }
```
- `maxFontSize`: cap opcional para el auto-fit (usado al proyectar avisos/asistencia)

### AttendanceBreakdown
```ts
{ caballeros: number, damas: number, amigos: number, ninos: number }
```

### Notice
```ts
{ id: string, text: string, createdAt: string, updatedAt: string }
```
- Solo persiste en Dexie local

### ChurchNote
```ts
{ id?, remoteId?, userId, date, serviceName?, attendance?: AttendanceBreakdown,
  notices: Notice[], createdAt, updatedAt }
```
- Entidad por fecha: agrupa nombre del culto, asistencia y avisos
- Dexie v4: tabla `church_notes` indexada por `[date+userId]`
- La asistencia se sincroniza con Supabase tabla `attendance_records`

---

## Estado Global (Zustand)

### `useProjectionStore`
- `state: ProjectionState` — estado completo de la proyección
- `loadSong(song, isBible?)` — parsea lyrics → slides, envía PROJECTION_UPDATE
- `nextSlide / prevSlide / goToSlide(i)` — navegación
- `updateTheme(partial)` — merge de tema, envía update
- `setMedia(media)` — carga imagen/video de anuncios
- NO persiste en localStorage (estado efímero de sesión)

### `useAppStore` (persiste `settings`, `isSidebarOpen`, `onboardingDone`, `guestMode`)
- `settings: AppSettings` — ACRCloud keys, Genius token, churchName, defaultTheme
- `user / authStatus / userRole` — estado de autenticación Supabase
- `activeView` — `'library' | 'editor' | 'setlists' | 'settings' | 'bible' | 'countdown' | 'notes'`
- `guestMode` — acceso sin autenticación
- `editingSong / activeSetlist` — estado de edición
- `isSidebarOpen / onboardingDone` — estado de UI

### `useCountdownStore` (persiste config)
- `config: CountdownConfig` — título, duración, tema visual
- `status / remainingTime` — estado en tiempo real

---

## Sección Notas (`NotesView`)

Vista en el sidebar entre Contador y Ajustes.

### Asistencia al culto
- 4 campos: Caballeros, Damas, Amigos, Niños + total automático
- Campo libre "Nombre del culto"
- Botón proyectar → slide con plantilla (cap `maxFontSize: 64`)
- Sync con Supabase `attendance_records` al guardar
- Toast verde de confirmación / toast rojo de error

### Avisos
- CRUD completo con confirmación de eliminación
- Botón proyectar por aviso (cap `maxFontSize: 80`)
- Indicador visual del aviso proyectado actualmente
- Solo local (Dexie), sin sync a Supabase

### Historial
- Gráfico de barras apiladas (últimos 12 cultos)
- Tabla con fecha, nombre del culto, desglose y total

---

## Autenticación y Permisos

- Sin sesión: modo invitado, datos solo en Dexie local
- Con sesión: escritura en Supabase
- `userRole`: `'admin' | 'user' | null` — leído de tabla `profiles`
- Migración automática `guest → userId` al autenticarse (en `App.tsx`)

---

## Supabase — Tablas

| Tabla | Descripción |
|---|---|
| `songs` | Canciones |
| `setlists` | Setlists |
| `backgrounds` | Assets de fondo |
| `app_settings` | Configuración global |
| `profiles` | Perfil de usuario con `role` |
| `attendance_records` | Asistencia por culto y fecha |

### DDL `attendance_records`
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

## Servicios Externos

| Servicio | Uso | Configuración |
|---|---|---|
| Supabase | DB cloud + Auth + Storage | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` en `.env.local` |
| ACRCloud | Reconocimiento de audio | host + accessKey + accessSecret en Settings |
| lrclib.net | Búsqueda de letras (sin API key) | Ninguna |
| bible-api.com | Fallback bíblico | Ninguna |

---

## Atajos de Teclado

| Tecla | Acción |
|---|---|
| `→` / `↓` / `Space` / `PageDown` | Siguiente slide |
| `←` / `↑` / `PageUp` | Slide anterior |
| `B` | Toggle pantalla negra |
| `Esc` | Quitar pantalla negra |

Solo activos cuando el foco no está en `INPUT`, `TEXTAREA` o `SELECT`.

---

## Variables de Entorno

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Scripts

```bash
npm run dev      # Servidor de desarrollo (Vite)
npm run build    # tsc + vite-react-ssg build → dist/
npm run preview  # Preview del build
```

---

## Convenciones de Código

- Alias `@/` para imports desde `src/`
- Tipos en `src/types/index.ts` — único source of truth del dominio
- Supabase: snake_case en DB, camelCase en frontend
- Componentes: PascalCase, archivos `.tsx`
- Servicios: funciones puras exportadas, sin estado propio
- CSS: variables en `:root`, clases BEM-like, sin CSS modules
- No hay router (SPA con estado `activeView` en Zustand)
- Estado de notas: local al componente (React state + Dexie hooks), sin store Zustand dedicado
