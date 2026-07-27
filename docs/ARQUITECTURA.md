# Arquitectura de Proclama

## Visión General

Proclama es una aplicación web de código abierto para proyección de alabanzas y Biblia en iglesias. Está construida con React 18 + TypeScript + Vite 8 y sigue una arquitectura **offline-first** con persistencia local (IndexedDB) y sincronización opcional en la nube (Supabase).

---

## Principios de Arquitectura

| Principio | Descripción |
|-----------|-------------|
| **Offline-first** | Los datos se guardan primero en IndexedDB (Dexie), luego se sincronizan a Supabase si hay conexión |
| **Dos ventanas** | La app principal y la ventana de proyección se comunican vía BroadcastChannel |
| **Sin servidor propio** | Supabase es el único backend (Auth, DB, Storage); no hay servidor Node.js |
| **Modo invitado** | Funciona completamente sin cuenta; autenticación solo para sincronización y premium |
| **PWA** | Instalable en el dispositivo con soporte offline |

---

## Flujo de Datos

```
┌──────────────────────────────────────────────────────────┐
│                  FRONTEND (React)                         │
│                                                           │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
│  │ Library  │  │ Setlists │  │   Bible   │  │  Notes  │ │
│  │  View    │  │   View   │  │   View    │  │  View   │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────┬────┘ │
│       │              │              │              │       │
│  ┌────▼──────────────▼──────────────▼──────────────▼────┐ │
│  │                  Zustand Stores                      │ │
│  │  useAppStore · useProjectionStore · useCountdownStore│ │
│  └────────────────────────┬─────────────────────────────┘ │
│                           │                                │
│  ┌────────────────────────▼─────────────────────────────┐ │
│  │              Dexie (IndexedDB)                        │ │
│  │  songs · setlists · church_notes                     │ │
│  └────────────────────────┬─────────────────────────────┘ │
│                           │                                │
│  ┌────────────────────────▼─────────────────────────────┐ │
│  │           Supabase Client (supabase-js)               │ │
│  │  Auth · DB Queries · Realtime subscriptions          │ │
│  └────────────────────────┬─────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                      │
│  songs · setlists · profiles · backgrounds · song_reports   │
│  attendance_records · admin_logs · feedback                  │
│  user_devices · premium_interest                             │
└──────────────────────────────────────────────────────────────┘
```

### Comunicación entre Ventanas

La ventana principal y la ventana de proyección se comunican mediante **BroadcastChannel** (`proclama-projection`):

| Tipo | Dirección | Descripción |
|------|-----------|-------------|
| `PROJECTION_UPDATE` | Principal → Proyección | Estado completo (slides, tema, media) |
| `COUNTDOWN_UPDATE` | Principal → Proyección | Estado del contador regresivo |
| `NEXT_SLIDE` / `PREV_SLIDE` | Principal → Proyección | Navegación de estrofas |
| `GO_TO_SLIDE` | Principal → Proyección | Ir a estrofa específica |
| `MEDIA_COMMAND` | Principal → Proyección | Controlar reproducción de video |
| `MEDIA_STATUS` | Proyección → Principal | Estado de reproducción del video |
| `PING` / `PONG` | Bidireccional | Heartbeat para detectar ventana activa |

---

## Gestión de Estado

### useAppStore (Zustand + persist)
- **Persistencia**: localStorage
- **Estado**: auth (user, role, plan), vista activa, settings, sidebar, device control, terms, toast
- **Persiste**: settings, sidebar, onboarding, guestMode, terms

### useProjectionStore (Zustand + persist parcial)
- **Persistencia**: theme, `defaultBackgroundMediaId` y `pinnedBackgroundIds` en localStorage (`proclama-projection`)
- **Estado**: slides, currentSlide, theme, media, hideText, fondo activo y fondos fijados al recuadro
- **Uso**: estado de la proyección en tiempo real; proyectar media oculta la letra automáticamente (la letra solo se presenta sobre el fondo activo del recuadro)

