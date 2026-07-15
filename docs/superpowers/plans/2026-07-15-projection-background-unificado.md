# ProjectionBackground (render de fondo unificado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer el stack de capas de fondo de proyección (fondo + video + overlay + media) a un solo componente `<ProjectionBackground>` y reemplazar las 3 copias duplicadas, sin cambiar el comportamiento observable.

**Architecture:** Un componente presentacional puro (`src/components/projection/ProjectionBackground.tsx`) que recibe `theme`/`media`/`variant` y renderiza las capas con los z-index de la proyección real. Las diferencias legítimas entre la proyección real y los previews (refs de video/YouTube player, `muted`, thumbnail) se resuelven con la prop `variant: 'live' | 'preview'`. La capa de texto NO se toca.

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react (jsdom).

## Global Constraints

- Usar **pnpm**, nunca npm.
- No cambiar comportamiento observable; normalizar divergencias al valor de la **proyección real** (`transform: scale(1.05)`, video de fondo `muted`).
- La suite completa (131 tests) debe seguir verde; `pnpm tsc --noEmit` y `pnpm build` OK.
- La capa de texto (slides/countdown) queda **fuera de alcance**.
- Z-index conservados: fondo `0`, video `1`, overlay `5`, media `isBackgroundMode ? 2 : 20`.
- `objectFit` de media = `media.objectFit ?? (media.isBackgroundMode ? 'fill' : 'contain')`.

## File Structure

- **Create:** `src/components/projection/ProjectionBackground.tsx` — el componente compartido + los helpers `loadYoutubeAPI` y `YoutubePlayerContainer` movidos desde `ProjectionWindow.tsx`.
- **Create:** `src/test/ProjectionBackground.test.tsx` — unit tests del componente.
- **Modify:** `src/pages/ProjectionWindow.tsx` — usa el componente (variant `live`); se le quitan `loadYoutubeAPI`, `YoutubePlayerContainer` y el bloque de capas 378-427.
- **Modify:** `src/components/projection/ProjectionPreview.tsx` — usa el componente en `renderSlideContent` y `renderCountdownContent` (variant `preview`).

---

### Task 1: Crear `<ProjectionBackground>` + tests

**Files:**
- Create: `src/components/projection/ProjectionBackground.tsx`
- Test: `src/test/ProjectionBackground.test.tsx`

**Interfaces:**
- Consumes: `ProjectionTheme`, `ProjectionState` de `@/types`; `getYoutubeId` de `@/utils/youtube`.
- Produces: `export default function ProjectionBackground(props: Props)` con
  `Props = { theme: ProjectionTheme; media?: ProjectionState['media'] | null; variant: 'live' | 'preview'; filter?: string; mediaVideoRef?: React.Ref<HTMLVideoElement>; ytPlayerRef?: React.MutableRefObject<any> }`.

- [ ] **Step 1: Escribir el test que falla**

`src/test/ProjectionBackground.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProjectionBackground from '@/components/projection/ProjectionBackground'
import { DEFAULT_THEME } from '@/stores'

const theme = { ...DEFAULT_THEME }

describe('ProjectionBackground', () => {
  it('no dibuja capa media cuando media es null', () => {
    const { queryByTestId } = render(<ProjectionBackground theme={theme} media={null} variant="preview" />)
    expect(queryByTestId('media-layer')).toBeNull()
  })

  it('media en background mode va detrás del texto (zIndex 2, objectFit fill)', () => {
    const media = { url: 'blob:x', type: 'image', isBackgroundMode: true, name: 'x' } as any
    const { getByTestId, container } = render(<ProjectionBackground theme={theme} media={media} variant="preview" />)
    expect(getByTestId('media-layer').style.zIndex).toBe('2')
    expect(container.querySelector('img')?.style.objectFit).toBe('fill')
  })

  it('anuncio pantalla completa va sobre el texto (zIndex 20, objectFit contain)', () => {
    const media = { url: 'blob:x', type: 'image', isBackgroundMode: false, name: 'x' } as any
    const { getByTestId, container } = render(<ProjectionBackground theme={theme} media={media} variant="preview" />)
    expect(getByTestId('media-layer').style.zIndex).toBe('20')
    expect(container.querySelector('img')?.style.objectFit).toBe('contain')
  })

  it('video de anuncio: muted en preview, con audio en live', () => {
    const media = { url: 'blob:v', type: 'video', isBackgroundMode: false, name: 'v' } as any
    const prev = render(<ProjectionBackground theme={theme} media={media} variant="preview" />)
    expect(prev.container.querySelector('video')?.muted).toBe(true)
    const live = render(<ProjectionBackground theme={theme} media={media} variant="live" />)
    expect(live.container.querySelector('video')?.muted).toBe(false)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm vitest --run src/test/ProjectionBackground.test.tsx`
