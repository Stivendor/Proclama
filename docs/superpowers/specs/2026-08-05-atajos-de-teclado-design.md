# Atajos de teclado — diseño

Fecha: 2026-08-05

## Problema

Proclama se opera en vivo, durante el servicio, y hoy casi todo exige mouse. Lo único que hay es `src/hooks/useKeyboardShortcuts.ts`: flechas/espacio/PageUp/PageDown para pasar slide, `T` para ocultar el texto y `Esc` para restaurarlo.

Dos huecos concretos:

1. **No hay navegación por teclado entre vistas** ni acceso rápido a las acciones que se usan al empezar el servicio (abrir la proyección, crear una canción, poner la pantalla en negro).
2. **En la vista Biblia las flechas no hacen nada útil.** `projectVerses()` (`src/pages/BibleView.tsx:466`) carga el versículo proyectado como si fuera una canción de un solo verso, así que el arreglo de `slides` tiene un elemento; el handler global manda la flecha a `nextSlide()`, que ya está en el último slide y no hace nada. El operador que sigue al predicador tiene que volver al mouse en cada versículo.

Objetivo: un juego de atajos corto y aprendible, y que en Biblia las flechas avancen versículo.

## Alcance

Incluye: atajos globales de navegación y acción, flechas de versículo en Biblia, un modal que lista los atajos, y resolver el choque de teclas de letra dentro de la vista Biblia.

No incluye: paleta de comandos tipo Ctrl+K, atajos configurables por el usuario, atajos en el panel admin ni en la ventana de proyección.

## Diseño

### 1. Atajos globales

Todos viven en `src/hooks/useKeyboardShortcuts.ts`, que ya se monta una sola vez en `MainApp` (`src/App.tsx:179`). El hook conserva su guarda actual: si el foco está en `INPUT`, `TEXTAREA` o `SELECT`, no hace nada.

| Tecla | Acción | Implementación |
|---|---|---|
| `Alt+1` … `Alt+8` | Ir a la vista n del menú lateral | `setActiveView(id)` — ya navega la URL (`src/stores/index.ts:497`) |
| `Alt+P` | Abrir/enfocar la ventana de proyección | `openProjectionWindow()` (`src/services/projection.ts:53`) |
| `Alt+N` | Nueva canción | `openEditor()` |
| `Alt+B` | Pantalla en negro (toggle) | `setHideText(!hideText)` |
| `?` | Abrir la lista de atajos | estado del hook, ver §4 |
| `←` `→` `↑` `↓` `Espacio` `PageUp` `PageDown` | Slide anterior/siguiente (sin cambios) | `prevSlide` / `nextSlide` |
| `T` | Ocultar texto (sin cambios, salvo en Biblia — ver §2) | `setHideText` |
| `Esc` | Restaurar texto (sin cambios) | `setHideText(false)` |

Se usa `e.altKey` + `e.code` (`Digit1`…`Digit8`) para no depender de la distribución del teclado, y `e.preventDefault()` en cada atajo que se maneja.

El orden de las vistas debe coincidir siempre con el menú lateral. Hoy esa lista está hardcodeada en `src/components/layout/Sidebar.tsx:29-38`. Se extrae el orden a `src/constants/nav.ts`:

```ts
export const NAV_ORDER = ['library','setlists','bible','timer','notices','notes','fondos','settings'] as const
```

El `Sidebar` construye su `nav` a partir de esa constante (sigue poniendo su ícono y su label i18n) y el hook la usa para mapear `Alt+n`. Una sola fuente de verdad: agregar una vista al menú le da su atajo automáticamente.

### 2. Choque de teclas de letra en la vista Biblia

`BibleView` registra un listener de `keypress` que abre la búsqueda rápida con **cualquier** letra o número (`src/pages/BibleView.tsx:142-162`). Eso ya choca hoy con el atajo `T`: al pulsar `t` dentro de Biblia se oculta el texto **y** se abre el buscador con "t" escrita.

Regla: **dentro de la vista Biblia las teclas de letra pertenecen a la búsqueda rápida**. El hook global no ejecuta atajos de letra suelta (`T`) cuando `activeView === 'bible'`. Los atajos con `Alt` no se ven afectados: por eso el negro es `Alt+B` y no `B`, y funciona igual en todas las vistas.

`?` no es letra ni número, así que no dispara la búsqueda rápida y puede seguir abriendo la ayuda en Biblia.

