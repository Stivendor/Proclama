# Diseño: separar "Notas y más" en dos vistas (Temporizador + Avisos)

Fecha: 2026-07-26

## Problema

La vista "Notas y más" (`src/pages/CountdownView.tsx`) es un cajón de sastre.
El nombre no describe el contenido — "y más" admite la mezcla. Reúne cuatro
herramientas sin relación clara entre sí:

- Cuenta atrás (temporizador pre-servicio)
- Reloj en pantalla
- Avisos a pantalla completa (botón por aviso)
- Banda deslizante (cinta con todos los avisos)

Único hilo común: "sale en la proyección". Consecuencias UX:

1. Crisis de identidad: el usuario no sabe qué es la sección hasta entrar.
2. Dos modelos mentales (tiempo vs avisos) forzados en una vista plana.
3. En Avisos, dos formas de mostrar un aviso (pantalla completa vs banda) sin
   explicación de cuándo usar cada una.
4. Casi cero onboarding: solo el modo Reloj tiene texto guía.
5. Feedback de estado disperso (píldora "En pantalla" solo en el timer).

## Objetivo

Separar en dos vistas de propósito único, con nombres honestos y microcopy
que enseñe al usuario cómo y cuándo usar cada herramienta. No cambiar la
lógica de proyección, stores ni la vista de Asistencia.

## Decisiones tomadas (brainstorming)

- **Separación:** dos entradas de sidebar distintas — "Temporizador" y
  "Avisos". Cada vista = una sola herramienta conceptual.
- **Modos de aviso:** mantener AMBOS (pantalla completa por aviso + banda
  deslizante global), pero explicarlos claramente con microcopy, sin modal.

## Alcance

### 1. Navegación / routing

- Sidebar (`src/components/layout/Sidebar.tsx`): quitar la entrada `countdown`
  ("Notas y más"). Añadir dos:
  - **Temporizador** — icono `Timer` — `activeView: 'timer'` — ruta `/timer`
  - **Avisos** — icono `Megaphone` — `activeView: 'notices'` — ruta `/notices`
- `src/App.tsx`:
  - Mapa `pathToView` (línea ~40): reemplazar `'/countdown': 'countdown'` por
    `'/timer': 'timer'` y `'/notices': 'notices'`.
  - Rutas lazy: reemplazar `CountdownView` por `TimerView` y `NoticesView`.
  - Redirect de compatibilidad: `/countdown` → `/timer` (enlaces guardados,
    accesos directos PWA).
- i18n (`src/i18n/es.ts`, bloque `sidebar`): quitar `countdown: 'Notas y más'`,
  añadir `timer: 'Temporizador'` y `notices: 'Avisos'`. Mantener
  `notes: 'Asistencia'` intacto.
- Tipo de `activeView`: sustituir `'countdown'` por `'timer' | 'notices'`
  donde esté declarado (buscar usos de `'countdown'`).

### 2. Vista Temporizador — `src/pages/TimerView.tsx`

Extraída de la sección "Tiempo en pantalla" de `CountdownView`.

- Header: `Temporizador` + subtítulo de una línea:
  "Cuenta atrás o reloj en la pantalla de proyección."
- Píldora de estado "En pantalla · 04:32" (ya existe como `onScreen`) visible
  arriba, siempre.
- Segmented Temporizador/Reloj: sin cambios funcionales.
- Añadir texto guía corto al modo Temporizador (hoy solo el Reloj lo tiene).
- Lógica: importa solo `useCountdownStore`.

### 3. Vista Avisos — `src/pages/NoticesView.tsx`

Extraída de la sección "Avisos" de `CountdownView`.

- Header: `Avisos` + subtítulo: "Muestra recordatorios en la proyección."
- Tira de estado "Ahora en pantalla: —" arriba, para unificar el feedback de
  qué se está proyectando.
- Cada aviso: el botón `Tv2` (hoy icono mudo) pasa a etiqueta clara
  **"Pantalla completa"** con tooltip: "Interrumpe lo proyectado y muestra
  este aviso solo". Conserva iconos `Pencil` / `Trash2`.
- Bloque Banda: conserva toggle + Segmented arriba/abajo. Microcopy mejorada:
  "Cinta continua con todos los avisos, sin interrumpir la proyección".
- Una línea helper que contraste los dos modos (pantalla completa vs banda).
  Sin modal.
- Lógica: importa solo `useNotices` y lo de ticker/banda.

### 4. Estructura de archivos

- Nuevos: `src/pages/TimerView.tsx`, `src/pages/NoticesView.tsx`.
- `Segmented` y `Switch` (hoy locales en `CountdownView`) → mover a
  `src/components/ui/` porque ahora los usan dos vistas.
- Borrar `src/pages/CountdownView.tsx`.

### 5. Fuera de alcance (no tocar)

- Lógica de proyección (`src/services/projection.ts`), stores, `useNotices`,
  `useCountdownStore`.
- Vista Asistencia (`src/pages/NotesView.tsx`) — sin cambios.
- No refactors no relacionados.

## Naming / rutas (confirmado)

- Etiquetas: "Temporizador" y "Avisos".
- Rutas: `/timer` y `/notices`, con redirect `/countdown` → `/timer`.

## Criterios de éxito

- Sidebar muestra "Temporizador" y "Avisos" como entradas separadas; ya no
  existe "Notas y más".
- Cada vista abre una sola herramienta con nombre honesto y microcopy de guía.
- En Avisos queda claro (por texto, no por modal) la diferencia entre pantalla
  completa y banda deslizante.
- `/countdown` redirige a `/timer` sin error.
- El temporizador, el reloj, los avisos y la banda siguen proyectando igual
  que antes (sin regresión funcional).
- `pnpm build` (tsc) pasa; sin referencias colgantes a `CountdownView` ni a
  `'countdown'`.
