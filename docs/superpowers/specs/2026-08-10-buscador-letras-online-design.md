# Buscador de letras online (v2)

Fecha: 2026-08-10
Estado: diseño aprobado, pendiente de plan de implementación

## Por qué

Un usuario real de una de las iglesias preguntó dónde estaba el buscador de letras
online. La v1 se eliminó en `38f0b9a` (2026-07-26) por bajo valor. La decisión se
revierte: es un diferenciador frente a otras apps de proyección y hay demanda
confirmada de campo.

Esta versión no es la v1 reactivada. Corrige las tres causas concretas por las que
la v1 no servía.

### Qué falló en la v1

| Problema | Causa en el código | Solución en v2 |
|---|---|---|
| Lenta | Sin debounce, sin abort, sin caché; y dos fetch en serie (`/api/search` y luego `/api/get`) para conseguir la letra | Debounce 300 ms, `AbortController`, caché por query, y un solo fetch: `/api/search` ya trae `plainLyrics` |
| Letra plana, no proyectable | Se importaba texto sin estructura de slides | `parseLyrics()` ya existe y corta por líneas en blanco; `plainLyrics` de lrclib las trae |
| Deuda de mantenimiento | `CHRISTIAN_ARTISTS`, lista hardcodeada de ~80 nombres | El propio catálogo comunitario es la lista, y se actualiza solo |

## Alcance

Dentro:

- Barra de búsqueda en el `view-header` de la Biblioteca que abre un modal.
- Búsqueda contra lrclib.net, con ranking, deduplicación y limpieza.
- Import a la biblioteca del usuario, pendiente de aprobación para el catálogo público.
- Aplicar `is_verified` como condición de visibilidad pública (RLS y cliente).
- Cerrar el agujero de `search_songs_community`.

Fuera:

- Genius, scraping de letras, cualquier proxy de terceros.
- Gating por plan.
- Letra sincronizada / karaoke.
- Cambios en la `search-box` de filtros locales de la Biblioteca.
- Cambios en `src/admin/`.

## Fuente de datos: lrclib.net

Elegida por ser la única API gratuita de letras completas con CORS abierto, sin
API key y sin rate limit. Genius solo devuelve metadatos y URL (la letra exige
scraping). Musixmatch free devuelve el 30 % de la letra.

Medido contra la API real el 2026-08-10:

| Query | Latencia | Payload | Resultados |
|---|---|---|---|
| `bienvenido espiritu santo miel san marcos` | 724 ms | 53 KB | 8 |
| `renuevame` | 461 ms | 65 KB | 20 |
| `cuan grande es el` | 905 ms | 87 KB | 20 |
| `digno es el cordero` | 581 ms | 107 KB | 10 |
| `himno ipuc` | 398 ms | 2 B | **0** |

Dos conclusiones que mandan en el diseño:

1. **`/api/search` devuelve `plainLyrics` inline.** Los campos de cada resultado son
   `id, name, trackName, artistName, albumName, duration, instrumental, plainLyrics,
   syncedLyrics, lyricsfile`. Elegir un resultado no dispara red. Este era el segundo
   round-trip de la v1.
2. **El himnario no está en lrclib.** Ese hueco lo cubre el catálogo comunitario, que
   es otra superficie. El buscador online no pretende taparlo.

La respuesta trae basura que hay que tratar. En la query de Miel San Marcos, **las 8
entradas son la misma canción**. Se diferencian solo en el campo `artistName`, que
llega en cuatro formas distintas — `Miel San Marcos`, `… feat. Marco Barrientos`,
`… • Marco Barrientos`, `…, Marco Barrientos` — y en sufijos `(En Vivo)` del título.
Además, una entrada tiene tanto `trackName` como `artistName` iguales a un título de
YouTube gritado: `"BIENVENIDO ESPÍRITU SANTO"  FEAT MARCO BARRIENTOS | VIDEO OFICIAL |
PENTECOSTÉS | MIEL SAN MARCOS`.

## Interfaz

Barra falsa en `view-header` (`src/pages/LibraryView.tsx:473`, junto al botón «Nueva»).
No es un input: es un botón con aspecto de barra de búsqueda, para que se lea como
buscador. Al pulsarlo abre el modal. `Ctrl+K` y `/` también lo abren.