### 3. Flechas de versículo en Biblia

Comportamiento: con un versículo proyectado y la vista Biblia abierta, `→` proyecta el versículo siguiente y `←` el anterior. `PageDown`/`PageUp` y `Espacio` hacen lo mismo, porque son las teclas que emiten los controles remotos de presentación. `↑` y `↓` quedan libres para el scroll normal de la lista.

Reparto de responsabilidades:

- **El hook global se aparta**: si `activeView === 'bible'` y `state.isBible` es true, no llama a `nextSlide`/`prevSlide` (deja que BibleView maneje flechas, `PageUp`/`PageDown` y `Espacio`; `↑` `↓` quedan al scroll nativo). Fuera de ese caso, todo sigue igual.
- **`BibleView` maneja el avance**, porque ahí ya viven los datos que hacen falta: `verses` (el capítulo cargado), `selectedBook`, `selectedChapter`, `selectedTranslation`, el modo paralelo y `projectVerse()`.

Localizar el versículo actual: `state.songTitle` guarda la referencia proyectada (`projectVerses` la arma en `BibleView.tsx:467`). Se busca esa referencia dentro de `verses`; si el título trae varias referencias separadas por coma (proyección múltiple), se usa la última. Si no aparece ninguna, la flecha no hace nada.

Bordes:

- Último versículo del capítulo + `→`: se carga el capítulo siguiente con `fetchChapter(selectedBook, selectedChapter + 1, selectedTranslation)`, se proyecta su primer versículo y se actualiza `selectedChapter` (la lista de la vista sigue al versículo proyectado).
- Primer versículo + `←`: análogo hacia atrás, proyectando el último versículo del capítulo anterior.
- Límite del libro (Génesis 1:1 hacia atrás, último capítulo hacia adelante): no hace nada. No se salta de libro.
- Mientras el capítulo contiguo está cargando, las pulsaciones repetidas se ignoran (una bandera local), para que no se disparen dos fetch encadenados.

Se reutiliza `projectVerse()` tal cual, así que el modo paralelo (traducción secundaria) y el historial de "versículos recientes" siguen funcionando sin duplicar lógica.

### 4. Modal de atajos

Componente nuevo `src/components/ui/ShortcutsModal.tsx`, siguiendo el patrón de los modales existentes (`modal-overlay` + `modal`, ver `src/components/ui/PremiumFeatureModal.tsx`): lista estática agrupada en **Navegación**, **Proyección** y **Biblia**. Cierra con `Esc`, con la X o con clic fuera.

El estado vive en el hook: `useKeyboardShortcuts()` pasa a devolver `{ shortcutsOpen, closeShortcuts }` y `MainApp` renderiza el modal. No se agrega nada al store.

La tabla del modal y el `switch` del hook son dos listas que deben coincidir; se dejan una al lado de la otra con un comentario que lo diga (mantenerlas sincronizadas a mano es más barato que un registro genérico de comandos para nueve atajos).

## Pruebas

- **Unitaria** — `src/test/useKeyboardShortcuts.test.ts` (jsdom, como el resto de `src/test/`): montar el hook con `@testing-library/react`, despachar `keydown` sobre `window` y verificar
  - `Alt+3` cambia `activeView` a `'bible'`,
  - `Alt+B` alterna `hideText`,
  - con el foco en un `<input>` no pasa nada,
  - en `activeView === 'bible'` con `isBible`, `→` no llama a `nextSlide`.
- **Manual** — vista Biblia: proyectar Juan 3:16, avanzar con `→` hasta cruzar al capítulo 4 y volver con `←`; comprobar que en el capítulo 1 de Génesis `←` no rompe nada; que `t` en Biblia sólo abre el buscador; que `Alt+B` pone negro desde cualquier vista; que `?` abre y `Esc` cierra el modal.
- `pnpm tsc --noEmit` y `pnpm test` en verde.

## Riesgos

- `Alt+letra` abre menús del navegador en algunos casos; `Alt+número` no está tomado en Chrome/Edge/Firefox de escritorio. Sólo se usan números y `P`/`N`/`B`, que no colisionan con atajos del navegador en Windows.
- En Mac `Alt` es `Option` y produce caracteres especiales al escribir, pero como los atajos se ignoran cuando el foco está en un campo de texto, no interfiere.
