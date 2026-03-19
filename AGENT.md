# Proclama — Agent Context

## Propósito

Proclama es un sistema de proyección de alabanzas y Biblia para iglesias, diseñado para reemplazar soluciones de pago como EasyWorship o HolyLyrics. Funciona completamente en el navegador, es instalable como PWA y sincroniza datos en la nube vía Supabase.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | React 18 + TypeScript + Vite 6 |
| Estado global | Zustand (con `persist` para settings) |
| DB local (offline) | Dexie (IndexedDB) + `dexie-react-hooks` |
| DB cloud | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Comunicación entre ventanas | BroadcastChannel API |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Iconos | lucide-react |
| PWA | vite-plugin-pwa (autoUpdate, workbox) |
| Estilos | Vanilla CSS (sin framework CSS) |
| Alias de imports | `@/` → `src/` |

---

## Estructura del Proyecto

```
src/
├── App.tsx                  # Raíz: detecta ventana de proyección, maneja auth, renderiza MainApp
├── main.tsx                 # Entry point React
├── index.css                # Estilos globales (variables CSS, layout, componentes)
│
├── types/index.ts           # Todos los tipos TypeScript del dominio
├── stores/index.ts          # Zustand stores: useProjectionStore + useAppStore
│
├── db/index.ts              # Dexie DB: tablas songs, setlists, settings (v3)
│
├── services/
│   ├── supabase.ts          # Cliente Supabase + CRUD songs/setlists/settings/backgrounds
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
│   ├── Sidebar.tsx          # Nav principal: Biblioteca, Setlists, Ajustes, Biblia + botón proyección
│   ├── ControlPanel.tsx     # Panel derecho: navegación de slides, Negro, Logo, lista de slides
│   ├── MediaPanel.tsx       # Panel de media: carga imagen/video para anuncios en proyección
│   ├── RecognitionPanel.tsx # UI del reconocimiento de audio (ACRCloud)
│   ├── VideoControls.tsx    # Controles de video proyectado (play/pause/seek)
│   └── OnlineSearchModal.tsx # Modal de búsqueda online de letras (lrclib.net)
│
├── pages/
│   ├── LandingView.tsx      # Pantalla de bienvenida (usuario no autenticado)
│   ├── AuthView.tsx         # Vista de autenticación
│   ├── LibraryView.tsx      # Biblioteca de canciones con búsqueda y filtros
│   ├── SongEditor.tsx       # Editor de canción (crear/editar, con preview de slides)
│   ├── SetlistsView.tsx     # Gestión de setlists con drag & drop
│   ├── BibleView.tsx        # Navegador de Biblia con búsqueda global
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
SET_BLACK / SET_LOGO
MEDIA_COMMAND      → play/pause/seek para video de anuncios
MEDIA_STATUS       → reportado por ProjectionWindow al main (currentTime, duration, isPlaying)
PING / PONG        → heartbeat para detectar si la ventana está viva
```

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
{ id?, churchId?, title, artist, lyrics, key, tags[], language, sourceUrl?, usageCount, createdAt, updatedAt }
```
- `lyrics`: estrofas separadas por línea en blanco; etiquetas opcionales `[Coro]`, `[Verso 1]`, etc.
- Almacenada en Supabase (cloud) y Dexie (local, offline)
- Supabase usa snake_case (`usage_count`, `source_url`, etc.); el frontend usa camelCase

### Setlist
```ts
{ id?, userId?, churchId?, name, date, songIds[], notes?, createdAt, updatedAt }
```
- Si hay usuario autenticado → Supabase; si no → Dexie local

### Slide (unidad de proyección)
```ts
{ index, label, lines[] }
```
- Generado por `parseLyrics()` desde `song.lyrics`
- Máximo 4 líneas por slide (configurable); estrofas largas se dividen automáticamente

### ProjectionTheme
```ts
{ background, backgroundType ('color'|'image'|'video'|'gradient'), backgroundImageUrl?, backgroundVideoUrl?,
  backgroundBlur, backgroundOverlayOpacity, fontFamily, fontSize, textColor, textShadow,
  transition ('fade'|'slide'|'instant'), showTitle, showVerseLabel }
