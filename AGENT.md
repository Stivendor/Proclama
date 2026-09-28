# Proclama — Agent Context

## Propósito

Proclama es un sistema de proyección de alabanzas y Biblia para iglesias, diseñado para reemplazar soluciones de pago como EasyWorship o HolyLyrics. Funciona completamente en el navegador, es instalable como PWA y sincroniza datos en la nube vía Supabase.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | React 18 + TypeScript + Vite 8 |
| Estado global | Zustand (con `persist` para settings) |
| DB local (offline) | Dexie (IndexedDB) + `dexie-react-hooks` |
| DB cloud | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Comunicación entre ventanas | BroadcastChannel API |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Iconos | lucide-react |
| PWA | vite-plugin-pwa (prompt, workbox) |
| SSG | vite-react-ssg |
| Observabilidad | @vercel/analytics + @vercel/speed-insights |
| Estilos | Vanilla CSS (sin framework CSS) |
| Alias de imports | `@/` → `src/` |

---

## Estructura del Proyecto

```
src/
├── App.tsx                  # Raíz: detecta ventana de proyección, maneja auth estable (initAuth con timeouts), migración guest→user
├── main.tsx                 # Entry point React
├── index.css                # Solo @import de src/styles/* en orden de cascada
├── styles/                  # Estilos globales partidos por dominio (base, library, bible, admin…)
│
├── types/index.ts           # Todos los tipos TypeScript del dominio
├── stores/index.ts          # Zustand stores: useProjectionStore + useAppStore (aspectRatio, fontScale, CANVAS_SIZES)
├── stores/countdown.ts      # Zustand store: useCountdownStore (persiste config)
│
├── db/index.ts              # Dexie DB (esquema en v11): songs, setlists, settings, church_notes
│
├── services/
│   ├── supabase.ts          # Cliente Supabase + CRUD songs/setlists/settings/backgrounds/attendance/premium_interest
│   ├── projection.ts        # BroadcastChannel + openProjectionWindow() con Window Management API
│   ├── lyricsParser.ts      # parseLyrics() → Slide[], cleanLyricsText(), slidesToText()
│   └── bible.ts             # fetchChapter(), searchGlobal(), getBookSuggestion(), BIBLE_BOOKS
│
├── hooks/
│   ├── useKeyboardShortcuts.ts  # →/←/Space/B/Esc para control de proyección
│   ├── usePlan.ts               # isPremium, canSync, canCreateSong, FREE_SONG_LIMIT
│   └── useProjectionFontSize.ts # calcCanvasFontSize() — cálculo matemático puro sin DOM
│
├── components/
│   ├── Sidebar.tsx          # Nav: Biblioteca, Setlists, Biblia, Temporizador, Avisos, Asistencia, Fondos, Ajustes
│   ├── ControlPanel.tsx     # Panel derecho: slides, ocultar texto, slider de escala de fuente
│   ├── MediaPanel.tsx       # Panel de media: anuncios en proyección + pin (📌) de fondos de letra
│   ├── BackgroundShelf.tsx  # Recuadro fijo de fondos de letra (media/BackgroundShelf.tsx)
│   ├── projection/ProjectionPreview.tsx    # Preview del operador con canvas fijo escalado
│   ├── projection/ProjectionBackground.tsx # Capas de fondo + media, compartidas live/preview
│   ├── VideoControls.tsx    # Controles de video proyectado (play/pause/seek)
│   ├── OnboardingFlow.tsx   # Tour guiado de 4 pasos para nuevos usuarios
│   └── ConfirmDialog.tsx    # Diálogo de confirmación reutilizable
│
├── pages/
│   ├── LandingView.tsx      # Landing con comparativa de planes freemium + formulario de interés premium
│   ├── AuthView.tsx         # Vista de autenticación
│   ├── LibraryView.tsx      # Biblioteca de canciones con búsqueda y filtros
│   ├── SongEditor.tsx       # Editor de canción (crear/editar, con preview de slides)
│   ├── SetlistsView.tsx     # Gestión de setlists con drag & drop
│   ├── BibleView.tsx        # Navegador de Biblia con bento de capítulos y búsqueda global
│   ├── TimerView.tsx        # Temporizador (cuenta atrás) + reloj en pantalla, con proyección
│   ├── NoticesView.tsx      # Avisos: pantalla completa + banda deslizante (ticker)
│   ├── NotesView.tsx        # Asistencia al culto: desglose por categorías + historial
│   ├── SettingsView.tsx     # Ajustes: auth, tema, aspect ratio, API keys
│   └── ProjectionWindow.tsx # Ventana de proyección con canvas fijo + transform:scale
│
└── data/
    └── bible-rvr1960.json   # Biblia RVR1960 completa (JSON, import dinámico / chunk lazy)
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
- **Canvas fijo**: 1920×1080 (16:9) o 1024×768 (4:3), escalado al viewport con `transform: scale`
- Inmune a F11, fullscreen API y cualquier tamaño de ventana
- `calcCanvasFontSize()` en `src/hooks/useProjectionFontSize.ts`: cálculo matemático puro sin DOM
  - Estima word-wrap para textos largos (versículos bíblicos)
  - Búsqueda binaria contra dimensiones del canvas fijo
  - Parámetro `fontScale` (0.4–1.5) para ajuste manual del operador
- `aspectRatio` y `fontScale` persisten en localStorage via `useAppStore`
- Cap configurable via `theme.maxFontSize` (usado por NotesView para avisos y asistencia)

### Capas Z-index en la proyección
Las capas de fondo (z:0–z:5) y la de media (z:2/z:20) las renderiza `<ProjectionBackground>`
(`src/components/projection/ProjectionBackground.tsx`), compartido por `ProjectionWindow`
(`variant="live"`: refs de video/YouTube player) y `ProjectionPreview` (`variant="preview"`:
video en mute, YouTube como thumbnail). El resto lo pone `ProjectionWindow`.
```
z:0  → fondo (color/imagen con blur)
z:1  → video de fondo (motion background)
z:2  → media de anuncios en modo fondo (isBackgroundMode)
z:5  → overlay oscuro (backgroundOverlayOpacity)
z:10 → texto (slides)
z:15 → logo
z:20 → media de anuncios a pantalla completa (imagen/video/YouTube)
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
- Dexie: tabla `church_notes` indexada por `[date+userId]`
- La asistencia se sincroniza con Supabase tabla `attendance_records`

