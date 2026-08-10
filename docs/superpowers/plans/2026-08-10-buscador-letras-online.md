# Buscador de letras online v2 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Devolver a la Biblioteca un buscador de letras en internet, rápido, con importación que pasa por aprobación antes de llegar al catálogo público.

**Architecture:** Una barra en el `view-header` de la Biblioteca abre un modal que consulta únicamente lrclib.net. Un pipeline de funciones puras deduplica y limpia la respuesta antes de mostrarla; el ranking usa los artistas del propio catálogo comunitario en vez de una lista hardcodeada. Importar escribe primero en Dexie (proyectable al instante) y después en Supabase con `is_public = true, is_verified = false`, lo que la deja invisible para terceros y la mete en la cola de aprobación que ya existe.

**Tech Stack:** React 18, TypeScript, Vite 8, Dexie (IndexedDB), Supabase (Postgres + RLS), Vitest + jsdom, CSS plano.

**Spec:** `docs/superpowers/specs/2026-08-10-buscador-letras-online-design.md`

## Global Constraints

- **Usar `pnpm`, nunca `npm`.** Un `package-lock.json` rompe el build de Vercel.
- **Cero dependencias nuevas.** lrclib no necesita SDK ni proxy: CORS abierto, sin API key, sin rate limit.
- **Sin scraping de letras y sin Genius.** Regla explícita del proyecto.
- **UI en español.** Los strings de la app son español plano, sin i18n (`src/i18n/` solo cubre landing y pricing).
- **Los tests unitarios viven en `src/`.** Vitest solo recoge `src/**/*.{test,spec}.{ts,tsx}`. `tests/` es solo Playwright.
- **Alias de import `@/` → `src/`.**
- **Estilos: CSS plano.** `src/index.css` es solo una lista de `@import`; las reglas van en `src/styles/*.css`. El orden de import es la cascada.
- **Supabase: `snake_case` en la base, `camelCase` en el frontend.** El mapeo vive en `mapRowToSong` / `mapSongToPayload` de `src/services/supabase.ts`.
- **No hay script de lint.** El chequeo de tipos es `pnpm tsc --noEmit`.
- **Rama de trabajo:** `feat/buscador-letras-online`, ya creada, con el spec y los fixtures commiteados.

---

### Task 1: Pipeline puro de `lyricsSearch`

Deduplicación, limpieza y ranking. Todo funciones puras: sin red, sin React, sin Dexie. Es el corazón de la feature y el único sitio donde se corrigen los defectos de la v1.

**Files:**
- Create: `src/services/lyricsSearch.ts`
- Test: `src/test/lyricsSearch.test.ts`
- Usa (ya existen, no tocar): `src/test/fixtures/lrclib-miel-san-marcos.json` (8 entradas), `src/test/fixtures/lrclib-hillsong-es.json` (20 entradas)

