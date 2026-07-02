# Biblia paralela (dos idiomas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un modo opcional en la vista de la Biblia que muestra dos traducciones en paralelo, tanto en el panel de lectura (dos columnas) como en la proyección (dos líneas en el mismo slide).

**Architecture:** Un helper puro `pairVersesByNumber` alinea los versículos de dos traducciones por número. `BibleView` gana estado `parallelMode` + `secondaryTranslation` (persistidos en `localStorage`) y carga un segundo capítulo. El render de lectura usa el helper para dos columnas; `projectVerses` concatena primario+secundario por versículo. `ProjectionWindow.tsx` no cambia (ya renderiza slides multi-línea).

**Tech Stack:** React 18 + TypeScript, Zustand, Vitest, Vite. Gestor de paquetes: **pnpm** (nunca npm).

## Global Constraints

- Usar **pnpm** para todo comando (`pnpm test`, `pnpm build`). Nunca npm ni package-lock.json.
- No añadir dependencias nuevas.
- `ProjectionWindow.tsx` NO debe modificarse.
- Ambos idiomas en proyección con el mismo estilo (sin distinción visual).
- Seguir el patrón de persistencia existente en `BibleView` (`localStorage`, como `proclama-recent-verses`).

---

### Task 1: Helper puro `pairVersesByNumber`

**Files:**
- Modify: `src/services/bible.ts` (añadir al final, junto a los otros exports)
- Test: `src/test/parallelBible.test.ts` (crear)

**Interfaces:**
- Consumes: `BibleVerseResult` (ya exportado en `src/services/bible.ts`).
- Produces:
  - `interface ParallelVerseRow { num: number; primary?: BibleVerseResult; secondary?: BibleVerseResult }`
  - `export function pairVersesByNumber(primary: BibleVerseResult[], secondary: BibleVerseResult[]): ParallelVerseRow[]`
  - El número de versículo se extrae del final de `reference` con `/:(\d+)\s*$/`; si no matchea, se usa el índice + 1 como fallback.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/test/parallelBible.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { pairVersesByNumber } from '@/services/bible'
import type { BibleVerseResult } from '@/services/bible'

const v = (ref: string, text: string): BibleVerseResult => ({
  reference: ref, text, translation: 'X', bookId: 'jhn', chapter: 3
})