```
view-header:
┌─────────────────────────────────────────────┐
│ 📚 Biblioteca                               │
│ [🔍 Buscar online…  ✨Pro]        [+ Nueva] │
└─────────────────────────────────────────────┘
```

La `search-box` de `library-filters-compact` (`LibraryView.tsx:491`) no se toca.
Sigue filtrando la lista local. Cada barra tiene un trabajo distinto.

### El modal

**Solo resultados de internet.** No consulta el catálogo comunitario ni lista
canciones de Proclama. Mezclar fuentes hacía que la misma canción apareciera dos
veces y confundía sobre qué se estaba importando.

Lista plana, sin grupos. Un resultado cuyo título+artista normalizado ya existe en
la Dexie del usuario se marca `✓ ya la tienes` y su botón de importar queda
deshabilitado. Eso no es mostrar una canción de Proclama: es anotar un resultado de
internet para evitar un import duplicado. La v1 ya hacía esto con `alreadyInLibrary`.

```
┌─ Buscar en internet ─────────────────────────┐
│ 🔍 bienvenido espiritu santo                 │
├──────────────────────────┬───────────────────┤
│ ♪ Bienvenido Esp. Santo  │ Bienvenido Esp…   │
│   Miel San Marcos      ✓ │ Miel San Marcos   │
│ ♪ Ven Espíritu Santo     │ ───────────────── │
│   Marco Barrientos     ⬇ │ [Slide 1/9]       │
│ ♪ Espíritu Santo Ven     │ Bienvenido        │
│   Jesús Adrián Romero  ⬇ │ Espíritu Santo    │
│                          │ ───────────────── │
│                          │ [Agregar a mi bib]│
└──────────────────────────┴───────────────────┘
```

El preview de la derecha muestra la letra **ya parseada en slides**, antes de
importar. Es el primer filtro contra basura: el usuario ve si es una canción
cristiana o un tema secular con el mismo título.

## Arquitectura

### Archivos

| Archivo | Responsabilidad |
|---|---|
| `src/services/lyricsSearch.ts` *(nuevo)* | `searchLrclib(query, signal)` y helpers puros. Un fetch, cero estado. |
| `src/hooks/useLyricsSearch.ts` *(nuevo)* | Debounce, abort, caché, cruce con Dexie. Único dueño del estado de búsqueda. |
| `src/components/songs/LyricsSearchModal.tsx` *(nuevo)* | Render. Sin lógica de red. |
| `src/pages/LibraryView.tsx` | Barra en el header, estado de apertura del modal, atajos. |
| `src/styles/library.css` | Estilos de la barra y el modal. |
| `src/services/supabase.ts` | Borrar `searchSongs()`. `is_verified` en `fetchSongs()`. Añadir `fetchCommunityArtists()`. |
| `supabase/migrations/20260810000000_online_search_visibility.sql` *(nuevo)* | RLS, `drop function` ×2, `community_artists()`. |
| `src/test/lyricsSearch.test.ts` *(nuevo)* | Tests del pipeline. |
| `src/test/fixtures/lrclib-*.json` *(nuevos)* | Dos respuestas reales de lrclib. |

No se reutiliza el nombre `genius.ts` ni `OnlineSearchModal.tsx`. Nombres nuevos,
sin herencia de la v1.

Nada en `src/admin/`.

### `lyricsSearch.ts`

`searchLrclib(query, signal)` hace `GET https://lrclib.net/api/search?q=…` con
cabecera `Lrclib-Client: Proclama/2.0` y timeout de 6 s, y pasa el resultado por
esta cadena de funciones puras:

1. **Descartar** entradas con `instrumental === true` y las que se queden sin letra
   utilizable tras el paso 2.
2. **Extraer letra**: `plainLyrics` si existe; si no, `syncedLyrics` sin los
   timestamps `[mm:ss.xx]`. Después, `cleanLyricsText()` — ya existe en
   `src/services/lyricsParser.ts:68` y quita acordes, watermarks de Genius y
   números sueltos.