### useCountdownStore (Zustand + persist)
- **Estado**: duración, título, colores del contador

---

## Persistencia

| Capa | Tecnología | Datos |
|------|-----------|-------|
| Local | Dexie 3 (IndexedDB) | songs, setlists, church_notes |
| Sesión | Zustand persist (localStorage) | settings, theme, guestMode, terms |
| Nube | Supabase (PostgreSQL) | songs, setlists, profiles, backgrounds, attendance |

### Estrategia de Sincronización (Offline-first)

1. El usuario crea/modifica datos localmente en Dexie
2. En segundo plano, se intenta sincronizar a Supabase
3. Si la sincronización falla, los datos quedan locales
4. `useSongsRealtime` Hook escucha cambios en Supabase y actualiza Dexie
5. La biblioteca también tiene un polling cada 30s como fallback

---

## Enrutamiento

No hay router. La navegación se maneja con `activeView` en `useAppStore`:

| Ruta | Vista |
|------|-------|
| `/` | App principal (vistas según `activeView`) |
| `/projection` | Ventana de proyección independiente |
| `/admin` | Panel de administración (lazy-loaded) |

La transición a `/admin` se detecta con `window.location.pathname.startsWith("/admin")` en `App.tsx`.

---

## Stack Tecnológico

| Categoría | Tecnología |
|-----------|-----------|
| Frontend | React 18 + TypeScript + Vite 8 |
| Estado | Zustand 4 + persist middleware |
| DB local | Dexie 3 (IndexedDB) |
| Backend | Supabase (Auth, DB, Realtime, Edge Functions) |
| UI | CSS Modules + Lucide React icons |
| Drag & Drop | @dnd-kit |
| PWA | vite-plugin-pwa |
| SSG | vite-react-ssg |
| Testing | Vitest + Testing Library |
| Charts | Recharts |
| PDF | jsPDF + autotable |

---

## Estructura del Proyecto

```
src/
├── admin/                    # Panel de administración
│   ├── AdminShell.tsx         # Shell con routing interno
│   ├── AdminGuard.tsx         # Protección de ruta (rol admin)
│   ├── AdminSidebar.tsx       # Navegación del admin
│   ├── pages/
│   │   ├── DashboardPage.tsx  # Estadísticas generales
│   │   ├── PendingSongsPage.tsx # Aprobación/rechazo de canciones
│   │   ├── GlobalLibraryPage.tsx # Biblioteca completa editable
│   │   ├── UsersPage.tsx      # Gestión de usuarios
│   │   ├── ReportsPage.tsx    # Reportes de usuarios
│   │   └── FeedbackPage.tsx   # Feedback de usuarios
│   └── services/
│       ├── adminQueries.ts    # Queries a Supabase
│       └── adminLogs.ts       # Registro de acciones admin
├── components/
│   ├── Sidebar.tsx            # Navegación lateral
│   ├── ControlPanel.tsx       # Panel de control en vivo
│   ├── MediaPanel.tsx         # Media local (anuncios) + pin de fondos
│   ├── BackgroundShelf.tsx    # Recuadro fijo de fondos de letra
│   ├── ProjectionPreview.tsx  # Vista previa de proyección
│   ├── SongEditorModal.tsx    # Editor de canciones
│   ├── PremiumFeatureModal.tsx # Modal de upsell premium
│   ├── ReportSongModal.tsx    # Reportar canción
│   ├── DeviceBlockedModal.tsx # Límite de dispositivos
│   ├── OnboardingFlow.tsx     # Tour guiado inicial
│   ├── TermsModal.tsx         # Modal de términos y condiciones
│   └── ConfirmDialog.tsx      # Diálogo de confirmación genérico
├── pages/
│   ├── LandingView.tsx        # Landing page con login/registro
│   ├── LibraryView.tsx        # Biblioteca de canciones
│   ├── SetlistsView.tsx       # Gestión de setlists
│   ├── BibleView.tsx          # Biblia RVR1960
│   ├── TimerView.tsx          # Temporizador + reloj en pantalla
│   ├── NoticesView.tsx        # Avisos + banda deslizante
│   ├── NotesView.tsx          # Asistencia al culto
│   ├── SettingsView.tsx       # Configuración
│   ├── FondosView.tsx         # Gestión de fondos
│   └── ProjectionWindow.tsx   # Ventana de proyección
├── hooks/
│   ├── useSongsRealtime.ts    # Sincronización Supabase → Dexie
│   ├── usePlan.ts             # Lógica freemium
│   ├── useKeyboardShortcuts.ts # Atajos de teclado
│   └── useProjectionFontSize.ts # Cálculo de tamaño de fuente
├── services/
│   ├── supabase.ts            # Cliente Supabase + CRUD
│   ├── projection.ts          # Comunicación BroadcastChannel
│   ├── bible.ts               # Lógica de búsqueda bíblica
│   ├── lyricsParser.ts        # Parseo de letras a estrofas
│   └── attendanceSync.ts      # Sincronización de asistencia
├── stores/
│   └── index.ts               # AppStore + ProjectionStore
├── db/
│   └── index.ts               # Esquema Dexie (v11)
├── types/
│   └── index.ts               # Tipos globales
└── utils/
    ├── deviceFingerprint.ts   # Fingerprint para control de dispositivos
    ├── backgroundShelf.ts     # Helpers puros del recuadro de fondos
    └── fileUpload.ts          # Utilidades de carga de archivos
```