Expected: FAIL — no existe `@/components/projection/ProjectionBackground`.

- [ ] **Step 3: Implementar el componente**

`src/components/projection/ProjectionBackground.tsx`. Los helpers `loadYoutubeAPI` (hoy en `ProjectionWindow.tsx:8-36`) y `YoutubePlayerContainer` (`ProjectionWindow.tsx:37-128`) se **mueven verbatim** aquí (cortar de ProjectionWindow en Task 2).

```tsx
import { useEffect, useRef } from 'react'
import type { ProjectionState, ProjectionTheme } from '@/types'
import { getYoutubeId } from '@/utils/youtube'

// ── movidos verbatim desde ProjectionWindow.tsx ──
function loadYoutubeAPI(callback: () => void) {
  // (cuerpo idéntico al de ProjectionWindow.tsx:8-36)
}
function YoutubePlayerContainer({ url, ytPlayerRef, objectFit }: { url: string; ytPlayerRef: React.MutableRefObject<any>; objectFit: 'cover' | 'contain' | 'fill' }) {
  // (cuerpo idéntico al de ProjectionWindow.tsx:37-128)
}

type Props = {
  theme: ProjectionTheme
  media?: ProjectionState['media'] | null
  variant: 'live' | 'preview'
  filter?: string
  mediaVideoRef?: React.Ref<HTMLVideoElement>
  ytPlayerRef?: React.MutableRefObject<any>
}

export default function ProjectionBackground({ theme, media, variant, filter, mediaVideoRef, ytPlayerRef }: Props) {
  const bgFilter = filter ?? `blur(${theme.backgroundBlur || 0}px)`
  const bgTransform = theme.backgroundBlur ? 'scale(1.05)' : 'none'
  const bg =
    theme.backgroundType === 'image' && theme.backgroundImageUrl
      ? `url(${theme.backgroundImageUrl}) center/cover no-repeat`
      : theme.backgroundType === 'color' || !theme.backgroundType
        ? theme.background
        : '#000'

  const fit = media
    ? media.objectFit || (media.isBackgroundMode ? 'fill' : 'contain')
    : 'contain'

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, filter: bgFilter, transform: bgTransform, background: bg }} />

      {theme.backgroundType === 'video' && theme.backgroundVideoUrl && (
        <video
          key={theme.backgroundVideoUrl}
          src={theme.backgroundVideoUrl}
          autoPlay muted loop playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1, filter: bgFilter, transform: bgTransform }}
        />
      )}

      <div style={{ position: 'absolute', inset: 0, zIndex: 5, backgroundColor: `rgba(0,0,0,${theme.backgroundOverlayOpacity ?? 0.3})` }} />

      {media && (
        <div
          data-testid="media-layer"
          style={{
            position: 'absolute', inset: 0, zIndex: media.isBackgroundMode ? 2 : 20,
            background: media.isBackgroundMode ? 'transparent' : '#000',
            filter: media.isBackgroundMode ? bgFilter : 'none',
            transform: media.isBackgroundMode ? bgTransform : 'none',
          }}
        >
          {media.type === 'video' ? (
            <video
              key={media.url}
              ref={variant === 'live' ? mediaVideoRef : undefined}
              src={media.url}
              autoPlay loop playsInline
              muted={variant === 'preview'}
              style={{ width: '100%', height: '100%', objectFit: fit }}
            />
          ) : media.type === 'youtube' ? (
            variant === 'live' ? (
              <YoutubePlayerContainer url={media.url} ytPlayerRef={ytPlayerRef!} objectFit={fit} />
            ) : (
              <img src={`https://img.youtube.com/vi/${getYoutubeId(media.url)}/hqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} />
            )
          ) : (
            <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: fit }} />
          )}
        </div>
      )}
    </>
  )
}
```

Nota: en Task 1 los helpers pueden copiarse (aún no borrados de ProjectionWindow); Task 2 los borra del origen. Al terminar Task 2 no habrá duplicado.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pnpm vitest --run src/test/ProjectionBackground.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/projection/ProjectionBackground.tsx src/test/ProjectionBackground.test.tsx
git commit -m "feat(projection): componente ProjectionBackground compartido con tests"
```

---

### Task 2: Usar el componente en `ProjectionWindow` (variant live)

**Files:**
- Modify: `src/pages/ProjectionWindow.tsx`

**Interfaces:**
- Consumes: `ProjectionBackground` (Task 1). `videoRef: React.RefObject<HTMLVideoElement>` y `ytPlayerRef: React.MutableRefObject<any>` ya existen en el componente (`ProjectionWindow.tsx:147-148`).

- [ ] **Step 1: Importar el componente y borrar los helpers movidos**

