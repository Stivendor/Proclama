# Proclama

Sistema de proyección de alabanzas y Biblia para iglesias, construido con React 18, TypeScript y Vite 8.
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
9. [Seguridad y Operacion](#seguridad-y-operacion)
10. [Scripts](#scripts)
11. [Atajos de Teclado](#atajos-de-teclado)

---

## Resumen

Proclama reúne en una sola aplicación web:

- Biblioteca de canciones con almacenamiento local y sincronización con Supabase.
- Creación y administración de setlists para servicios.
- Proyección en ventana separada para TV o proyector con auto-ajuste de fuente.
- Biblia integrada (RVR1960) con búsqueda por texto, libro o referencia.
- Temporizador (cuenta atrás) y reloj en pantalla, con proyección en tiempo real.
- Avisos proyectables: a pantalla completa o en banda deslizante.
- Asistencia con categorías configurables, historial y exportación.
- Fondos dinámicos personalizables (Color, Imagen, Video) con controles de Blur y Filtro de Oscuridad.
- Recuadro fijo de fondos de letra: fija imágenes de tu media local y elige cuál recibe toda letra proyectada.
- Panel de control responsivo con controles de media, ajustes de proyección y vista previa en tiempo real.
- Panel de control en vivo optimizado con navegación rápida de estrofas y versículos.
- PWA instalable con soporte offline.

---

## Funcionalidades

### Biblioteca de canciones

- Crear, editar y eliminar canciones con confirmación.
- Buscar por título, artista, letra y etiquetas.
- Elegir visibilidad: pública (requiere moderación) o privada.
- Publicar canciones locales a la comunidad para compartirlas.
- Persistencia local con Dexie para trabajar sin sesión.
- Sincronización en tiempo real con Supabase cuando hay sesión.
- Estados visuales: verificada (escudo), pendiente (reloj), privada (candado).

### Setlists

- Crear setlists para cada servicio o reunión.
- Sincronización automática con la nube.
- Agregar canciones desde la biblioteca local o remota.
- Reordenar canciones con drag and drop (@dnd-kit).
- Activar una canción directamente desde el setlist con carga rápida a proyección.

### Biblia integrada (RVR1960)

- Navegación por libros y capítulos (AT y NT).
- Selector de capítulos tipo bento grid — clic directo al capítulo.
- Búsqueda global por texto o referencia directa (ej: `Juan 3:16`).
- Proyección inmediata de versículos y pasajes completos.
- Recordatorio de última posición en la sesión.

### Proyección en vivo

- Ventana independiente para proyector o segunda pantalla (soporta Window Management API).
- Apertura automática en monitor extendido.
- Canvas fijo 1920×1080 con auto-ajuste de fuente matemático (sin DOM).
- Navegación inteligente entre estrofas con teclado (`→` `←` `Espacio`).
- Pantalla negra (`B`), modo ocultar texto y logo flotante.
- Fondos personalizables: color sólido, imagen o video con blur y overlay de oscuridad.
- Recuadro fijo de fondos de letra (`BackgroundShelf`): imágenes fijadas con 📌 desde la media local; la activa recibe toda letra/versículo y persiste entre sesiones.
- Proyectar un anuncio (imagen/video/YouTube) oculta la letra automáticamente; quitarlo o navegar estrofas la restaura.
- Ajuste de escala de fuente manual (0.4x - 1.5x).
- Panel de controles responsivo que se adapta a diferentes resoluciones y zoom.

### Temporizador (vista "Temporizador")

- Cuenta atrás con título y duración exacta, o reloj en pantalla (12 h).
- Tema visual independiente sincronizado con la proyección.
- Vista previa interna y proyección a pantalla completa.

### Avisos (vista "Avisos")

- Crear/editar/eliminar avisos proyectables.
- Dos modos: **pantalla completa** (interrumpe lo proyectado) o **banda deslizante** (cinta continua con todos los avisos, sin interrumpir).
- Posición de la banda arriba/abajo.

### Asistencia (vista "Asistencia")

- Registro desglosado por categorías personalizables (ej: Caballeros, Damas, Niños, Amigos), editables en la UI.
- **Categorías configurables**: Agregar/eliminar/editar nombres desde la misma sección.
- **Proyección**: Muestra todas las categorías con totales automáticos durante el culto.
- **Historial**: Gráfico de barras segmentado por categoría (Recharts) + tabla completa.
- **Exportación**: Reporte CSV con estadísticas, promedios y PDF.

### Panel de Administración (`/admin`)

- **Dashboard**: Estadísticas generales (usuarios, canciones, reportes, feedback).
- **Pendientes**: Moderación de canciones — aprobar, rechazar (con motivo) o editar antes de aprobar. Aprobación masiva con checkbox.
- **Biblioteca Global**: Tabla paginada de todas las canciones con búsqueda y filtros. Alternar verificación, editar o eliminar.
- **Usuarios**: Lista de usuarios con filtros. Cambiar rol (admin/user) y plan (free/premium).
- **Reportes**: Reportes de usuarios sobre canciones inapropiadas.
- **Feedback**: Comentarios de usuarios con filtro por estado.
- Auditoría completa: todas las acciones se registran en `admin_logs`.

### Control de Dispositivos

- Registro automático de dispositivos por huella digital.
- Gestión y revocación de dispositivos desde configuración.

### Autenticación y Seguridad

- Login exclusivo con Google OAuth via Supabase Auth.
- Soporte MFA (TOTP) con código QR.
- Términos y condiciones con control de versión.
- Cierre de sesión atómico — limpia estado global y local.

### Estabilidad y Robustez

- **Arranque Seguro**: Timer de 6 segundos que libera la pantalla de carga ante fallos de red.
- **Modo Offline**: PWA completamente funcional; trabaja en local y sincroniza al reconectar.
- **Sin dependencias de servidor propio**: Solo Supabase como backend.

### UX y Onboarding

- Tour guiado dinámico interactivo para nuevos usuarios.
- Acceso inmediato como invitado sin cuenta.
- Diseño "Premium Dark Mode" optimizado para entornos de poca luz (iglesias).
- Atajos de teclado completos.
- Toast de notificaciones para feedback de acciones.

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

- `Dexie` (IndexedDB): canciones, setlists, notas del culto (local/offline).
- `Zustand persist` (localStorage): configuración, tema, modo invitado, onboarding.
- `Supabase`: canciones y setlists sincronizados en la nube.

---

## Tecnologías

| Categoría | Tecnología |
|-----------|-----------|
| Frontend | React 18, TypeScript, Vite 8 |
| Estado global | Zustand 4 |
| Persistencia local | Dexie 3 (IndexedDB) |
| Autenticación y nube | Supabase |
| UI e iconografía | CSS personalizado, Lucide React |
| Drag and drop | @dnd-kit/core, @dnd-kit/sortable |
| Routing | react-router-dom 7 |
| PWA | vite-plugin-pwa |
| SSG | vite-react-ssg |
| Observabilidad | @vercel/analytics, @vercel/speed-insights |

---

## Estructura del Proyecto

```
src/
├── admin/                    # Panel de administración (/admin)
│   ├── AdminShell.tsx         # Layout + routing
│   ├── AdminGuard.tsx         # Protección por rol
│   ├── AdminSidebar.tsx       # Navegación lateral admin
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── PendingSongsPage.tsx
│   │   ├── GlobalLibraryPage.tsx
│   │   ├── UsersPage.tsx
│   │   ├── ReportsPage.tsx
│   │   └── FeedbackPage.tsx
│   └── services/
│       ├── adminQueries.ts
│       └── adminLogs.ts
├── pages/
│   ├── LandingView.tsx       # Landing + login (Google)
│   ├── LibraryView.tsx       # Biblioteca de canciones
│   ├── SetlistsView.tsx      # Gestión de setlists
│   ├── BibleView.tsx         # Biblia RVR1960
│   ├── TimerView.tsx         # Temporizador + reloj en pantalla
│   ├── NoticesView.tsx       # Avisos + banda deslizante
│   ├── NotesView.tsx         # Asistencia al culto
│   ├── FondosView.tsx        # Gestión de fondos
│   ├── SettingsView.tsx      # Configuración
│   └── ProjectionWindow.tsx  # Ventana de proyección
├── components/
│   ├── Sidebar.tsx           # Navegación lateral principal
│   ├── ControlPanel.tsx      # Panel de control en vivo
│   ├── MediaPanel.tsx        # Media local (anuncios) + pin de fondos
│   ├── BackgroundShelf.tsx   # Recuadro fijo de fondos de letra
│   ├── ProjectionPreview.tsx # Vista previa del operador
│   ├── SongEditorModal.tsx   # Editor de canciones
│   ├── PremiumFeatureModal.tsx # Upsell premium
│   ├── ReportSongModal.tsx   # Reportar canción
│   ├── DeviceBlockedModal.tsx # Límite de dispositivos
│   ├── OnboardingFlow.tsx    # Tour guiado de bienvenida
│   ├── TermsModal.tsx        # Términos y condiciones
│   ├── VideoControls.tsx     # Controles de video
│   └── ConfirmDialog.tsx     # Diálogo de confirmación
├── stores/
│   ├── index.ts              # AppStore + ProjectionStore
│   └── countdown.ts          # CountdownStore
├── services/
│   ├── supabase.ts           # Cliente Supabase + CRUD
│   ├── projection.ts         # BroadcastChannel
│   ├── bible.ts              # Lógica bíblica
│   ├── lyricsParser.ts       # Parser de estrofas
│   └── attendanceSync.ts     # Sincronización de asistencia
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useSongsRealtime.ts   # Sincronización Supabase → Dexie
│   ├── usePlan.ts            # Lógica freemium
│   └── useProjectionFontSize.ts
├── db/
│   └── index.ts              # Dexie: songs, setlists, church_notes
├── data/
│   └── bible-rvr1960.json    # RVR1960 completa (~31K versículos, chunk lazy)
├── types/
│   └── index.ts              # Tipos TypeScript globales
├── utils/
│   ├── deviceFingerprint.ts  # Fingerprint para control dispositivos
│   └── fileUpload.ts         # Carga de archivos
└── test/                     # Tests
    └── ...
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

Crea un archivo `.env.local` a partir de la plantilla:

```bash
cp .env.example .env.local
```

Las variables requeridas para desarrollo:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Los secretos de servidor (API Bible, Service Role) se configuran directamente en Supabase Edge Functions con `supabase secrets set`, nunca en Vite.

Notas de seguridad:

- Las variables con prefijo `VITE_` son públicas para el navegador. **Nunca** pongas tokens privados, service role keys o access tokens con ese prefijo.
- Ver `.env.example` para la lista completa de variables disponibles.

- Supabase es necesario para autenticación y sincronización en la nube.
- La app funciona completamente sin login en modo invitado (datos locales).

---

---

## Base de Datos Supabase (Tablas Principales)

- `songs`: Catálogo de canciones.
- `setlists`: Listas de canciones planificadas.
- `profiles`: Datos de usuario y preferencias.
- `backgrounds`: Fondos (imágenes/videos) compartidos para la proyección. El catálogo guarda solo URLs
  públicas (hotlink), no archivos: las imágenes y los videos vienen de Pexels — ver
  `scripts/seed-pexels-videos.mjs` — y opcionalmente de un bucket R2 propio para clips personalizados.

> [!NOTE]
> **Notas del Culto**: Los avisos e historial de notas son estrictamente locales (IndexedDB/Dexie). No se sincronizan.
> 
> **Registro de Asistencia**: Se almacena localmente en Dexie y se sincroniza con Supabase (tabla `attendance_records`) para disponibilidad entre dispositivos del mismo usuario. La sincronización ocurre al guardar un registro y al iniciar sesión (pull + push).

---

## Seguridad y Operacion

- Ejecuta `npm audit --omit=dev` antes de publicar una version.
- Manten `supabase/.temp/`, `.env.local`, logs locales y dumps fuera del control de versiones.
- Las funciones premium del cliente son controles de interfaz; cualquier permiso real debe validarse con RLS, Supabase Auth o Edge Functions.
- Las tablas con datos por usuario deben tener RLS activo y policies versionadas en migraciones.
- IndexedDB y localStorage no estan cifrados: evita guardar secretos o datos que no deban quedar en el dispositivo.
- **Modelo de lanzamiento**: la fase fundadores (`FOUNDING_PHASE = true` en `src/hooks/usePlan.ts`, premium gratis para todos) terminó. Hoy el flag está en `false` y los planes de pago están activos; las cuentas que venían de esa fase recibieron 90 días de gracia. Runbook en `docs/COBRO.md`.

---

## Configuración de Búsqueda Optimizada (FTS)

Para habilitar la búsqueda por letra ignorando acentos y tildes:
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Crear configuración personalizada en español sin acentos
DO $$ BEGIN
  CREATE TEXT SEARCH CONFIGURATION public.spanish_unaccent (COPY = spanish);
  ALTER TEXT SEARCH CONFIGURATION public.spanish_unaccent
    ALTER MAPPING FOR hword, hword_part, word WITH unaccent, spanish_stem;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

---

## Scripts

```bash
npm run dev       # Servidor de desarrollo (Vite)
npm run build     # Build de producción (tsc + vite-react-ssg)
npm run preview   # Vista previa del build estático
npm run test      # Tests unitarios (Vitest)
npm run test:watch # Tests en modo watch
npm run test:ui   # Tests con interfaz UI Vitest
```

---

## Atajos de Teclado

| Tecla | Acción |
|---|---|
| `Alt` + `1`…`8` | Saltar a la vista n del menú lateral |
| `Alt` + `N` | Nueva canción |
| `Alt` + `B` | Ocultar el texto (funciona en todas las vistas) |
| `→` `↓` `Espacio` `PageDown` | Slide siguiente (en Biblia, solo → Espacio PageDown proyectan versículo siguiente) |
| `←` `↑` `PageUp` | Slide anterior (en Biblia, solo ← PageUp proyecta versículo anterior) |
| `T` | Ocultar el texto (no aplica en la Biblia) |
| `Esc` | Volver a mostrar el texto |
| `?` | Ver esta lista dentro de la app |

Los atajos no actúan mientras el foco está en un campo de texto. En la vista Biblia, cualquier letra o número abre la búsqueda rápida de pasaje.

---

---

## Documentación adicional

| Documento | Descripción |
|-----------|-------------|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Arquitectura detallada, flujo de datos, stores, componentes |
| [docs/SUPABASE.md](docs/SUPABASE.md) | Esquema de base de datos, RLS, migraciones, Edge Functions |
| [docs/ADMIN.md](docs/ADMIN.md) | Guía del panel de administración |

---

Hecho con amor para servir al Reino de Dios.