```

### BibleVerse (proyección)
- Se convierte a `Song` temporal con `isBible: true` para reutilizar el sistema de slides
- `title` = referencia (ej. "Juan 3:16"), `lyrics` = texto del versículo

---

## Estado Global (Zustand)

### `useProjectionStore`
- `state: ProjectionState` — estado completo de la proyección
- `loadSong(song, isBible?)` — parsea lyrics → slides, envía PROJECTION_UPDATE
- `nextSlide / prevSlide / goToSlide(i)` — navegación, envía update
- `setBlack(v) / setLogo(v)` — flags mutuamente excluyentes
- `updateTheme(partial)` — merge de tema, envía update
- `setMedia(media)` — carga imagen/video de anuncios
- `sendMediaCommand(action, value?)` — play/pause/seek al video de anuncios
- NO persiste en localStorage (estado efímero de sesión)

### `useAppStore` (persiste `settings` e `isSidebarOpen`)
- `settings: AppSettings` — ACRCloud keys, Genius token, churchName, defaultTheme
- `user / authStatus` — estado de autenticación Supabase
- `activeView` — vista activa: `'library' | 'editor' | 'setlists' | 'settings' | 'bible'`
- `editingSong` — canción en edición en SongEditor
- `activeSetlist` — setlist activo en vivo
- `recognitionStatus / detectedSong` — estado del reconocimiento de audio
- `searchQuery` — búsqueda global en LibraryView
- `isSidebarOpen` — visibilidad del sidebar
- `backgrounds[]` — assets de fondo desde Supabase (`backgrounds` table)

---

## Autenticación y Permisos

- Sin sesión: solo lectura de canciones (Supabase RLS), setlists y settings en Dexie local
- Con sesión: escritura en Supabase (crear/editar/borrar canciones y setlists)
- Login en `SettingsView` (email/password via `supabase.auth.signInWithPassword`)
- `LandingView` se muestra cuando `authStatus === 'unauthenticated'`

---

## Servicios Externos

| Servicio | Uso | Configuración |
|---|---|---|
| Supabase | DB cloud + Auth + Storage (backgrounds) | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` en `.env.local` |
| ACRCloud | Reconocimiento de audio (fingerprinting) | host + accessKey + accessSecret en Settings |
| lrclib.net | Búsqueda e importación de letras (sin API key) | Ninguna |
| bible-api.com | Fallback para capítulos no en datos locales | Ninguna |

---

## Biblia

- Datos locales: `src/data/bible-content.ts` (RVR1960 completa, ~66 libros)
- Fallback: `bible-api.com` si el capítulo no está en local
- Búsqueda: por referencia exacta (`Juan 3:16`), por capítulo (`Génesis 1`), o por texto libre
- Autocompletado de libros: `getBookSuggestion(query)` devuelve sugerencia si hay match único
- Proyección: versículo se convierte a `Song` temporal con `isBible: true`

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
npm run build    # tsc + vite build → dist/
npm run preview  # Preview del build
```

Scripts utilitarios en raíz (Node CJS):
- `process-bible.cjs` / `process-bible-fixed.cjs` — procesamiento de datos bíblicos
- `validate-bible.cjs` / `check-books.cjs` — validación de datos
- `scripts/import-songs.cjs` — importación masiva de canciones

---

## Convenciones de Código

- Alias `@/` para imports desde `src/`
- Tipos en `src/types/index.ts` — único source of truth del dominio
- Supabase: snake_case en DB, camelCase en frontend (mapeo explícito en `supabase.ts`)
- Componentes: PascalCase, archivos `.tsx`
- Servicios: funciones puras exportadas, sin estado propio
- CSS: variables en `:root`, clases BEM-like, sin CSS modules
- No hay router (SPA con estado `activeView` en Zustand)