---

## Funcionalidades Clave

### Biblioteca de Canciones
- CRUD completo con persistencia local Dexie + Supabase
- Catálogo comunitario (+3.000 canciones): búsqueda pública e importación
- Visibilidad: pública (requiere moderación) o privada
- Publicar canciones locales a la comunidad
- Sincronización en tiempo real entre dispositivos

### Proyección en Vivo
- Ventana independiente en monitor extendido
- Canvas 1920×1080 con auto-ajuste de fuente
- Fondos: color sólido, imagen o video con blur y overlay
- Recuadro fijo de fondos de letra: imágenes fijadas con 📌 desde la media local; la activa recibe toda letra/versículo
- Proyectar un anuncio (imagen/video/YouTube) oculta la letra automáticamente; quitarlo o navegar estrofas la restaura
- Navegación entre estrofas y pantalla negra

### Setlists
- Crear y ordenar canciones para servicios
- Arrastrar y soltar para reordenar
- Carga rápida de canciones a proyección

### Biblia (RVR1960)
- Navegación por libros y capítulos
- Búsqueda por texto o referencia (ej. "Juan 3:16")
- Proyección inmediata de versículos

### Temporizador
- Cuenta atrás configurable o reloj en pantalla (12 h)
- Tema visual independiente sincronizado con la proyección

### Avisos
- CRUD de avisos, solo local (sin sync a Supabase)
- Dos modos: pantalla completa (interrumpe) o banda deslizante (no interrumpe)

### Asistencia al Culto
- Registro con categorías configurables
- Historial con gráficos (Recharts)
- Exportación a CSV/PDF

### Panel de Administración (`/admin`)
- Dashboard con estadísticas
- Moderación de canciones pendientes
- Biblioteca global editable
- Gestión de usuarios
- Reportes de usuarios
- Feedback

---

## Modelo Freemium

El sistema tiene un flag `FOUNDING_PHASE = true` en `usePlan.ts`. Mientras esté activo, todos los usuarios tienen acceso premium.

**Características premium**:
- Sincronización en la nube (Supabase)
- Fondos multimedia (video/imagen)
- Exportación de reportes
- Más slots de proyección

**Límites free** (cuando se active):
- 10 canciones propias
- 50 canciones proyectables
- 5 archivos multimedia (200MB total)
