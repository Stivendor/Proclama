# Proclama

Sistema de proyección de alabanzas y Biblia para iglesias, construido con React 18, TypeScript y Vite 6.  
Funciona directamente en el navegador, sin instalación, con soporte para uso local, sincronización opcional en la nube y una ventana de proyección independiente.

---

## Índice

1. [Resumen](#resumen)
2. [Cambios Recientes](#cambios-recientes)
3. [Funcionalidades](#funcionalidades)
4. [Arquitectura](#arquitectura)
5. [Tecnologías](#tecnologías)
6. [Estructura del Proyecto](#estructura-del-proyecto)
7. [Instalación](#instalación)
8. [Variables de Entorno](#variables-de-entorno)
9. [Scripts](#scripts)
10. [Atajos de Teclado](#atajos-de-teclado)
11. [Estado Actual](#estado-actual)
12. [Propósito](#propósito)

---

## Resumen

Proclama reúne en una sola aplicación web:

- Biblioteca de canciones con almacenamiento local y sincronización con Supabase.
- Creación y administración de setlists para servicios.
- Proyección en ventana separada para TV o proyector.
- Biblia integrada con búsqueda por texto, libro o referencia.
- Contador regresivo personalizable con proyección en tiempo real.
- Fondos personalizables con color, imagen o video.
- Importación, exportación y búsqueda online de letras.
- Panel de control en vivo con navegación rápida de estrofas y versículos.


---

## Cambios Recientes

### Acceso sin autenticación (modo invitado)

- La aplicación ya no bloquea el acceso hasta que el usuario inicie sesión.
- Al entrar, el usuario puede elegir continuar como invitado (`guestMode`) o autenticarse con Supabase.
- El estado `guestMode` se persiste en `localStorage` mediante Zustand para mantener la sesión entre recargas.
- La landing page (`LandingView`) actúa como punto de entrada cuando no hay sesión activa ni modo invitado.

### Flujo de onboarding guiado

- Se incorporó `OnboardingFlow`, un tour interactivo de 4 pasos que se muestra al primer uso.
- El tour usa un spotlight animado que resalta el elemento objetivo en pantalla.
- Incluye un tooltip posicionado dinámicamente (derecha, izquierda, arriba o abajo) con navegación por teclado (`←`, `→`, `Enter`).
- El estado `onboardingDone` se persiste en `localStorage`; el tour no vuelve a mostrarse una vez completado.
- El tour no puede cerrarse con `Escape` para asegurar que el usuario lo complete.

### Contador regresivo (`CountdownView`)

- Nueva pestaña en la navegación principal dedicada al contador regresivo.
- Configuración de título, duración en minutos y segundos.
- Controles de inicio, pausa, reanudación y reinicio.
- Tema visual independiente: fondo por color, imagen o video, fuente, color de texto, color del contador, sombra y desenfoque.
- Vista previa en tiempo real dentro de la misma pestaña.
- El estado del contador se transmite a la ventana de proyección mediante `BroadcastChannel`.
- La ventana de proyección prioriza el countdown sobre los slides cuando el contador está activo.
- La configuración del tema se persiste entre sesiones con Zustand + `localStorage`.

### Ventana de proyección mejorada

- Soporte para renderizar tanto slides de canciones/Biblia como el contador regresivo en la misma ventana.
- Algoritmo de ajuste automático de tamaño de fuente (`fontSizeMax`) mediante búsqueda binaria para evitar desbordamiento de texto.
- El tamaño de fuente manual queda limitado por el tamaño máximo calculado automáticamente.
- Soporte de fondo por color, imagen con blur, video en loop y overlay de oscurecimiento configurable.
- Media (imágenes y videos de anuncios) puede mostrarse en modo pantalla completa o como fondo detrás del texto.
- Indicador discreto de número de estrofa en la esquina inferior.
- Cursor oculto automáticamente en la ventana de proyección.
- Intento de pantalla completa automático al abrir la ventana.

### Tipos extendidos (`BroadcastMessage`)

- Se añadió el mensaje `COUNTDOWN_UPDATE` con payload `CountdownState` para sincronizar el contador con la ventana de proyección.
- Se añadió `MEDIA_STATUS` para reportar el estado de reproducción de video desde la ventana de proyección hacia la ventana principal.
- Se añadió `MEDIA_COMMAND` para controlar reproducción, pausa y seek del video desde el panel de control.

### Diálogo de confirmación (`ConfirmDialog`)

- Componente reutilizable para confirmar acciones destructivas (eliminaciones, etc.).
- Foco automático en el botón "Cancelar" al abrirse para prevenir eliminaciones accidentales.
- Cierre con `Escape` o clic fuera del modal.
- Soporte para modo peligroso (`danger`) que muestra el botón de confirmación en rojo.

### SEO y posicionamiento web

- Meta tags Open Graph y Twitter Card completos en `index.html`.
- Schema.org `SoftwareApplication` con JSON-LD para motores de búsqueda.
- `sitemap.xml` y `robots.txt` en `public/`.
- Pre-rendering estático (SSG) con `vite-react-ssg` para que los crawlers indexen el contenido de la landing.
- Landing page con jerarquía semántica correcta (`h1` único, secciones con `h2`).
- Keywords long-tail integradas de forma natural en el contenido visible.
- CTA principal actualizado a "Usar gratis ahora".

### Observabilidad y rendimiento

- Integración de `@vercel/analytics` para métricas de uso.
- Integración de `@vercel/speed-insights` para monitoreo de rendimiento en producción.
- PWA configurada con `vite-plugin-pwa`: caché de assets, soporte offline y manifest completo.

---

## Funcionalidades

### Biblioteca de canciones

- Crear, editar, cargar y eliminar canciones con confirmación antes de eliminar.
- Buscar por título, artista, letra y etiquetas.
- Importar y exportar la biblioteca en JSON.
- Buscar letras online e incorporarlas al flujo de trabajo.
- Persistencia local con Dexie para trabajar sin sesión activa.
- Sincronización con Supabase cuando hay sesión iniciada.

![Biblioteca](image.png)

### Setlists

- Crear setlists para cada servicio o reunión.
- Agregar canciones desde la biblioteca local.
- Reordenar canciones con drag and drop (`@dnd-kit`).
- Activar una canción directamente desde el setlist.
- Guardado local sin cuenta y sincronización en Supabase con sesión.

![Setlists](image-1.png)

### Biblia integrada

- Navegación por libros y capítulos (Antiguo y Nuevo Testamento).
- Búsqueda global por texto o referencia directa, por ejemplo `Juan 3:16`.
- Proyección inmediata de un versículo o pasaje.
- Vista previa del contenido en proyección desde el panel de control.

![Biblia](image-2.png)

### Proyección en vivo

- Apertura de ventana independiente para proyector o segunda pantalla.
- Navegación entre estrofas y versículos desde el panel de control.
- Pantalla negra y modo de solo fondo (ocultar texto).
- Tema configurable en tiempo real: fuente, tamaño, color, sombra, transición.
- Soporte de fondos por color, imagen y video con blur y overlay de oscurecimiento.
- Ajuste automático de tamaño de fuente para evitar desbordamiento.
- Posición del título configurable: arriba, abajo o ninguna.
- Posición de la referencia bíblica configurable: arriba o abajo.

![Proyección](image-3.png)

### Contador regresivo

- Pestaña dedicada en la navegación principal.
- Configuración de título y duración (minutos y segundos).
- Controles de inicio, pausa, reanudación y reinicio.
- Tema visual independiente con las mismas opciones que la proyección principal.
- Vista previa en tiempo real dentro de la pestaña de configuración.
- Proyección en la ventana de proyección existente, sin ventana adicional.

### Media y personalización

- Carga de imágenes y videos locales para anuncios o fondos temporales.
- Control de reproducción de video (play, pause, seek) desde el panel de control.
- Modo fondo: el media se muestra detrás del texto en lugar de pantalla completa.
- Vista previa del tema desde ajustes.
- Configuración de tipografía, tamaño, sombra, color y transición.

### Onboarding y UX

- Tour guiado de 4 pasos para nuevos usuarios con spotlight animado.
- Confirmaciones antes de acciones destructivas.
- Navegación por teclado en el tour y en los diálogos.
- Accesibilidad mejorada: roles ARIA, `aria-label`, `aria-modal`, foco gestionado.

---

## Arquitectura

### Comunicación entre ventanas

La ventana principal y la ventana de proyección se comunican mediante `BroadcastChannel` (canal `proclama-projection`). Los mensajes disponibles son:

| Tipo | Dirección | Descripción |
|------|-----------|-------------|
| `PROJECTION_UPDATE` | Principal → Proyección | Estado completo de la proyección (slides, tema, media) |
| `COUNTDOWN_UPDATE` | Principal → Proyección | Estado del contador regresivo |
| `NEXT_SLIDE` / `PREV_SLIDE` | Principal → Proyección | Navegación de estrofas |
| `GO_TO_SLIDE` | Principal → Proyección | Ir a una estrofa específica |
| `MEDIA_COMMAND` | Principal → Proyección | Controlar reproducción de video |
| `MEDIA_STATUS` | Proyección → Principal | Estado de reproducción del video |
| `PING` / `PONG` | Bidireccional | Verificar que la ventana de proyección está activa |

### Estado global

- `useAppStore` (Zustand + persist): configuración de la app, estado de autenticación, vista activa, modo invitado, onboarding, fondos.
- `useProjectionStore` (Zustand): estado de la proyección en tiempo real (slides, tema, media).
- `useCountdownStore` (Zustand + persist): configuración y estado del contador regresivo.

### Persistencia

- `Dexie` (IndexedDB): canciones y setlists locales.
- `Zustand persist` (localStorage): configuración de la app, tema, modo invitado, onboarding, configuración del countdown.
- `Supabase`: canciones y setlists sincronizados en la nube cuando hay sesión activa.

---

## Tecnologías

| Categoría | Tecnología |
|-----------|-----------|
| Frontend | React 18, TypeScript, Vite 6 |
| Estado global | Zustand 4 |
| Persistencia local | Dexie 3 (IndexedDB) |
| Autenticación y nube | Supabase |
| UI e iconografía | CSS personalizado, Lucide React |
| Drag and drop | @dnd-kit/core, @dnd-kit/sortable |
| PWA | vite-plugin-pwa |
| SSG | vite-react-ssg |
| Observabilidad | @vercel/analytics, @vercel/speed-insights |
| Búsqueda de letras | Genius API |

---

## Estructura del Proyecto

```
src/
├── pages/              # Vistas principales
│   ├── LandingView.tsx       # Página de entrada (sin sesión)
│   ├── AuthView.tsx          # Formulario de autenticación
│   ├── LibraryView.tsx       # Biblioteca de canciones
│   ├── SongEditor.tsx        # Editor de canciones
│   ├── SetlistsView.tsx      # Gestión de setlists
│   ├── BibleView.tsx         # Biblia integrada
│   ├── CountdownView.tsx     # Contador regresivo
│   ├── SettingsView.tsx      # Ajustes de la app
│   └── ProjectionWindow.tsx  # Ventana de proyección
├── components/         # Componentes reutilizables
│   ├── Sidebar.tsx           # Navegación lateral
│   ├── ControlPanel.tsx      # Panel de control en vivo
│   ├── MediaPanel.tsx        # Panel de media local
│   ├── OnboardingFlow.tsx    # Tour guiado de bienvenida
│   ├── OnlineSearchModal.tsx # Búsqueda online de letras
│   ├── VideoControls.tsx     # Controles de video
│   └── ConfirmDialog.tsx     # Diálogo de confirmación
├── stores/             # Estado global (Zustand)
│   ├── index.ts              # AppStore + ProjectionStore
│   └── countdown.ts          # CountdownStore
├── services/           # Integraciones externas
│   ├── supabase.ts           # Cliente y helpers de Supabase
│   ├── projection.ts         # BroadcastChannel y apertura de ventana
│   ├── bible.ts              # Lógica de búsqueda bíblica
│   ├── lyricsParser.ts       # Parser de estrofas
│   └── genius.ts             # Búsqueda de letras en Genius
├── hooks/              # Hooks personalizados
│   └── useKeyboardShortcuts.ts
├── db/                 # Persistencia local
│   └── index.ts              # Esquema Dexie (canciones, setlists)
├── data/               # Datos estáticos
│   └── bible-content.ts      # Contenido bíblico
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

Crea un archivo `.env.local` con:

```bash
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
```

Notas:

- Supabase es necesario para autenticación y sincronización en la nube.
- La app puede usarse completamente sin login en modo invitado (flujo local).
- El token de Genius y las credenciales de ACRCloud se configuran desde la pantalla de ajustes, no desde `.env`.

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

## Estado Actual

La aplicación cuenta con una base sólida de uso real:

- Acceso inmediato sin bloqueo por autenticación.
- Biblioteca local y sincronizada con Supabase.
- Setlists editables con drag and drop.
- Biblia integrada con búsqueda y proyección.
- Contador regresivo con proyección en tiempo real.
- Ventana de proyección separada con ajuste automático de fuente.
- Media local para anuncios (imágenes y videos).
- Personalización visual completa del tema de proyección.
- Onboarding guiado para nuevos usuarios.
- PWA instalable con soporte offline.
- SEO optimizado con SSG, meta tags y Schema.org.

---

## Propósito

Proclama busca ofrecer una herramienta moderna, ligera y accesible para la proyección en iglesias, reduciendo barreras de costo y permitiendo un flujo de trabajo simple desde el navegador.

Hecho con amor para servir al Reino de Dios.
