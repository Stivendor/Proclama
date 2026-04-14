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
- Buscar e importar letras online (Genius/lrclib).
- Persistencia local con Dexie para trabajar sin sesión.
- Sincronización atómica con Supabase cuando hay sesión iniciada (incluye políticas RLS).

### Setlists

- Crear setlists para cada servicio o reunión.
- Sincronización automática con la nube.
- Agregar canciones desde la biblioteca local o remota.
- Reordenar canciones con drag and drop.
- Activar una canción directamente desde el setlist con carga rápida.

### Biblia integrada

- Navegación por libros y capítulos (AT y NT) RVR1960.
- Selector de capítulos tipo bento grid — clic directo al capítulo.
- Búsqueda global por texto o referencia directa (`Juan 3:16`).
- Proyección inmediata de versículos y pasajes con recordatorio de última posición.
- Historial de versículos proyectados en la sesión actual.

### Proyección en vivo

- Ventana independiente para proyector o segunda pantalla (soporta Window Management API).
- Apertura automática en monitor extendido.
- Canvas fijo (1920×1080 / 1024×768) con auto-ajuste de fuente matemático (no-DOM).
- Navegación inteligente entre estrofas.
- Pantalla negra (`B`), modo ocultar texto y logo flotante.
- Fondos personalizables: color, imagen o video con blur, oscuridad y overlay dinámico.
- Ajuste de escala de fuente manual (0.4x - 1.5x) para optimización en tiempo real.

### Contador regresivo

- Configuración de título y duración exacta.
- Tema visual independiente sincronizado con la proyección.
- Vista previa interna y proyección a pantalla completa.

### Notas del culto

- **Asistencia**: Registro desglosado (Caballeros, Damas, Amigos, Niños) con totales automáticos.
- **Sincronización**: Los datos se suben a Supabase y se migran automáticamente de invitado a usuario tras el login.
- **Avisos**: Gestión de anuncios comunitarios con proyección individual de alta legibilidad.
- **Historial**: Tablas y gráficos estadísticos de los últimos cultos.

### Estabilidad y Robustez (Core)

- **Arranque Seguro**: El sistema dispone de un temporizador de seguridad de 6 segundos que libera la pantalla de carga ante fallos de red.
- **Sesión Atómica**: El cierre de sesión (`logout`) limpia de forma inmediata todos los estados (Zustand + local) para garantizar la privacidad.
- **Modo Offline**: PWA completamente funcional; trabaja en local y sincroniza en cuanto detecta conexión y cuenta de usuario.

### UX y Onboarding

- Tour guiado dinámico para nuevos usuarios.
- Acceso inmediato en modo invitado sin necesidad de cuenta.
- Diseño "Premium Dark Mode" optimizado para entornos de poca luz (iglesias).
- Accesibilidad mejorada y soporte completo de teclado.

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

---

---

## Base de Datos Supabase (Tablas Principales)

- `songs`: Catálogo de canciones.
- `setlists`: Listas de canciones planificadas.
- `profiles`: Datos de usuario y preferencias.
- `backgrounds`: Fondos (imágenes/videos) compartidos para la proyección.

> [!NOTE]
> **Privacidad Local**: Las funciones de **Notas del Culto** y **Registro de Asistencia** son estrictamente locales (IndexedDB/Dexie). Estos datos NO se sincronizan con Supabase por privacidad y preferencia del usuario.

---

## Configuración de Búsqueda Optimizada (FTS)

Para habilitar la búsqueda por letra ignorando acentos y tildes (necesario para la función "Buscar online"):
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