---

## Estado Global (Zustand)

### `useProjectionStore`
- `state: ProjectionState` — estado completo de la proyección
- `loadSong(song, isBible?)` — parsea lyrics → slides, envía PROJECTION_UPDATE
- `projectSlides(title, slides)` — proyecta slides ya parseados (asistencia u otro contenido) con la misma normalización que loadSong (media:null, hideText:false, favoriteBgOverride). Evita el path divergente que armaba el estado a mano
- `nextSlide / prevSlide / goToSlide(i)` — navegación
- `updateTheme(partial)` — merge de tema, envía update
- `setMedia(media)` — carga imagen/video de anuncios; oculta la letra automáticamente (hideText) y la restaura al quitar la media
- `defaultBackgroundMediaId` / `setDefaultBackgroundMediaId(id)` — fondo activo de letra (se aplica vía theme; `favoriteBgOverride` expulsa anuncios al navegar slides)
- `pinnedBackgroundIds` / `setPinnedBackgroundIds(updater)` — fondos fijados al recuadro (BackgroundShelf); helpers puros en `utils/backgroundShelf.ts`
- Persiste parcialmente en localStorage (`proclama-projection`): theme, `defaultBackgroundMediaId`, `pinnedBackgroundIds`; el resto es efímero

### `useAppStore` (persiste `settings`, `isSidebarOpen`, `onboardingDone`, `guestMode`, `aspectRatio`, `fontScale`)
- `settings: AppSettings` — churchName, churchLogoUrl, defaultTheme
- `user / authStatus / userRole` — estado de autenticación Supabase sincronizado
- `logout()` — acción atómica que limpia la sesión en Supabase y resetea el store local
- `activeView` — `'library' | 'setlists' | 'settings' | 'bible' | 'timer' | 'notices' | 'notes' | 'terms' | 'fondos' | 'reports' | 'admin-users'`
- `guestMode` — acceso sin autenticación manejado con IndexedDB
- `editingSong / activeSetlist` — estado de edición efímero
- `isSidebarOpen / onboardingDone` — estado de persistencia de UI
- `aspectRatio: '16:9' | '4:3'` — relación de aspecto del canvas de proyección
- `fontScale: number` — escala de fuente (1.0 = auto-máximo)