Añadir el import (junto al resto de imports de la parte superior):
```tsx
import ProjectionBackground from '@/components/projection/ProjectionBackground'
```
Borrar de `ProjectionWindow.tsx` las funciones locales `loadYoutubeAPI` (líneas 8-36) y `YoutubePlayerContainer` (líneas 37-128) — ya viven en `ProjectionBackground.tsx`.
Quitar el import ahora sin uso `import { getYoutubeId } from '@/utils/youtube'` (línea 6) si ya no se referencia en el archivo.

- [ ] **Step 2: Reemplazar el bloque de capas por el componente**

Sustituir el bloque de capas fondo/video/overlay/media (actualmente `ProjectionWindow.tsx:378-427`, que empieza en `{/* Fondo */}` y termina en el cierre del bloque `{state.media && ( ... )}`) por:
```tsx
        <ProjectionBackground
          variant="live"
          theme={theme}
          media={state.media}
          mediaVideoRef={videoRef}
          ytPlayerRef={ytPlayerRef}
        />
```
(El resto —countdown y texto de slide, que van encima con zIndex 10— queda igual.)

- [ ] **Step 3: Typecheck**

Run: `pnpm tsc --noEmit`
Expected: sin errores (si sobra algún import como `bgStyle`/`useEffect` no es el caso; solo `getYoutubeId` debería quedar sin uso y se quitó en Step 1).

- [ ] **Step 4: Correr toda la suite**

Run: `pnpm test`
Expected: PASS (132 tests: 131 previos + los 4 nuevos del componente cuentan como 1 archivo; el total debe subir y quedar todo verde).

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: build OK (dist generado).

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectionWindow.tsx
git commit -m "refactor(projection): ProjectionWindow usa ProjectionBackground"
```

---

### Task 3: Usar el componente en `ProjectionPreview` (slide + countdown)

**Files:**
- Modify: `src/components/projection/ProjectionPreview.tsx`

**Interfaces:**
- Consumes: `ProjectionBackground` (Task 1). Estado local existente: `showMedia` (bool), `projectionState`, `mainTheme`, y el `bgFilter` de countdown (`ProjectionPreview.tsx:316`).

- [ ] **Step 1: Importar el componente**

```tsx
import ProjectionBackground from '@/components/projection/ProjectionBackground'
```

- [ ] **Step 2: Reemplazar el bloque de fondo en `renderSlideContent`**

Sustituir el bloque `{showMedia && ( <> ...bg, video, overlay, media... </> )}` (actualmente `ProjectionPreview.tsx:225-273`) por:
```tsx
        {showMedia && (
          <ProjectionBackground variant="preview" theme={theme} media={projectionState.media} />
        )}
```
(El bloque de texto de slide de abajo —`{slide ? (...) : (...)}`— queda igual.)

- [ ] **Step 3: Reemplazar el bloque de fondo en `renderCountdownContent`**

Sustituir las capas fondo/video/overlay (actualmente `ProjectionPreview.tsx:321-339`) por:
```tsx
        <ProjectionBackground variant="preview" theme={mainTheme} media={null} filter={bgFilter} />
```
(`bgFilter` es la variable ya definida en `renderCountdownContent` con `blur(...) brightness(...)`. El texto del countdown de abajo queda igual.)

- [ ] **Step 4: Quitar imports sin uso**

Si `getYoutubeId` (u otros helpers que solo usaba el bloque de media del preview) quedan sin referencias, quitarlos del import de `ProjectionPreview.tsx`.

- [ ] **Step 5: Typecheck + suite + build**

Run: `pnpm tsc --noEmit` → sin errores.
Run: `pnpm test` → todo verde.
Run: `pnpm build` → OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/projection/ProjectionPreview.tsx
git commit -m "refactor(projection): ProjectionPreview usa ProjectionBackground"
```

---

## Verificación manual final (app real)

No es headless por el gate de landing/auth. En la app:
1. Proyección real: fondo color, fondo imagen, fondo video → se ven correctos.
2. Anuncio imagen (bg-mode y pantalla completa), anuncio **video con audio**, anuncio YouTube (player real) → correctos en la ventana de proyección.
3. La barra de preview inferior refleja lo mismo (YouTube como thumbnail, videos en mute).
4. Countdown con fondo → correcto.
5. Navegar slides quita el anuncio y vuelve el fondo (regresión previa, sigue OK).

## Self-review (cobertura del spec)

- Componente compartido + 3 call sites → Tasks 1-3. ✓
- Diferencias por variant (ref/muted/youtube) → Task 1 Step 3 + test Step 1. ✓
- Capa de texto fuera de alcance → Tasks 2-3 solo tocan el bloque de fondo. ✓
- Normalización (`scale(1.05)`, `muted`) → Task 1 usa esos valores. ✓
- Countdown con brightness filter → Task 3 Step 3 pasa `filter={bgFilter}`. ✓
- Tests/tsc/build verdes → steps de verificación en cada task. ✓