3. **Clave de deduplicación.** Es el paso que más importa y el que la v1 no acertó.

   Base común a título y artista:
   - Quedarse con el texto **anterior al primer `|`**. Corta los títulos de YouTube
     de raíz, sin necesidad de una lista de basura conocida.
   - Minúsculas y sin tildes. **No sirve `normalizeSearchText()`** de
     `src/services/languageUtils.ts`: quita también los espacios, y la clave los
     necesita para cortar en `feat` / `con` por límite de palabra. Se escribe una
     normalización propia en `lyricsSearch.ts` que conserva espacios.
   - Quitar los sufijos de versión `(En Vivo)`, `(Live)`, `(Acústico)`, `(En Directo)`.
     Para proyectar, la versión en vivo y la de estudio tienen la misma letra: son
     duplicados desde el punto de vista del usuario.

   Y después, **distinto para cada uno**:
   - **Artista**: quedarse con el principal, cortando en `feat`, `ft`, `con`, `,`,
     `•` o `&`. Esta es la clave del dedupe: lrclib devuelve el mismo artista en
     cuatro formas distintas y sin esto no se colapsa nada.
   - **Título**: cortar **solo** desde `feat` o `ft` en adelante. Aplicarle al
     título los seis separadores del artista es un error: `Con Todo Mi Ser` daría
     clave vacía y colisionaría con cualquier otro título que empiece por «Con»;
     `Santo, Santo, Santo` colapsaría contra una canción distinta llamada `Santo`.
     En español esos separadores son parte del título, no metadatos. Cortar en
     `feat` sí hace falta, y basta: es lo que fusiona `Hosanna` con
     `Hosanna (feat. Hillsong UNITED)`.

   Por último, en ambos: quitar todo lo que no sea alfanumérico o espacio, y
   colapsar espacios.
4. **Descartar registros malformados**: si la clave del artista es idéntica a la del
   título, el campo `artistName` es basura (típicamente un título de YouTube
   completo). Se descarta **solo si otra entrada comparte la clave de título**, para
   no vaciar una búsqueda cuyo único resultado esté mal formado.
5. **Deduplicar** por `claveTítulo + claveArtista`. De cada grupo se conserva la
   entrada con la letra más larga.
6. **Ordenar**: los artistas presentes en el catálogo comunitario primero, luego un
   separador «Otros resultados», luego el resto. Dentro de cada bloque se respeta el
   orden de lrclib. El ranking es solo orden, sin icono: la única marca de la lista
   es `✓ ya la tienes`, y dos marcas distintas confundirían.

Los pasos 1–6 son funciones exportadas e independientes del fetch. Son las que se
testean.

Efecto medido del pipeline sobre respuestas reales, el 2026-08-10:

| Query | Resultados de lrclib | Tras el pipeline |
|---|---|---|
| `bienvenido espiritu santo miel san marcos` | 8 | **1** |
| `renuevame` | 20 | 11 |
| `cuan grande es el` | 20 | 12 |
| `digno es el cordero` | 10 | 7 |
| `hillsong en espanol` | 20 | 19 |

El último caso es la comprobación de que el pipeline no es demasiado agresivo: son
19 canciones realmente distintas del mismo artista y sobreviven casi todas.

### Ranking sin lista hardcodeada

`fetchCommunityArtists()` llama a un RPC `community_artists()` que devuelve los
artistas distintos de las canciones públicas y verificadas. Se pide una vez por
sesión, en paralelo con la primera búsqueda, y se cachea en `sessionStorage`.

No bloquea: si la llamada falla o aún no ha vuelto, los resultados se muestran sin
ranking. Degradación silenciosa, no error.

La lista se mantiene sola. Cada canción que alguien aporta al catálogo amplía el
filtro. Ese era el punto débil de `CHRISTIAN_ARTISTS`.

### Velocidad

Con una sola fuente a 400–900 ms, la percepción no depende de la red sino de estas
cuatro cosas:

1. **Debounce 300 ms + `AbortController`.** Una petición viva a la vez. La v1
   dejaba competir varias y a veces pintaba la respuesta de una query anterior.
2. **Un solo fetch.** La letra viene inline, así que elegir un resultado no toca la
   red: el preview de slides es instantáneo. Es la mejora más visible frente a la v1.
3. **Caché `Map<query, resultados>`** durante la vida del modal. Borrar una letra y
   volver a escribirla cuesta 0 ms.
4. **Filas esqueleto** mientras se espera, no un spinner centrado. El modal nunca se
   ve vacío.

## Import y moderación

Al confirmar, la canción:

1. Se escribe en **Dexie** (`db.songs`) inmediatamente. Es proyectable al instante,
   sin conexión y antes de sincronizar.
2. Se sube a Supabase con `is_public = true, is_verified = false`.

Con la regla de visibilidad de la sección siguiente, ese par de flags significa
«invisible para los demás». Y como `PendingSongsPage` ya consulta exactamente
`is_public = true AND is_verified = false`, la canción **aparece en la cola de
aprobación sin tocar una línea del panel admin**. `approve()` ya pone
`is_verified = true` y ya audita con `logAdminAction`.

Semántica asumida: importar desde el buscador equivale a proponer la canción al
catálogo. No hay checkbox de consentimiento explícito. Si en el futuro hace falta,
se añade una columna `import_source` y un opt-in; hoy sería complejidad especulativa.

### Los usuarios `free` importan solo en local

La política `songs_insert_premium` exige `is_premium(auth.uid())`, y esa función de
Postgres **no** sigue a `FOUNDING_PHASE` del cliente: mira `profiles.plan` y solo
acepta `founding`, `paid`, `trial` o `role = 'admin'`.

Reparto de perfiles el 2026-08-10: 15 `founding`, 10 `free`, 2 `paid`, 1 `trial`.

Para esos 10 usuarios en `free`, el paso 1 (Dexie) funciona y el paso 2 (Supabase)
lo rechaza RLS. Consecuencia: importan y proyectan con normalidad, pero su canción
no llega a la cola de aprobación. Es coherente con el modelo freemium y con el
requisito de que el usuario pueda proyectar sin aprobación, así que se acepta tal
cual. El fallo del upload se trata como no bloqueante (ver la tabla de errores) y no
se le muestra un error de permisos, porque desde su punto de vista nada falló.

No se toca `songs_insert_premium` en este trabajo: cambiar quién puede escribir en
`songs` es una decisión de negocio ajena al buscador.

### El usuario proyecta su canción aunque no esté aprobada

Requisito explícito. Se sostiene en tres capas, y romper cualquiera de ellas lo
rompe:

1. **RLS `songs_select_own`** (`auth.uid() = user_id`) no se modifica. El autor lee
   sus canciones siempre, verificadas o no.
2. **`fetchSongs()`**: `is_verified` se añade **únicamente a la rama pública** del
   `.or(...)` de `src/services/supabase.ts:93`, nunca a la rama `user_id`. Añadirlo
   a las dos escondería al autor su propia canción.
3. **Dexie** es la fuente local de verdad y no conoce `is_verified`. La proyección
   funciona sin red.

## Visibilidad: `is_verified` como condición

Hoy `is_public = true` basta para que una canción salga en el catálogo comunitario.
`is_verified` no se consulta en ninguna lectura, así que la cola de aprobación es
cosmética: lo que espera aprobación ya se está viendo.

Verificado en la base el 2026-08-10: 3.101 públicas, **3.101 verificadas, 0 sin
verificar**, sobre 3.117 totales. Añadir la condición no esconde ni una canción
existente. Es el momento correcto para hacerlo.

| Sitio | Cambio |
|---|---|
| RLS `songs_select_public` | `USING (is_public = true)` → `USING (is_public AND is_verified)` |
| RLS `Public songs are readable by anyone` | Duplicado exacto de la anterior. Se elimina. |
| RLS `Users can read own songs` | Duplicado exacto de `songs_select_own`. Se elimina. |
| `fetchSongs()` `supabase.ts:93,95` | Añadir `is_verified` solo a la condición pública |

## Seguridad: `search_songs_community`

La función RPC está declarada `SECURITY DEFINER`, por lo que se salta las políticas
RLS de `songs`. Su parámetro `public_only` tiene valor por defecto `false`, y la
condición interna es:

```sql
AND (NOT public_only OR is_public = true)
```

Con `public_only = false` esa condición es verdadera para toda fila. La función está
concedida a `anon`, y la clave anónima es pública por diseño. Cualquiera puede
llamar `search_songs_community('a', false)` y recibir las 3.117 filas de la tabla,
incluidas las 16 privadas de otros usuarios.

Afecta directamente a esta funcionalidad: las canciones importadas serán privadas
hasta la aprobación, y esta función las devolvería igualmente a quien pregunte.