### `useCountdownStore` (persiste config)
- `config: CountdownConfig` — título, duración, tema visual
- `status / remainingTime` — estado en tiempo real

---

## Temporizador (`TimerView`)

Vista en el sidebar (usa `useCountdownStore`). Segmented Temporizador/Reloj:
cuenta atrás configurable o reloj en pantalla (12 h). Al iniciar/mostrar abre
la ventana de proyección. Píldora de estado "En pantalla · mm:ss".

## Avisos (`NoticesView`)

Vista en el sidebar. CRUD de avisos (solo local, localStorage/Dexie; sin sync
a Supabase). Dos modos de salida, con microcopy que los distingue:
- **Pantalla completa** por aviso (proyecta vía `loadSong`, título 'Aviso') — interrumpe lo proyectado.
- **Banda deslizante** (ticker) con todos los avisos, arriba/abajo — no interrumpe.

Tira "Ahora en pantalla" que refleja qué está proyectándose.

## Asistencia (`NotesView`)

Vista en el sidebar.

### Asistencia al culto
- Categorías personalizables (default: Caballeros, Damas, Amigos, Niños) + total automático
- Campo libre "Nombre del culto", predicador, tema
- Botón proyectar → `useProjectionStore.projectSlides('Asistencia', slides)`, que normaliza el estado (limpia media, muestra texto, aplica fondo favorito)
- Sync con Supabase `attendance_records` al guardar
- Toast verde de confirmación / toast rojo de error

### Historial
- Gráfico de barras apiladas (últimos 12 cultos)
- Tabla con fecha, nombre del culto, desglose y total

---

## Autenticación y Permisos

- Sin sesión: modo invitado, datos solo en Dexie local.
- Con sesión: escritura en Supabase gestionada por RLS.
- `userRole`: `'admin' | 'user' | null` — leído de tabla `profiles` mediante `loadProfile`.
- Migración automática `guest → userId` al autenticarse (en `App.tsx`) para canciones y notas.
- **Estabilidad**: El proceso de autenticación en `App.tsx` tiene un timeout de 6 segundos para evitar bloqueos por latencia de Supabase.

---

## Supabase — Tablas

| Tabla | Descripción |
|---|---|
| `songs` | Biblioteca de canciones (públicas y privadas) |
| `setlists` | Listas de canciones por servicio |
| `backgrounds` | Assets multimedia (imágenes/videos) para fondos |
| `profiles` | Perfil de usuario: `role`, `plan`, `terms_accepted` |
| `attendance_records` | Registros históricos de asistencia desglosada |
| `premium_interest` | Emails de usuarios interesados en el plan premium |
| `church_notes` | Notas del culto (soporte para migración de invitados) |

### Servicios Críticos

- **`supabase.ts`**:
  - `upsertChurchNote`: Sincroniza asistencia y notas.
  - `registerPremiumInterest`: Captura leads de la landing.
  - `syncTermsAcceptance`: Sincroniza la aceptación de términos en el perfil.
  - `createSong / updateSong`: CRUD con soporte para visibilidad pública.
- **`projection.ts`**: Orquestador de la comunicación entre ventanas.
- **`usePlan.ts`**: Lógica de negocio para límites freemium (hoy: `FOUNDING_PHASE = false`, el cobro está activo; ver `docs/COBRO.md`).

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
| Cloudflare Turnstile | Protección anti-bot en login y registro | `VITE_TURNSTILE_SITE_KEY` en `.env.local` |
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
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key
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
