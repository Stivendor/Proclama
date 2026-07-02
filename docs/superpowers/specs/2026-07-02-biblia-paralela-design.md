# Biblia paralela (dos idiomas) — Design

**Fecha:** 2026-07-02
**Estado:** Aprobado para plan

## Problema

Iglesias en el extranjero atienden congregaciones mixtas en cuanto a idioma.
Necesitan mostrar el mismo versículo en dos idiomas a la vez (ej. español e
inglés), tanto para el operador al leer como en la pantalla de proyección para
el público.

## Alcance

Modo opcional dentro de la vista de la Biblia (`BibleView`) que muestra dos
traducciones en paralelo, en el panel de lectura **y** en la proyección.

### Fuera de alcance (YAGNI)
- Estilo diferenciado por idioma en proyección (ambos idiomas con el mismo
  estilo; ya son visualmente distintos).
- Más de 2 idiomas.
- Lógica especial para biblias importadas (HelloAO): funcionan como secundaria
  si aparecen en la lista de traducciones, sin código adicional.

## Comportamiento

### Activación y selección
- Botón **"Paralelo"** (toggle) en el header de `BibleView`, junto al selector
  de idioma existente.
- Al activarlo aparece un **segundo dropdown de traducción** (`secondaryTranslation`).
  El operador puede elegir cualquier par: RVR1960 + KJV, NVI + ESV, incluso dos
  del mismo idioma.
- Valor por defecto de la secundaria = primera traducción del *otro* idioma
  respecto a la primaria (si primaria es español → `KJV`; si es inglés →
  `RVR1960`).
- `parallelMode` (bool) y `secondaryTranslation` (string) se persisten en
  `localStorage`, igual que el patrón ya usado para `proclama-recent-verses`.

### Panel de lectura
- Con paralelo activo se hace un segundo `fetchChapter(selectedBook,
  selectedChapter, secondaryTranslation)` además del primario ya existente.
- Render en **dos columnas alineadas por número de versículo**: primaria a la
  izquierda, secundaria a la derecha. Cada fila = un versículo.
- Click en una fila proyecta ese versículo en ambos idiomas.
- Alineación por número de versículo (índice `i+1`). Si las traducciones tienen
  distinto conteo (versificación distinta), se muestra lo disponible en cada
  columna sin romper (celda vacía si falta).
- Con paralelo desactivado, el panel se comporta exactamente como hoy (una
  columna).

### Proyección
- `projectVerses` en modo paralelo obtiene el versículo correspondiente en la
  traducción secundaria y arma el texto del slide como dos líneas:
  ```
  <texto primario>
  <texto secundario>
  ```
- La cita (ej. "Juan 3:16") se muestra una sola vez como título, como hoy.
- Ambos idiomas con el mismo estilo/peso. `ProjectionWindow.tsx` **no cambia**:
  ya renderiza slides multi-línea y auto-ajusta la fuente con
  `calcCanvasFontSize`.

## Diseño técnico

### Estado (en `BibleView.tsx`)
- `parallelMode: boolean` (persistido en `localStorage`, clave
  `proclama-bible-parallel`).
- `secondaryTranslation: string` (persistido, clave
  `proclama-bible-secondary-translation`).
- `secondaryVerses: BibleVerseResult[]` — capítulo secundario cargado.

### Carga de datos
- El `useEffect` que hoy llama `loadChapter()` se extiende: cuando
  `parallelMode` está activo, cargar también el capítulo secundario. Se puede
  hacer con un `fetchChapter` adicional en paralelo (`Promise.all`) reusando la
  caché LRU existente en `services/bible.ts` (sin cambios en el servicio).
- El segundo dropdown se llena con `SUPPORTED_TRANSLATIONS` +
  `importedBibles`, sin filtrar por idioma (para permitir cualquier par).

### Proyección paralela
- En `projectVerses`, cuando `parallelMode` está activo, para cada versículo a
  proyectar se busca su par en `secondaryVerses` por número de versículo y se
  concatena `primario + "\n" + secundario` como texto del slide. El resto del
  flujo (`loadSong(..., isBible=true)`) queda igual.
- **Ceiling conocido:** `parseLyrics` divide bloques por `theme.linesPerSlide`
  (default 2). Con el default, primario+secundario caen en un solo slide. Si el
  usuario configuró `linesPerSlide = 1`, los dos idiomas se separarían en slides
  distintos. Se marca con comentario `// ponytail:`. Si en pruebas resulta
  molesto, se blinda forzando un único slide para el versículo paralelo.

### UI (columnas de lectura)
- Reusar/extender los estilos existentes de `verses-list` / `verse-item`. En
  modo paralelo, un contenedor de fila con dos celdas (`display: grid` de dos
  columnas). Sin librerías nuevas.

## Verificación
- Comprobar manualmente: activar paralelo, cambiar traducción secundaria, leer
  un capítulo con ambas columnas alineadas, proyectar un versículo y confirmar
  que la pantalla muestra ambos idiomas en un solo slide con la cita una vez.
- Caso borde: capítulo donde las dos traducciones tienen distinto número de
  versículos (no debe romper el render ni la proyección).