**No tiene consumidores.** `searchSongs()` (`src/services/supabase.ts:148`) está
exportada y no la llama nada en `src/`. La función no aparece en ninguna migración
ni Edge Function. Existen dos sobrecargas, `(text, boolean)` y
`(text, boolean, text)`, ambas concedidas a `anon`.

Acción: `DROP FUNCTION` sobre las dos sobrecargas y borrar `searchSongs()` del
cliente. El agujero se cierra sin código de reemplazo porque no hay nada que
reemplazar. Si más adelante hace falta búsqueda comunitaria en servidor, se escribe
con `SECURITY INVOKER` y sin un parámetro capaz de desactivar el filtro.

## Plan y medición

Sin gating. `FOUNDING_PHASE = true` abre todo igual, y reintroducir el flag
`canUseGenius` que ya se borró una vez sería código muerto.

Se añade `ProInterestBadge` con un `PremiumInterestSource` nuevo, `'online_search'`,
junto a la barra del header. Es la mejor oportunidad de medición disponible: la
única función que un usuario ha reclamado por su cuenta.

## Errores

| Caso | Comportamiento |
|---|---|
| Sin conexión | Mensaje «Sin conexión». No se intenta el fetch. |
| lrclib caído o timeout (6 s) | «No se pudo consultar internet. Intenta de nuevo.» El modal sigue usable. |
| Cero resultados | «Sin resultados para X», con un atajo a «Crear canción» con ese título. |
| Resultado sin letra útil | Descartado en `lyricsSearch.ts` antes de renderizar. Nunca llega al preview. |
| Ya en la biblioteca | Marca `✓ ya la tienes`, botón de importar deshabilitado. |
| Falla el upload a Supabase | La canción ya está en Dexie y es proyectable. Aviso no bloqueante; el sync la reintenta. |
| `community_artists()` falla | Sin ranking. Resultados en el orden de lrclib. Sin mensaje de error. |

## Tests

`src/test/lyricsSearch.test.ts`, sobre dos fixtures JSON capturados de la API real
el 2026-08-10 y guardados en `src/test/fixtures/`:

- `lrclib-miel-san-marcos.json` — 8 entradas que son **la misma canción**, con las
  cuatro variantes de `artistName`, los sufijos `(En Vivo)` y el registro malformado
  de YouTube. Es el caso duro del dedupe.
- `lrclib-hillsong-es.json` — 20 entradas que son **canciones distintas** del mismo
  artista. Es el caso contrario: comprueba que el pipeline no colapsa de más.

Cubre:

- El fixture duro colapsa a 1 resultado; el fixture blando conserva 19.
- La clave de deduplicación corta en el primer `|`, ignora tildes e ignora los
  sufijos de versión.
- La clave de artista se queda con el artista principal en las cuatro formas que
  devuelve lrclib.
- La clave de título **no** corta en `con`, `,`, `•` ni `&`: `Con Todo Mi Ser`,
  `Ven, Espíritu Santo` y `Santo, Santo, Santo` conservan el título entero, y este
  último no colisiona con `Santo`.
- El registro malformado (clave de artista == clave de título) se descarta cuando
  otro comparte el título, y **sobrevive** cuando es el único resultado.
- De un grupo duplicado gana la entrada con la letra más larga.
- Se descartan instrumentales y entradas sin letra utilizable. Ninguno de los dos
  fixtures contiene estos casos, así que se prueban con objetos construidos a mano.
- Los timestamps `[mm:ss.xx]` desaparecen al caer en `syncedLyrics`.
- Un artista presente en el set del catálogo queda por encima de uno ausente.
- `parseLyrics()` sobre el `plainLyrics` real produce más de un slide.

Todo son funciones puras. Sin red, sin mocks de fetch.

La regla de visibilidad se verifica con SQL contra la base tras la migración, no con
un test unitario: comprobar que una canción `is_public = true, is_verified = false`
no la ve otro usuario, y que sí la ve su autor.

## Deuda que este trabajo no toca

- Existen sobrecargas y políticas RLS duplicadas en `songs` más allá de las que se
  eliminan aquí; conviene una auditoría aparte.
- `search_songs_community` estaba en la base pero en ninguna migración. Hay drift
  entre `supabase/migrations/` y el esquema real que merece revisión propia.