**Interfaces:**
- Consumes: `cleanLyricsText` de `@/services/lyricsParser`.
- Produces:
  - `interface LrclibTrack { id, trackName, artistName, albumName?, duration?, instrumental, plainLyrics, syncedLyrics }`
  - `interface LyricsResult { id: number; title: string; artist: string; lyrics: string; knownArtist: boolean; alreadyInLibrary: boolean }`
  - `dedupeKey(raw: string): string`
  - `extractLyrics(track: LrclibTrack): string`
  - `cleanTitle(raw: string): string`
  - `buildResults(tracks: LrclibTrack[], knownArtists: Set<string>): LyricsResult[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/test/lyricsSearch.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dedupeKey, extractLyrics, cleanTitle, buildResults } from '@/services/lyricsSearch'
import type { LrclibTrack } from '@/services/lyricsSearch'
import { parseLyrics } from '@/services/lyricsParser'
import mielSanMarcos from './fixtures/lrclib-miel-san-marcos.json'
import hillsongEs from './fixtures/lrclib-hillsong-es.json'

const duro = mielSanMarcos as LrclibTrack[]
const blando = hillsongEs as LrclibTrack[]

/** Track mínimo para los casos que los fixtures reales no contienen. */
function track(over: Partial<LrclibTrack> = {}): LrclibTrack {
  return {
    id: 1,
    trackName: 'Canción',
    artistName: 'Artista',
    instrumental: false,
    plainLyrics: 'Línea uno\nLínea dos',
    syncedLyrics: null,
    ...over,
  }
}

describe('dedupeKey', () => {
  it('corta en el primer | para matar títulos de YouTube', () => {
    expect(dedupeKey('"BIENVENIDO ESPÍRITU SANTO"  FEAT MARCO BARRIENTOS | VIDEO OFICIAL | MIEL SAN MARCOS'))
      .toBe('bienvenido espiritu santo')
  })

  it('ignora tildes y mayúsculas', () => {
    expect(dedupeKey('Espíritu Santo')).toBe(dedupeKey('espiritu santo'))
  })

  it('conserva los espacios, a diferencia de normalizeSearchText', () => {
    expect(dedupeKey('Miel San Marcos')).toBe('miel san marcos')
  })

  it('quita los sufijos de versión', () => {
    expect(dedupeKey('Bienvenido Espíritu Santo (En Vivo)')).toBe('bienvenido espiritu santo')
    expect(dedupeKey('Algo (Acústico)')).toBe('algo')
  })

  it('se queda con el artista principal en las cuatro formas de lrclib', () => {
    const esperado = 'miel san marcos'
    expect(dedupeKey('Miel San Marcos')).toBe(esperado)
    expect(dedupeKey('Miel San Marcos feat. Marco Barrientos')).toBe(esperado)
    expect(dedupeKey('Miel San Marcos • Marco Barrientos')).toBe(esperado)
    expect(dedupeKey('Miel San Marcos, Marco Barrientos')).toBe(esperado)
  })
})

describe('extractLyrics', () => {
  it('prefiere plainLyrics', () => {
    expect(extractLyrics(track({ plainLyrics: 'Hola', syncedLyrics: '[00:01.00] Otra' }))).toBe('Hola')
  })

  it('cae en syncedLyrics quitando los timestamps', () => {
    const t = track({ plainLyrics: null, syncedLyrics: '[00:12.34] Santo\n[00:15.00] Santo' })
    expect(extractLyrics(t)).toBe('Santo\nSanto')
  })

  it('devuelve cadena vacía si no hay letra', () => {
    expect(extractLyrics(track({ plainLyrics: null, syncedLyrics: null }))).toBe('')
  })
})

describe('cleanTitle', () => {
  it('corta en el primer | y quita comillas', () => {
    expect(cleanTitle('"Bienvenido Espíritu Santo" | VIDEO OFICIAL')).toBe('Bienvenido Espíritu Santo')
  })

  it('pasa los títulos gritados a capitalización normal', () => {
    expect(cleanTitle('RENUÉVAME')).toBe('Renuévame')
  })

  it('respeta los títulos que ya están bien', () => {
    expect(cleanTitle('Bienvenido Espíritu Santo (En Vivo)')).toBe('Bienvenido Espíritu Santo (En Vivo)')
  })
})

describe('buildResults', () => {
  it('colapsa a 1 las 8 entradas del fixture duro', () => {
    const out = buildResults(duro, new Set())
    expect(out).toHaveLength(1)
    expect(out[0].artist).toBe('Miel San Marcos')
  })

  it('conserva 19 de 20 en el fixture blando: no es demasiado agresivo', () => {
    expect(buildResults(blando, new Set())).toHaveLength(19)
  })

  it('descarta el registro malformado cuando otro comparte el título', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Santo | VIDEO OFICIAL', artistName: 'Santo | VIDEO OFICIAL' }),
      track({ id: 2, trackName: 'Santo', artistName: 'Miel San Marcos' }),
    ], new Set())
    expect(out.map(r => r.id)).toEqual([2])
  })

  it('conserva el registro malformado si es el único resultado', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Santo | VIDEO OFICIAL', artistName: 'Santo | VIDEO OFICIAL' }),
    ], new Set())
    expect(out).toHaveLength(1)
  })

  it('de un grupo duplicado gana la letra más larga', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Santo', artistName: 'Coro', plainLyrics: 'corta' }),
      track({ id: 2, trackName: 'Santo (En Vivo)', artistName: 'Coro', plainLyrics: 'una letra mucho más larga' }),
    ], new Set())
    expect(out.map(r => r.id)).toEqual([2])
  })

  it('descarta instrumentales y entradas sin letra', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'A', instrumental: true }),
      track({ id: 2, trackName: 'B', plainLyrics: null, syncedLyrics: null }),
      track({ id: 3, trackName: 'C' }),
    ], new Set())
    expect(out.map(r => r.id)).toEqual([3])
  })

  it('pone delante a los artistas del catálogo', () => {
    const out = buildResults([
      track({ id: 1, trackName: 'Uno', artistName: 'Desconocido' }),
      track({ id: 2, trackName: 'Dos', artistName: 'Miel San Marcos' }),
    ], new Set(['miel san marcos']))
    expect(out.map(r => r.id)).toEqual([2, 1])
    expect(out[0].knownArtist).toBe(true)
    expect(out[1].knownArtist).toBe(false)
  })

  it('la letra resultante se parte en más de un slide', () => {
    const out = buildResults(duro, new Set())
    expect(parseLyrics(out[0].lyrics).length).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

Run: `pnpm vitest --run src/test/lyricsSearch.test.ts`
Expected: FAIL — `Failed to resolve import "@/services/lyricsSearch"`

- [ ] **Step 3: Escribir la implementación**

Crear `src/services/lyricsSearch.ts`:

```ts
import { cleanLyricsText } from '@/services/lyricsParser'