describe('pairVersesByNumber', () => {
  it('empareja versículos con el mismo número', () => {
    const primary = [v('Juan 3:16', 'Porque de tal manera'), v('Juan 3:17', 'Porque no envió')]
    const secondary = [v('John 3:16', 'For God so loved'), v('John 3:17', 'For God did not send')]
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows).toHaveLength(2)
    expect(rows[0].num).toBe(16)
    expect(rows[0].primary?.text).toBe('Porque de tal manera')
    expect(rows[0].secondary?.text).toBe('For God so loved')
  })

  it('deja secondary undefined cuando falta en la secundaria', () => {
    const primary = [v('Juan 3:16', 'A'), v('Juan 3:17', 'B')]
    const secondary = [v('John 3:16', 'C')]
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows).toHaveLength(2)
    expect(rows[1].num).toBe(17)
    expect(rows[1].primary?.text).toBe('B')
    expect(rows[1].secondary).toBeUndefined()
  })

  it('incluye versículos que solo existen en la secundaria', () => {
    const primary = [v('Juan 3:16', 'A')]
    const secondary = [v('John 3:16', 'C'), v('John 3:17', 'D')]
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows).toHaveLength(2)
    expect(rows[1].num).toBe(17)
    expect(rows[1].primary).toBeUndefined()
    expect(rows[1].secondary?.text).toBe('D')
  })

  it('ordena las filas por número de versículo', () => {
    const primary = [v('Juan 3:2', 'B'), v('Juan 3:1', 'A')]
    const secondary: BibleVerseResult[] = []
    const rows = pairVersesByNumber(primary, secondary)
    expect(rows.map(r => r.num)).toEqual([1, 2])
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm test src/test/parallelBible.test.ts`
Expected: FAIL con "pairVersesByNumber is not a function" / no export.

- [ ] **Step 3: Implementar el helper**

Añadir al final de `src/services/bible.ts`:

```ts
export interface ParallelVerseRow {
  num: number
  primary?: BibleVerseResult
  secondary?: BibleVerseResult
}

function verseNumberOf(v: BibleVerseResult, fallback: number): number {
  const m = v.reference.match(/:(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : fallback
}

// Alinea dos traducciones por número de versículo. Tolera conteos distintos
// (versificación diferente): cada fila trae primary y/o secondary según exista.
export function pairVersesByNumber(
  primary: BibleVerseResult[],
  secondary: BibleVerseResult[]
): ParallelVerseRow[] {
  const map = new Map<number, ParallelVerseRow>()

  primary.forEach((v, i) => {
    const num = verseNumberOf(v, i + 1)
    map.set(num, { num, primary: v })
  })

  secondary.forEach((v, i) => {
    const num = verseNumberOf(v, i + 1)
    const row = map.get(num) ?? { num }
    row.secondary = v
    map.set(num, row)
  })

  return Array.from(map.values()).sort((a, b) => a.num - b.num)
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm test src/test/parallelBible.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/bible.ts src/test/parallelBible.test.ts
git commit -m "feat(biblia): helper pairVersesByNumber para alinear traducciones"
```

---

### Task 2: Estado, persistencia y UI del header

**Files:**
- Modify: `src/pages/BibleView.tsx`

**Interfaces:**
- Consumes: `SUPPORTED_TRANSLATIONS`, `importedBibles` (ya en el componente).
- Produces (nuevo estado usado por Tasks 3 y 4):
  - `parallelMode: boolean`
  - `secondaryTranslation: string`
  - `secondaryVerses: BibleVerseResult[]`
  - `allTranslations` (lista sin filtrar por idioma, para el segundo dropdown)

- [ ] **Step 1: Añadir estado con persistencia**

En `src/pages/BibleView.tsx`, tras la línea `const [selectedTranslation, setSelectedTranslation] = useState('RVR1960')` (línea ~25), añadir:

```tsx
  const [parallelMode, setParallelMode] = useState<boolean>(
    () => localStorage.getItem('proclama-bible-parallel') === '1'
  )
  const [secondaryTranslation, setSecondaryTranslation] = useState<string>(
    () => localStorage.getItem('proclama-bible-secondary-translation') || 'KJV'
  )
  const [secondaryVerses, setSecondaryVerses] = useState<BibleVerseResult[]>([])
```

- [ ] **Step 2: Persistir cambios en localStorage**

Junto a los otros `useEffect` de persistencia (cerca del `useEffect` que guarda `recentVerses`, línea ~316), añadir:

```tsx
  useEffect(() => {
    localStorage.setItem('proclama-bible-parallel', parallelMode ? '1' : '0')
  }, [parallelMode])

  useEffect(() => {
    localStorage.setItem('proclama-bible-secondary-translation', secondaryTranslation)
  }, [secondaryTranslation])
```

- [ ] **Step 3: Construir la lista de traducciones sin filtrar y el default del otro idioma**

Tras la definición de `filteredTranslations` (línea ~72-75), añadir:

```tsx
  const allTranslations = [
    ...SUPPORTED_TRANSLATIONS,
    ...importedBibles.map(b => ({ id: b.id, name: b.name, lang: b.languageName }))
  ]

  const defaultOtherLangTranslation = () => {
    const primaryLang = SUPPORTED_TRANSLATIONS.find(t => t.id === selectedTranslation)?.lang ?? selectedLanguage
    const otherLang = primaryLang === 'Español' ? 'Inglés' : 'Español'
    return SUPPORTED_TRANSLATIONS.find(t => t.lang === otherLang)?.id ?? 'KJV'
  }

  const toggleParallel = () => {
    setParallelMode(prev => {
      const next = !prev
      if (next && (!secondaryTranslation || secondaryTranslation === selectedTranslation)) {
        setSecondaryTranslation(defaultOtherLangTranslation())
      }
      return next
    })
  }
```

- [ ] **Step 4: Añadir el botón "Paralelo" y el segundo dropdown en el header**

En el bloque `header-actions`, justo después del `<div>` que cierra el selector de traducción primario y el botón Importar (tras la línea ~546 `</div>` que cierra el contenedor del select + botones), añadir un separador y los controles paralelos. Insertar antes del cierre `</div>` de `header-actions`:

```tsx
          <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }}></div>

          <button
            onClick={toggleParallel}
            title="Mostrar dos idiomas en paralelo"
            style={{
              padding: '6px 14px',
              background: parallelMode ? 'var(--gold)' : 'var(--bg-elevated)',
              color: parallelMode ? '#000' : 'var(--text-primary)',
              border: `1px solid ${parallelMode ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease'
            }}
          >
            Paralelo
          </button>

          {parallelMode && (
            <select
              className="filter-select"
              value={secondaryTranslation}
              onChange={e => setSecondaryTranslation(e.target.value)}
              style={{
                maxWidth: '250px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem'
              }}
            >
              {allTranslations.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
```

- [ ] **Step 5: Verificar compilación**

Run: `pnpm build`
Expected: build sin errores de TypeScript. (Si sólo quieres el chequeo de tipos: `pnpm exec tsc --noEmit`.)

- [ ] **Step 6: Verificación manual**

Run: `pnpm dev`, abrir la vista de la Biblia.
Expected: aparece el botón "Paralelo". Al activarlo se pinta en dorado y aparece un segundo dropdown con todas las traducciones. Recargar la página conserva el estado (persistencia). Aún no cambia el contenido (eso es Task 3).

- [ ] **Step 7: Commit**

```bash
git add src/pages/BibleView.tsx
git commit -m "feat(biblia): toggle paralelo y selector de traduccion secundaria"
```

---

### Task 3: Panel de lectura en dos columnas

**Files:**
- Modify: `src/pages/BibleView.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `pairVersesByNumber`, `ParallelVerseRow` (Task 1); `parallelMode`, `secondaryTranslation`, `secondaryVerses` (Task 2).

- [ ] **Step 1: Importar el helper**

En el import de `@/services/bible` (línea 3), añadir `pairVersesByNumber`:

```tsx
import { BIBLE_BOOKS, fetchChapter, searchGlobal, getBookSuggestion, SUPPORTED_TRANSLATIONS, pairVersesByNumber } from '@/services/bible'
```

- [ ] **Step 2: Cargar el capítulo secundario**

Junto al `useEffect` que llama `loadChapter()` (línea ~320), añadir un efecto independiente:

```tsx
  useEffect(() => {
    if (!parallelMode) {
      setSecondaryVerses([])
      return
    }
    let cancelled = false
    fetchChapter(selectedBook, selectedChapter, secondaryTranslation)
      .then(r => { if (!cancelled) setSecondaryVerses(r) })
      .catch(() => { if (!cancelled) setSecondaryVerses([]) })
    return () => { cancelled = true }
  }, [parallelMode, selectedBook, selectedChapter, secondaryTranslation])
```

- [ ] **Step 3: Render condicional de la lista de versículos**

Reemplazar el bloque de render de versículos (líneas ~817-831, el `<div className="verses-list" ref={versesListRef}>` con su `.map`) por una versión que ramifica según `parallelMode`:

```tsx
            <div className="verses-list" ref={versesListRef}>
              {parallelMode
                ? pairVersesByNumber(verses, secondaryVerses).map((row) => {
                    const projectTarget = row.primary ?? row.secondary
                    const isProjected = projectTarget ? state.songTitle === projectTarget.reference : false
                    return (
                      <div
                        key={row.num}
                        data-verse={row.num}
                        className={`verse-item verse-item--parallel ${isProjected ? 'projected' : ''}`}
                        onClick={() => projectTarget && projectVerse(projectTarget)}
                      >
                        <span className="verse-number">{row.num}</span>
                        <div className="verse-parallel-cols">
                          <span className="verse-text-body">{row.primary?.text ?? ''}</span>
                          <span className="verse-text-body">{row.secondary?.text ?? ''}</span>
                        </div>
                      </div>
                    )
                  })
                : verses.map((verse, i) => (
                    <div
                      key={i}
                      data-verse={i + 1}
                      className={`verse-item ${state.songTitle === verse.reference ? 'projected' : ''}`}
                      onClick={() => projectVerse(verse)}
                    >
                      <span className="verse-number">{i + 1}</span>
                      <span className="verse-text-body">{verse.text}</span>
                    </div>
                  ))}
            </div>
```

- [ ] **Step 4: Añadir CSS de dos columnas**

En `src/index.css`, tras la regla `.verse-text-body` (línea ~1149), añadir:

```css
.verse-parallel-cols { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
```

- [ ] **Step 5: Verificar compilación**

Run: `pnpm build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual**

Run: `pnpm dev`, activar Paralelo con RVR1960 (primaria) y KJV (secundaria), abrir Juan 3.
Expected: cada versículo se ve en dos columnas alineadas por número (español izquierda, inglés derecha). Cambiar la traducción secundaria actualiza la columna derecha. Probar un capítulo con conteos distintos (ej. algunos Salmos) no rompe el render.

- [ ] **Step 7: Commit**

```bash
git add src/pages/BibleView.tsx src/index.css
git commit -m "feat(biblia): panel de lectura en dos columnas paralelas"
```

---

### Task 4: Proyección paralela

**Files:**
- Modify: `src/pages/BibleView.tsx`

**Interfaces:**
- Consumes: `parallelMode`, `secondaryTranslation` (Task 2); `fetchChapter`, `extractVerseNumber` (ya en el componente, línea ~292).
- Produces: `projectVerses` pasa a ser `async`; concatena primario+secundario por versículo cuando `parallelMode` está activo.

- [ ] **Step 1: Reescribir `projectVerses` con soporte paralelo**

Reemplazar la función `projectVerses` (líneas ~388-415) por:

```tsx
  const projectVerses = async (versesToProject: BibleVerseResult[]) => {
    if (versesToProject.length === 0) return

    let lyrics: string
    if (parallelMode) {
      const secByChapter = new Map<string, BibleVerseResult[]>()
      const parts: string[] = []
      for (const v of versesToProject) {
        let secText = ''
        if (v.bookId && v.chapter) {
          const key = `${v.bookId}:${v.chapter}`
          let secChapter = secByChapter.get(key)
          if (!secChapter) {
            secChapter = await fetchChapter(v.bookId, v.chapter, secondaryTranslation)
            secByChapter.set(key, secChapter)
          }
          const num = extractVerseNumber(v.reference)
          const sec = secChapter.find(s => extractVerseNumber(s.reference) === num)
          if (sec) secText = sec.text
        }
        // ponytail: primario+secundario en el mismo bloque (2 líneas). Con
        // theme.linesPerSlide=1 se separarían en slides distintos; blindar
        // sólo si en pruebas resulta molesto.
        parts.push(secText ? `${v.text}\n${secText}\n\n` : `${v.text}\n\n`)
      }
      lyrics = parts.join('')
    } else {
      lyrics = versesToProject.map(v => `${v.text}\n\n`).join('')
    }

    loadSong({
      title: versesToProject.map(v => v.reference).join(', '),
      artist: versesToProject[0].translation,
      lyrics,
      key: '',
      tags: ['Biblia'],
      language: selectedLanguage,
      usageCount: 0,
      isPublic: true,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }, true, 0)

    // Add to recent verses history
    versesToProject.forEach(verse => {
      setRecentVerses(prev => {
        const filtered = prev.filter(r => r.verse.reference !== verse.reference)
        return [{ verse, timestamp: Date.now() }, ...filtered].slice(0, 50)
      })
    })
  }
```

Nota: `projectVerse` (línea ~434) ya llama `projectVerses([verse])`; al volverse async devuelve una promesa que los handlers no necesitan await. No cambiar `projectVerse`.

- [ ] **Step 2: Verificar compilación**

Run: `pnpm build`
Expected: sin errores. (`projectVerses` async no requiere cambios en los callers; ignoran la promesa.)

- [ ] **Step 3: Verificación manual — lectura**

Run: `pnpm dev`, activar Paralelo (RVR1960 + KJV), abrir la ventana de proyección, clic en Juan 3:16.
Expected: la pantalla de proyección muestra el versículo en español e inglés como dos líneas dentro del mismo slide, con la cita "Juan 3:16" una sola vez. La fuente se auto-ajusta.

- [ ] **Step 4: Verificación manual — otros orígenes**

Probar proyectar desde: búsqueda global (ej. "Juan 3:16"), búsqueda rápida (tecla + libro/cap/vers) y la lista de Recientes.
Expected: en todos, con Paralelo activo, se proyectan ambos idiomas. Con Paralelo desactivado, se proyecta sólo el idioma primario (comportamiento original intacto).

- [ ] **Step 5: Commit**

```bash
git add src/pages/BibleView.tsx
git commit -m "feat(biblia): proyeccion de versiculos en dos idiomas paralelos"
```

---

## Notas de verificación final

- Correr toda la suite: `pnpm test` (debe seguir verde, incluyendo el nuevo `parallelBible.test.ts`).
- `pnpm build` limpio.
- Regresión: con Paralelo desactivado, la vista de la Biblia se comporta exactamente como antes (una columna, proyección de un idioma).