/** Una entrada cruda del endpoint /api/search de lrclib.net. */
export interface LrclibTrack {
  id: number
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

/** Un resultado ya limpio, deduplicado y listo para pintar. */
export interface LyricsResult {
  id: number
  title: string
  artist: string
  lyrics: string
  /** El artista aparece en el catálogo comunitario. Solo afecta al orden. */
  knownArtist: boolean
  /** Ya existe en la Dexie del usuario. Lo rellena el hook, no el pipeline. */
  alreadyInLibrary: boolean
}

const SUFIJO_VERSION = /\((en vivo|live|acustico|acoustic|en directo)\)/g
const ARTISTA_SECUNDARIO = /\bfeat\b|\bft\b|\bcon\b|[,•&]/
// Se come los espacios de detrás: si no, cada línea queda indentada.
const TIMESTAMP = /\[\d{2}:\d{2}[.:]\d{2,3}\][ \t]*/g

/**
 * Clave de comparación para deduplicar.
 *
 * Conserva los espacios a propósito: hacen falta para cortar en `feat`/`con`
 * por límite de palabra. Por eso no sirve `normalizeSearchText()` de
 * languageUtils, que los elimina.
 *
 * lrclib devuelve el mismo artista en cuatro formas («Miel San Marcos»,
 * «… feat. Marco Barrientos», «… • Marco Barrientos», «…, Marco Barrientos»).
 * Sin quedarse con el artista principal, la deduplicación no llega a nada.
 */
export function dedupeKey(raw: string): string {
  return (raw || '')
    .split('|')[0]                     // títulos de YouTube: «X | VIDEO OFICIAL | Y»
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // tildes
    .replace(SUFIJO_VERSION, '')       // para proyectar, en vivo y estudio son lo mismo
    .split(ARTISTA_SECUNDARIO)[0]
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Letra utilizable, o cadena vacía si no hay ninguna. */
export function extractLyrics(track: LrclibTrack): string {
  const crudo = track.plainLyrics || (track.syncedLyrics || '').replace(TIMESTAMP, '')
  return cleanLyricsText(crudo)
}

/** Título presentable: sin la cola de YouTube, sin comillas, sin gritos. */
export function cleanTitle(raw: string): string {
  const base = (raw || '').split('|')[0].replace(/["']/g, '').replace(/\s+/g, ' ').trim()
  const letras = base.replace(/[^\p{L}]/gu, '')
  if (letras.length > 3 && letras === letras.toUpperCase()) {
    return base.toLowerCase().replace(/(^|\s)\p{L}/gu, c => c.toUpperCase())
  }
  return base
}

/**
 * Convierte la respuesta cruda de lrclib en la lista que ve el usuario.
 * `knownArtists` son claves ya pasadas por dedupeKey.
 */
export function buildResults(tracks: LrclibTrack[], knownArtists: Set<string>): LyricsResult[] {
  // 1. Fuera instrumentales y lo que se queda sin letra utilizable.
  const conLetra = tracks
    .filter(t => !t.instrumental)
    .map(t => ({ track: t, lyrics: extractLyrics(t) }))
    .filter(x => x.lyrics.length > 0)

  // 2. Fuera registros malformados (artistName es en realidad el título), pero
  //    solo si otra entrada cubre ese mismo título: si es el único resultado,
  //    vale más uno feo que ninguno.
  const porTitulo = new Map<string, number>()
  for (const x of conLetra) {
    const k = dedupeKey(x.track.trackName)
    porTitulo.set(k, (porTitulo.get(k) ?? 0) + 1)
  }
  const limpios = conLetra.filter(x => {
    const kt = dedupeKey(x.track.trackName)
    const ka = dedupeKey(x.track.artistName)
    return !(kt === ka && (porTitulo.get(kt) ?? 0) > 1)
  })

  // 3. Deduplicar. De cada grupo gana la letra más larga.
  const mejores = new Map<string, { track: LrclibTrack; lyrics: string }>()
  for (const x of limpios) {
    const k = `${dedupeKey(x.track.trackName)}|${dedupeKey(x.track.artistName)}`
    const previo = mejores.get(k)
    if (!previo || x.lyrics.length > previo.lyrics.length) mejores.set(k, x)
  }

  // 4. Map conserva el orden de inserción, así que dentro de cada bloque se
  //    respeta el orden que dio lrclib.
  const resultados: LyricsResult[] = [...mejores.values()].map(x => ({
    id: x.track.id,
    title: cleanTitle(x.track.trackName),
    artist: cleanTitle(x.track.artistName),
    lyrics: x.lyrics,
    knownArtist: knownArtists.has(dedupeKey(x.track.artistName)),
    alreadyInLibrary: false,
  }))

  return [
    ...resultados.filter(r => r.knownArtist),
    ...resultados.filter(r => !r.knownArtist),
  ]
}
```

- [ ] **Step 4: Ejecutar los tests y comprobar que pasan**

Run: `pnpm vitest --run src/test/lyricsSearch.test.ts`
Expected: PASS, 19 tests.

Si `colapsa a 1` falla dando 2, el culpable es casi siempre `ARTISTA_SECUNDARIO`: comprobar que `•` y `,` están en la clase de caracteres.

- [ ] **Step 5: Comprobar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

Si `resolveJsonModule` protesta al importar los fixtures, añadir `"resolveJsonModule": true` a `compilerOptions` en `tsconfig.json`.

- [ ] **Step 6: Commit**

```bash
git add src/services/lyricsSearch.ts src/test/lyricsSearch.test.ts
git commit -m "feat(buscador): pipeline puro de deduplicación y limpieza de lrclib"
```

---

### Task 2: `searchLrclib()` — la llamada de red

**Files:**
- Modify: `src/services/lyricsSearch.ts` (añadir al final)
- Test: `src/test/lyricsSearch.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `LrclibTrack` de la Task 1.
- Produces: `searchLrclib(query: string, signal?: AbortSignal): Promise<LrclibTrack[]>`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `src/test/lyricsSearch.test.ts`:

```ts
import { afterEach, vi } from 'vitest'
import { searchLrclib } from '@/services/lyricsSearch'

describe('searchLrclib', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('pide a lrclib con la query codificada y la cabecera de cliente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    await searchLrclib('santo espíritu')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://lrclib.net/api/search?q=santo%20esp%C3%ADritu')
    expect(init.headers['Lrclib-Client']).toContain('Proclama')
  })

  it('lanza si la respuesta no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(searchLrclib('algo')).rejects.toThrow('503')
  })

  it('propaga el abort de quien llama', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    ))
    const ctrl = new AbortController()
    const promesa = searchLrclib('algo', ctrl.signal)
    ctrl.abort()
    await expect(promesa).rejects.toThrow(/abort/i)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `pnpm vitest --run src/test/lyricsSearch.test.ts -t "searchLrclib"`
Expected: FAIL — `searchLrclib is not a function`

- [ ] **Step 3: Implementar**

Añadir al final de `src/services/lyricsSearch.ts`:

```ts
const LRCLIB_URL = 'https://lrclib.net/api/search'
/** lrclib no tiene rate limit, pero una petición colgada bloquea el modal. */
const TIMEOUT_MS = 6000

/**
 * Un único fetch por búsqueda: /api/search ya devuelve `plainLyrics` inline,
 * así que elegir un resultado no vuelve a tocar la red. La v1 hacía un segundo
 * viaje a /api/get y por eso se sentía lenta.
 */
export async function searchLrclib(query: string, signal?: AbortSignal): Promise<LrclibTrack[]> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combinado = signal ? AbortSignal.any([signal, timeout]) : timeout

  const res = await fetch(`${LRCLIB_URL}?q=${encodeURIComponent(query)}`, {
    headers: { 'Lrclib-Client': 'Proclama/2.0 (https://proclama.app)' },
    signal: combinado,
  })
  if (!res.ok) throw new Error(`lrclib respondió ${res.status}`)
  return (await res.json()) as LrclibTrack[]
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `pnpm vitest --run src/test/lyricsSearch.test.ts`
Expected: PASS, 22 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/lyricsSearch.ts src/test/lyricsSearch.test.ts
git commit -m "feat(buscador): searchLrclib con timeout y abort encadenado"
```

---

### Task 3: Migración Supabase — visibilidad, agujero RLS y artistas

Esta task toca producción. No hay test unitario: la verificación es SQL contra la base, y va en los propios pasos.

**Files:**
- Create: `supabase/migrations/20260810000000_online_search_visibility.sql`

**Interfaces:**
- Produces: función `public.community_artists()` que devuelve una columna `artist text`, concedida a `anon` y `authenticated`.

- [ ] **Step 1: Anotar el estado previo**

Ejecutar contra la base y guardar la salida en el mensaje del commit:

```sql
select count(*) filter (where is_public) as publicas,
       count(*) filter (where is_public and not is_verified) as sin_verificar
from songs;
```

Expected: `publicas = 3101, sin_verificar = 0`.

**Si `sin_verificar` no es 0, parar y avisar.** Toda la migración se apoya en que añadir la condición no esconde nada que ya se esté viendo.

- [ ] **Step 2: Escribir la migración**

Crear `supabase/migrations/20260810000000_online_search_visibility.sql`:

```sql
-- Buscador de letras online v2.
-- Ver docs/superpowers/specs/2026-08-10-buscador-letras-online-design.md

-- ── 1. La visibilidad pública exige verificación ────────────────────────────
-- is_verified existía en el tipo Song («Solo las canciones verificadas aparecen
-- públicamente») pero no se consultaba en ninguna lectura, así que la cola de
-- aprobación era cosmética. Comprobado antes de aplicar: 0 públicas sin
-- verificar, luego esto no esconde ninguna canción existente.
drop policy if exists "songs_select_public" on public.songs;
drop policy if exists "Public songs are readable by anyone" on public.songs;

create policy "songs_select_public" on public.songs
  for select
  using (is_public = true and is_verified = true);

-- ── 2. Política duplicada ───────────────────────────────────────────────────
-- Idéntica a songs_select_own, que se conserva: using (auth.uid() = user_id).
-- El autor sigue leyendo sus canciones sin importar is_verified: de eso depende
-- que pueda proyectar lo que acaba de importar.
drop policy if exists "Users can read own songs" on public.songs;

-- ── 3. Cerrar el agujero de search_songs_community ──────────────────────────
-- SECURITY DEFINER (se salta RLS) con public_only=false por defecto, concedida
-- a anon: cualquiera con la clave anónima podía pedir la tabla entera, privadas
-- de otros usuarios incluidas. Sin consumidores en el cliente ni en Edge
-- Functions. Si hace falta búsqueda comunitaria en servidor, se reescribe con
-- SECURITY INVOKER y sin un parámetro capaz de desactivar el filtro.
drop function if exists public.search_songs_community(text, boolean);
drop function if exists public.search_songs_community(text, boolean, text);

-- ── 4. Artistas del catálogo, para ordenar los resultados de internet ───────
-- Sustituye a la lista hardcodeada CHRISTIAN_ARTISTS de la v1. SECURITY INVOKER
-- a propósito: el filtro es la propia RLS de arriba, así que solo puede
-- devolver artistas de canciones que el llamante ya podría leer.
create or replace function public.community_artists()
returns table (artist text)
language sql
stable
security invoker
set search_path to 'public'
as $$
  select distinct lower(trim(s.artist))
  from public.songs s
  where s.is_public
    and s.is_verified
    and s.artist is not null
    and trim(s.artist) <> ''
$$;

grant execute on function public.community_artists() to anon, authenticated;
```

- [ ] **Step 3: Aplicar la migración**

Aplicarla con el MCP de Supabase (`apply_migration`, nombre `online_search_visibility`) o con `supabase db push` si hay CLI local.

- [ ] **Step 4: Verificar que la regla funciona**

```sql
-- (a) Las dos sobrecargas inseguras ya no existen. Esperado: 0 filas.
select oid::regprocedure::text from pg_proc
where proname = 'search_songs_community';

-- (b) La política pública exige verificación. Esperado: (is_public = true) AND (is_verified = true)
select pg_get_expr(polqual, polrelid) from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname = 'songs' and polname = 'songs_select_public';

-- (c) Ninguna política de lectura duplicada. Esperado: songs_select_own,
--     songs_select_public, «Admins can view all songs».
select polname from pg_policy p join pg_class c on c.oid = p.polrelid
where c.relname = 'songs' and polcmd = 'r';

-- (d) El catálogo sigue completo. Esperado: 3101.
select count(*) from songs where is_public and is_verified;

-- (e) La lista de artistas no viene vacía. Esperado: unos cientos.
select count(*) from community_artists();
```

- [ ] **Step 5: Comprobar en la app que no se rompió nada**

Run: `pnpm dev`
Abrir la Biblioteca con sesión iniciada y confirmar que el contador del header sigue diciendo ~3.041 canciones. Si cae a cero, revertir la política del paso 1 y avisar antes de seguir.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260810000000_online_search_visibility.sql
git commit -m "fix(seguridad): is_verified como condición de visibilidad y drop de search_songs_community

search_songs_community era SECURITY DEFINER con public_only=false por
defecto y estaba concedida a anon, así que devolvía las canciones privadas
de cualquier usuario saltándose RLS. No tenía consumidores.

is_verified no se consultaba en ninguna lectura. Verificado antes de
aplicar: 3101 públicas, 0 sin verificar, así que la condición no esconde
ninguna canción existente."
```

---

### Task 4: Cliente Supabase — filtro, limpieza y artistas

**Files:**
- Modify: `src/services/supabase.ts` (líneas 93 y 95; borrar `searchSongs` en 148-197; añadir `fetchCommunityArtists`; ampliar `PremiumInterestSource` en 412-418)

**Interfaces:**
- Consumes: nada de las tasks anteriores.
- Produces:
  - `fetchCommunityArtists(): Promise<string[]>` — nombres **en crudo**, tal cual salen de la base.
  - `PremiumInterestSource` incluye `'online_search'`.

> **Ojo con el ciclo de imports.** `fetchCommunityArtists` devuelve strings sin normalizar a propósito: `lyricsSearch.ts` importa `createSong` de `supabase.ts`, así que si `supabase.ts` importase `dedupeKey` de `lyricsSearch.ts` se cerraría un ciclo. La normalización con `dedupeKey` la hace quien consume, en el hook de la Task 6.

- [ ] **Step 1: Añadir `is_verified` solo a la rama pública de `fetchSongs`**

En `src/services/supabase.ts`, dentro de `fetchSongs`, sustituir:

```ts
    if (userId) {
      query = query.or(`user_id.eq.${userId},is_public.eq.true`)
    } else {
      query = query.eq('is_public', true)
    }
```

por:

```ts
    // is_verified va SOLO en la rama pública. Meterlo también en la rama
    // user_id escondería al autor su propia canción recién importada, que es
    // justo lo que tiene que poder proyectar sin esperar aprobación.
    if (userId) {
      query = query.or(`user_id.eq.${userId},and(is_public.eq.true,is_verified.eq.true)`)
    } else {
      query = query.eq('is_public', true).eq('is_verified', true)
    }
```

- [ ] **Step 2: Borrar `searchSongs`**

Borrar entera la función `searchSongs` (desde el comentario `/** Busca canciones por texto…` hasta su llave de cierre, líneas ~142-197). Es la única consumidora del RPC eliminado en la Task 3 y no la llama nadie.

Comprobar que de verdad no queda nada:

Run: `pnpm grep -rn "searchSongs\|search_songs_community" src/ || grep -rn "searchSongs\|search_songs_community" src/`
Expected: sin resultados.

Si `sanitizeSearchTerm` se queda sin usar tras el borrado, borrarla también.

- [ ] **Step 3: Añadir `fetchCommunityArtists`**

Añadir en `src/services/supabase.ts`, junto al resto de funciones de songs:

```ts
/**
 * Artistas del catálogo comunitario, en crudo.
 *
 * Sustituye a la lista hardcodeada CHRISTIAN_ARTISTS de la v1: se actualiza
 * sola cada vez que alguien aporta una canción. Solo se usa para ordenar los
 * resultados del buscador online, así que un fallo aquí no es un error: se
 * devuelve una lista vacía y los resultados salen en el orden de lrclib.
 *
 * Devuelve los nombres sin normalizar a propósito: normalizarlos aquí obligaría
 * a importar dedupeKey de lyricsSearch.ts, que a su vez importa createSong de
 * este archivo. Lo normaliza quien consume.
 */
export async function fetchCommunityArtists(): Promise<string[]> {
  const { data, error } = await supabase.rpc('community_artists')
  if (error || !data) {
    console.warn('[buscador] no se pudo cargar la lista de artistas:', error?.message)
    return []
  }
  return (data as { artist: string }[]).map(r => r.artist)
}
```

**No añadir ningún import nuevo a `supabase.ts`.** Si acabas escribiendo `import { dedupeKey } from '@/services/lyricsSearch'` aquí, has creado el ciclo que esta task evita.

- [ ] **Step 4: Añadir la fuente de medición**

En `PremiumInterestSource`, añadir la variante:

```ts
export type PremiumInterestSource =
  | 'landing'
  | 'collaborators'
  | 'backgrounds'
  | 'reports'
  | 'stats'
  | 'bibles'
  | 'online_search'
```

No hace falta migración: comprobado el 2026-08-10, `premium_interest.source` no tiene ningún CHECK constraint, así que la base acepta el valor nuevo tal cual.

- [ ] **Step 5: Comprobar tipos y tests**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: sin errores de tipos; toda la suite en verde.

- [ ] **Step 6: Commit**

```bash
git add src/services/supabase.ts supabase/migrations/
git commit -m "feat(buscador): is_verified en fetchSongs, fetchCommunityArtists y borrado de searchSongs"
```

---

### Task 5: `importLyricsResult()` — de resultado a canción proyectable

**Files:**
- Modify: `src/services/lyricsSearch.ts` (añadir al final)
- Test: `src/test/lyricsSearch.test.ts` (añadir un `describe`)

**Interfaces:**
- Consumes: `LyricsResult` (Task 1), `db` de `@/db`, `createSong` de `@/services/supabase`, `detectLanguage` de `@/services/languageUtils`.
- Produces: `importLyricsResult(result: LyricsResult, userId: string | null): Promise<Song>`

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/test/lyricsSearch.test.ts`:

```ts
import { importLyricsResult } from '@/services/lyricsSearch'
import { db } from '@/db'

const resultado = {
  id: 42,
  title: 'Bienvenido Espíritu Santo',
  artist: 'Miel San Marcos',
  lyrics: 'Bienvenido\nEspíritu Santo\n\nEres bienvenido\naquí',
  knownArtist: true,
  alreadyInLibrary: false,
}

describe('importLyricsResult', () => {
  afterEach(async () => { await db.songs.clear() })

  it('en modo invitado guarda solo en Dexie y queda proyectable', async () => {
    const song = await importLyricsResult(resultado, null)
    expect(song.id).toBeDefined()
    const guardada = await db.songs.get(song.id!)
    expect(guardada?.title).toBe('Bienvenido Espíritu Santo')
    expect(guardada?.lyrics).toContain('Espíritu Santo')
  })

  it('entra invisible para terceros y encolada para aprobación', async () => {
    const song = await importLyricsResult(resultado, null)
    expect(song.isPublic).toBe(true)
    expect(song.isVerified).toBe(false)
  })

  it('guarda la procedencia', async () => {
    const song = await importLyricsResult(resultado, null)
    expect(song.sourceUrl).toContain('lrclib.net')
    expect(song.sourceUrl).toContain('42')
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

Run: `pnpm vitest --run src/test/lyricsSearch.test.ts -t "importLyricsResult"`
Expected: FAIL — `importLyricsResult is not a function`

- [ ] **Step 3: Implementar**

Añadir al final de `src/services/lyricsSearch.ts`:

```ts
import { db } from '@/db'
import { createSong } from '@/services/supabase'
import { detectLanguage } from '@/services/languageUtils'
import type { Song } from '@/types'

/**
 * Importa un resultado a la biblioteca del usuario.
 *
 * Dexie primero, a propósito: la canción tiene que ser proyectable al instante,
 * sin conexión y sin esperar a la aprobación del admin.
 *
 * is_public=true + is_verified=false significa «invisible para terceros» desde
 * la migración 20260810000000, y es exactamente lo que PendingSongsPage ya
 * consulta, así que la canción entra sola en la cola sin tocar el panel admin.
 *
 * El upload puede fallar por RLS: songs_insert_premium exige is_premium(), que
 * mira profiles.plan y no sigue a FOUNDING_PHASE. Para un usuario en plan
 * `free` la canción se queda en local y no llega a la cola. Es el
 * comportamiento aceptado, no un error que mostrar.
 */
export async function importLyricsResult(
  result: LyricsResult,
  userId: string | null,
): Promise<Song> {
  const ahora = new Date()
  const song: Omit<Song, 'id'> = {
    title: result.title,
    artist: result.artist,
    lyrics: result.lyrics,
    key: '',
    tags: [],
    language: detectLanguage(result.lyrics),
    sourceUrl: `https://lrclib.net/api/get/${result.id}`,
    usageCount: 0,
    isPublic: true,
    isVerified: false,
    userId: userId ?? undefined,
    createdAt: ahora,
    updatedAt: ahora,
  }

  const localId = await db.songs.add(song as Song)

  if (userId) {
    const remota = await createSong(song)
    if (remota?.remoteId) await db.songs.update(localId, { remoteId: remota.remoteId })
  }

  return { ...song, id: localId }
}
```

- [ ] **Step 4: Ejecutar y comprobar que pasan**

Run: `pnpm vitest --run src/test/lyricsSearch.test.ts`
Expected: PASS, 25 tests.

Si Dexie protesta en jsdom por falta de IndexedDB, añadir `fake-indexeddb` a las dev-dependencies con `pnpm add -D fake-indexeddb` e importar `'fake-indexeddb/auto'` al principio de `src/test/setup.ts`. Es la única dependencia nueva que este plan permite, y solo de desarrollo.

- [ ] **Step 5: Commit**

```bash
git add src/services/lyricsSearch.ts src/test/lyricsSearch.test.ts package.json pnpm-lock.yaml src/test/setup.ts
git commit -m "feat(buscador): importLyricsResult, Dexie primero para proyectar sin aprobación"
```

---

### Task 6: `useLyricsSearch` — debounce, abort y caché

**Files:**
- Create: `src/hooks/useLyricsSearch.ts`

**Interfaces:**
- Consumes: `searchLrclib`, `buildResults`, `dedupeKey`, `LyricsResult` (Tasks 1-2); `fetchCommunityArtists` (Task 4); `db` de `@/db`.
- Produces:

```ts
interface UseLyricsSearch {
  query: string
  setQuery: (q: string) => void
  results: LyricsResult[]
  loading: boolean
  error: string
  /** true cuando hay query, ya no se está cargando y no hay resultados. */
  empty: boolean
}
function useLyricsSearch(): UseLyricsSearch
```

- [ ] **Step 1: Escribir el hook**

Crear `src/hooks/useLyricsSearch.ts`:

```ts
import { useState, useEffect, useRef } from 'react'
import { searchLrclib, buildResults, dedupeKey } from '@/services/lyricsSearch'
import type { LyricsResult } from '@/services/lyricsSearch'
import { fetchCommunityArtists } from '@/services/supabase'
import { db } from '@/db'

const DEBOUNCE_MS = 300
const MIN_CHARS = 3

/**
 * Estado del buscador online.
 *
 * Los cuatro puntos que la v1 no tenía y por los que se sentía lenta:
 * debounce, abort de la petición anterior, caché por query mientras vive el
 * modal, y un único fetch (la letra viene inline en /api/search).
 */
export function useLyricsSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LyricsResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cache = useRef(new Map<string, LyricsResult[]>())
  const artists = useRef<Set<string> | null>(null)
  const abort = useRef<AbortController | null>(null)

  // La lista de artistas se pide una vez y no bloquea: si falla o aún no ha
  // llegado, los resultados salen en el orden de lrclib.
  // La normalización se hace aquí, no en supabase.ts, para no cerrar un ciclo
  // de imports con lyricsSearch.ts.
  useEffect(() => {
    let vivo = true
    fetchCommunityArtists().then(nombres => {
      if (vivo) artists.current = new Set(nombres.map(dedupeKey))
    })
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    const limpia = query.trim()

    if (limpia.length < MIN_CHARS) {
      abort.current?.abort()
      setResults([])
      setLoading(false)
      setError('')
      return
    }

    const enCache = cache.current.get(limpia)
    if (enCache) {
      setResults(enCache)
      setLoading(false)
      setError('')
      return
    }

    setLoading(true)
    setError('')

    const temporizador = setTimeout(async () => {
      abort.current?.abort()
      const ctrl = new AbortController()
      abort.current = ctrl

      try {
        const crudos = await searchLrclib(limpia, ctrl.signal)
        const base = buildResults(crudos, artists.current ?? new Set())

        // Marcar lo que el usuario ya tiene, para no importarlo dos veces.
        const locales = await db.songs.toArray()
        const claves = new Set(locales.map(s => `${dedupeKey(s.title)}|${dedupeKey(s.artist || '')}`))
        const marcados = base.map(r => ({
          ...r,
          alreadyInLibrary: claves.has(`${dedupeKey(r.title)}|${dedupeKey(r.artist)}`),
        }))

        if (ctrl.signal.aborted) return
        cache.current.set(limpia, marcados)
        setResults(marcados)
      } catch (err) {
        if (ctrl.signal.aborted || (err as Error)?.name === 'AbortError') return
        setResults([])
        setError(
          navigator.onLine
            ? 'No se pudo consultar internet. Intenta de nuevo.'
            : 'Sin conexión.'
        )
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(temporizador)
  }, [query])

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    empty: query.trim().length >= MIN_CHARS && !loading && !error && results.length === 0,
  }
}
```

- [ ] **Step 2: Comprobar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useLyricsSearch.ts
git commit -m "feat(buscador): hook useLyricsSearch con debounce, abort y caché"
```

---

### Task 7: `LyricsSearchModal` — el modal

**Files:**
- Create: `src/components/songs/LyricsSearchModal.tsx`
- Modify: `src/styles/library.css` (añadir al final)

**Interfaces:**
- Consumes: `useLyricsSearch` (Task 6), `importLyricsResult` (Task 5), `parseLyrics` de `@/services/lyricsParser`, `useAppStore` de `@/stores`.
- Produces: `export default function LyricsSearchModal({ onClose }: { onClose: () => void })`

- [ ] **Step 1: Escribir el componente**

Crear `src/components/songs/LyricsSearchModal.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import { Search, Download, Check, Music2, X, Loader2 } from 'lucide-react'
import { useLyricsSearch } from '@/hooks/useLyricsSearch'
import { importLyricsResult } from '@/services/lyricsSearch'
import type { LyricsResult } from '@/services/lyricsSearch'
import { parseLyrics } from '@/services/lyricsParser'
import { useAppStore } from '@/stores'

export default function LyricsSearchModal({ onClose }: { onClose: () => void }) {
  const { query, setQuery, results, loading, error, empty } = useLyricsSearch()
  const user = useAppStore(s => s.user)
  const [selected, setSelected] = useState<LyricsResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<Set<number>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Al cambiar los resultados, la selección anterior deja de tener sentido.
  useEffect(() => { setSelected(null) }, [results])

  const importar = async () => {
    if (!selected) return
    setImporting(true)
    try {
      await importLyricsResult(selected, user?.id ?? null)
      setImported(prev => new Set(prev).add(selected.id))
    } finally {
      setImporting(false)
    }
  }

  const yaEsta = (r: LyricsResult) => r.alreadyInLibrary || imported.has(r.id)
  const slides = selected ? parseLyrics(selected.lyrics) : []

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar canciones en internet"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="modal lyrics-search-modal">
        <div className="lyrics-search-bar">
          <Search size={18} opacity={0.6} />
          <input
            ref={inputRef}
            type="search"
            placeholder="Busca una canción en internet…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Buscar canciones en internet"
          />
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="lyrics-search-body">
          <div className="lyrics-search-list">
            {loading && [0, 1, 2, 3].map(i => <div key={i} className="lyrics-search-skeleton" />)}

            {error && <p className="lyrics-search-msg">{error}</p>}
            {empty && <p className="lyrics-search-msg">Sin resultados para «{query.trim()}».</p>}
            {!loading && !error && !empty && results.length === 0 && (
              <p className="lyrics-search-msg">Escribe para buscar letras en internet.</p>
            )}

            {!loading && results.map((r, i) => (
              <>
                {i > 0 && results[i - 1].knownArtist && !r.knownArtist && (
                  <div key="sep" className="lyrics-search-sep">Otros resultados</div>
                )}
                <button
                  key={r.id}
                  className={`lyrics-search-item ${selected?.id === r.id ? 'active' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  <Music2 size={14} opacity={0.6} />
                  <span className="lyrics-search-item-text">
                    <strong>{r.title}</strong>
                    <small>{r.artist}</small>
                  </span>
                  {yaEsta(r) && <span className="lyrics-search-have"><Check size={12} /> ya la tienes</span>}
                </button>
              </>
            ))}
          </div>

          <div className="lyrics-search-preview">
            {!selected && <p className="lyrics-search-msg">Elige una canción para ver la letra.</p>}
            {selected && (
              <>
                <div className="lyrics-search-preview-head">
                  <strong>{selected.title}</strong>
                  <small>{selected.artist}</small>
                </div>
                <div className="lyrics-search-slides">
                  {slides.map(s => (
                    <div key={s.index} className="lyrics-search-slide">
                      <span className="lyrics-search-slide-num">{s.index + 1}/{slides.length}</span>
                      {s.lines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  ))}
                </div>
                <button
                  className="btn-primary"
                  onClick={importar}
                  disabled={importing || yaEsta(selected)}
                >
                  <Download size={15} />
                  {yaEsta(selected) ? 'Ya está en tu biblioteca'
                    : importing ? 'Agregando…'
                    : 'Agregar a mi biblioteca'}
                </button>
              </>
            )}
          </div>
        </div>

        {loading && <Loader2 className="lyrics-search-spin" size={14} aria-label="Buscando" />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Añadir los estilos**

Añadir al final de `src/styles/library.css`:

```css
/* ── Buscador de letras online ─────────────────────────────────────────── */
.lyrics-search-modal { width: min(860px, 94vw); height: min(560px, 86vh); display: flex; flex-direction: column; }

.lyrics-search-bar { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.lyrics-search-bar input { flex: 1; background: none; border: none; outline: none; color: var(--text); font-size: 16px; }

.lyrics-search-body { flex: 1; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
.lyrics-search-list { overflow-y: auto; border-right: 1px solid var(--border); padding: 8px; }
.lyrics-search-preview { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

.lyrics-search-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: none; border-radius: 8px; background: none; color: var(--text); cursor: pointer; text-align: left; }
.lyrics-search-item:hover { background: var(--bg-elevated); }
.lyrics-search-item.active { background: var(--bg-elevated); outline: 1px solid var(--border); }
.lyrics-search-item-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.lyrics-search-item-text strong { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lyrics-search-item-text small { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lyrics-search-have { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--text-muted); white-space: nowrap; }

.lyrics-search-sep { padding: 10px 10px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); }
.lyrics-search-msg { padding: 20px 10px; font-size: 12px; color: var(--text-muted); text-align: center; }

.lyrics-search-skeleton { height: 40px; margin: 4px 0; border-radius: 8px; background: var(--bg-elevated); animation: lyrics-search-pulse 1.1s ease-in-out infinite; }
@keyframes lyrics-search-pulse { 50% { opacity: .45; } }

.lyrics-search-preview-head { display: flex; flex-direction: column; }
.lyrics-search-preview-head small { color: var(--text-muted); font-size: 11px; }
.lyrics-search-slides { flex: 1; display: flex; flex-direction: column; gap: 8px; font-size: 12px; line-height: 1.55; }
.lyrics-search-slide { position: relative; padding: 8px 10px; border-radius: 6px; background: var(--bg-elevated); }
.lyrics-search-slide-num { position: absolute; top: 4px; right: 8px; font-size: 9px; color: var(--text-muted); }

.lyrics-search-spin { position: absolute; top: 18px; right: 52px; animation: spin 1s linear infinite; }

@media (max-width: 700px) {
  .lyrics-search-body { grid-template-columns: 1fr; }
  .lyrics-search-list { border-right: none; border-bottom: 1px solid var(--border); max-height: 45%; }
}
```

Comprobar que `src/styles/library.css` está en la lista de `@import` de `src/index.css`. Si no lo está, añadirlo respetando el orden de cascada existente. Comprobar también que existe una animación `spin`; si no, añadirla:

```css
@keyframes spin { to { transform: rotate(360deg); } }
```

- [ ] **Step 3: Comprobar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

El `<>…</>` dentro del `.map` con dos hijos con `key` da un aviso de React sobre keys. Sustituirlo por `<Fragment key={r.id}>` importando `Fragment` de `react`, y quitar el `key` del `<button>`.

- [ ] **Step 4: Commit**

```bash
git add src/components/songs/LyricsSearchModal.tsx src/styles/library.css src/index.css
git commit -m "feat(buscador): modal de búsqueda con preview de slides"
```

---

### Task 8: La barra en el header de la Biblioteca

Cierra la feature: es el primer paso que la hace visible para un usuario real.

**Files:**
- Modify: `src/pages/LibraryView.tsx` (imports; `header-actions` en la línea ~473; nuevo estado y efecto de atajos)
- Modify: `src/styles/library.css` (añadir al final)

**Interfaces:**
- Consumes: `LyricsSearchModal` (Task 7), `ProInterestBadge` de `@/components/pricing/ProInterestBadge`.

- [ ] **Step 1: Añadir los imports**

En `src/pages/LibraryView.tsx`:

```tsx
import LyricsSearchModal from '@/components/songs/LyricsSearchModal'
import ProInterestBadge from '@/components/pricing/ProInterestBadge'
import { Globe } from 'lucide-react'
```

`Globe` ya está en el import de `lucide-react` de la línea 2; comprobar antes de duplicarlo.

- [ ] **Step 2: Añadir el estado y los atajos**

Junto al resto de `useState` del componente (cerca de la línea 36):

```tsx
const [showOnlineSearch, setShowOnlineSearch] = useState(false)
```

Y un efecto para los atajos:

```tsx
// Ctrl+K y «/» abren el buscador online, salvo mientras se escribe en un campo.
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    const escribiendo = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setShowOnlineSearch(true)
    } else if (e.key === '/' && !escribiendo) {
      e.preventDefault()
      setShowOnlineSearch(true)
    }
  }
  document.addEventListener('keydown', onKey)
  return () => document.removeEventListener('keydown', onKey)
}, [])
```

- [ ] **Step 3: Añadir la barra al header**

En `header-actions` (línea ~473), **antes** del botón «Nueva»:

```tsx
        <div className="header-actions">
          <button
            className="online-search-trigger"
            onClick={() => setShowOnlineSearch(true)}
            aria-label="Buscar canciones en internet"
          >
            <Globe size={14} opacity={0.6} />
            <span>Buscar online…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <ProInterestBadge source="online_search" align="right" />
          <button
            className="btn-primary"
            ...
```

- [ ] **Step 4: Montar el modal**

Al final del JSX de `LibraryView`, junto al `ConfirmDialog`:

```tsx
      {showOnlineSearch && <LyricsSearchModal onClose={() => setShowOnlineSearch(false)} />}
```

- [ ] **Step 5: Estilar la barra**

Añadir al final de `src/styles/library.css`:

```css
.online-search-trigger {
  display: inline-flex; align-items: center; gap: 8px;
  min-width: 210px; padding: 6px 10px;
  border: 1px solid var(--border); border-radius: 999px;
  background: var(--bg-elevated); color: var(--text-muted);
  font-size: 12px; cursor: text; text-align: left;
}
.online-search-trigger:hover { border-color: var(--text-muted); color: var(--text); }
.online-search-trigger span { flex: 1; }
.online-search-trigger kbd {
  font-size: 9px; padding: 1px 5px; border-radius: 4px;
  border: 1px solid var(--border); color: var(--text-muted); font-family: inherit;
}

@media (max-width: 700px) {
  .online-search-trigger { min-width: 0; }
  .online-search-trigger span, .online-search-trigger kbd { display: none; }
}
```

`cursor: text` es deliberado: hace que el botón se lea como un campo de búsqueda, que es el punto de todo el diseño.

- [ ] **Step 6: Comprobar tipos y suite completa**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: sin errores; toda la suite en verde.

- [ ] **Step 7: Probarlo a mano**

Run: `pnpm dev`

Recorrido mínimo, con sesión iniciada:

1. La Biblioteca muestra la barra «Buscar online…» en el header.
2. `Ctrl+K` abre el modal y el cursor entra en el campo.
3. Escribir `bienvenido espiritu santo`: aparecen filas esqueleto y luego **un solo resultado** de Miel San Marcos.
4. Escribir `renuevame`: unos 11 resultados, con los artistas del catálogo arriba y un separador «Otros resultados».
5. Elegir un resultado: el preview aparece **sin spinner**, ya cortado en slides.
6. «Agregar a mi biblioteca»: el botón pasa a «Ya está en tu biblioteca».
7. Cerrar el modal: la canción está en la lista y se puede proyectar.
8. Volver a buscar lo mismo: el resultado sale marcado `✓ ya la tienes`.
9. Borrar una letra de la query y volver a escribirla: vuelve al instante, desde caché.
10. `Escape` cierra.

Con una cuenta `founding`, `paid`, `trial` o admin, comprobar además que la canción aparece en `/admin` → Canciones pendientes. Con una cuenta `free` **no** aparecerá, y es el comportamiento esperado (ver el spec).

- [ ] **Step 8: Commit**

```bash
git add src/pages/LibraryView.tsx src/styles/library.css
git commit -m "feat(buscador): barra en el header de la Biblioteca con Ctrl+K"
```

---

## Cierre

- [ ] **Actualizar el grafo de codebase-memory**

`detect_changes` o reindexar, para que el grafo refleje los archivos nuevos.

- [ ] **Marcar el spec como implementado**

Cambiar la cabecera de `docs/superpowers/specs/2026-08-10-buscador-letras-online-design.md` a `Estado: implementado`.

- [ ] **Abrir el PR**

El cuerpo debe mencionar el arreglo de seguridad de `search_songs_community`, porque no se deduce del título de la feature.
