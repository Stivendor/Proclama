# Diseño: `<ProjectionBackground>` — render de fondo unificado

## Contexto / problema

El stack de capas de fondo de la proyección (fondo color/imagen + video de fondo + overlay oscuro + capa de media/anuncio) está escrito a mano **3 veces** con diferencias sutiles:

- `src/pages/ProjectionWindow.tsx:378-427` — proyección real.
- `src/components/projection/ProjectionPreview.tsx:227-271` — preview de slide (`renderSlideContent`).
- `src/components/projection/ProjectionPreview.tsx:321-339` — preview de countdown (`renderCountdownContent`, sin capa media).

Consecuencia: cada bug de fondo/media hay que arreglarlo en cada copia por separado, y ya hay divergencias silenciosas (p.ej. `transform: scale(1.05)` en la proyección real vs `scale(1.1)` en previews; el video de media lleva `muted` en preview pero no en la real). El fix reciente del z-index del media (los anuncios sobre el video) vive en la copia real; las copias del preview lo espejan aparte.

## Objetivo

DRY / mantenibilidad: **una sola fuente de verdad** para el render del stack de fondo, sin cambiar el comportamiento observable. Riesgo bajo, alto valor. NO es un refactor de rendimiento (no hay problema de perf medido).

## Alcance

**Dentro:** extraer el stack fondo/video/overlay/media a un componente compartido y reemplazar los 3 call sites.

**Fuera (a propósito, para no romper el núcleo de proyección):**
- La capa de **texto** (slides y countdown) NO se toca — diverge más (font-sizing, títulos, refs) y es el mayor riesgo.
- No se cambia comportamiento. Las divergencias silenciosas se normalizan al valor de la **proyección real** (`scale(1.05)`, video de fondo `muted`).

## Componente

`src/components/projection/ProjectionBackground.tsx`

```ts
type Props = {
  theme: ProjectionTheme
  media?: ProjectionState['media'] | null   // null → no dibuja capa media (caso countdown)
  variant: 'live' | 'preview'
  filter?: string                            // override del filtro de fondo (countdown usa brightness);
                                             // default: `blur(${theme.backgroundBlur||0}px)`
  mediaVideoRef?: React.Ref<HTMLVideoElement> // solo 'live' (sync con VideoControls)
  ytPlayerRef?: <el mismo tipo que YoutubePlayerContainer recibe hoy en ProjectionWindow> // solo 'live'
}
```

Estructura renderizada (z-index conservados de la proyección real):

| capa | z-index | contenido |
|------|---------|-----------|
| fondo | 0 | color / `url(image)` según `theme.backgroundType`; `filter` + `transform: scale(1.05)` si hay blur |
| video de fondo | 1 | `<video muted loop autoPlay playsInline>` si `backgroundType==='video'` |
| overlay | 5 | `rgba(0,0,0, backgroundOverlayOpacity ?? 0.3)` |
| media | `isBackgroundMode ? 2 : 20` | anuncio; `background` transparent/negro; `filter`/`transform` solo en bg-mode; `objectFit = media.objectFit ?? (isBackgroundMode?'fill':'contain')` |

### Diferencias por `variant`

| aspecto | `live` | `preview` |
|--------|--------|-----------|
| video de media (anuncio) | `ref={mediaVideoRef}`, **con audio** (sin `muted`), `autoPlay loop` | `muted`, sin ref, `key`, `loop autoPlay` |
| YouTube de media | `<YoutubePlayerContainer url ytPlayerRef objectFit>` (player real) | thumbnail `<img src=img.youtube.com/vi/ID/hqdefault.jpg>` |
| imagen de media | `<img src objectFit>` | igual |

El resto de capas (fondo, video de fondo, overlay) son idénticas en ambos variants.

## Call sites resultantes

- `ProjectionWindow`: reemplaza las líneas 378-427 por
  `<ProjectionBackground variant="live" theme={theme} media={state.media} mediaVideoRef={videoRef} ytPlayerRef={ytPlayerRef} />`.
  (El texto/countdown que van encima quedan igual.)
- `ProjectionPreview` slide (`renderSlideContent`): reemplaza 227-271 por
  `<ProjectionBackground variant="preview" theme={theme} media={showMedia ? projectionState.media : null} />`.
- `ProjectionPreview` countdown (`renderCountdownContent`): reemplaza 321-339 por
  `<ProjectionBackground variant="preview" theme={mainTheme} media={null} filter={countdownBgFilter} />`.

## Testing / verificación

- **Unit** (`src/test/`): render del componente con jsdom — z-index del media según `isBackgroundMode`; `objectFit` según `isBackgroundMode`/`media.objectFit`; que no dibuje capa media cuando `media` es null; que el video de media en `live` no tenga `muted` y en `preview` sí.
- **Manual** (app real, no headless por el gate): proyección real con (a) video de fondo, (b) anuncio imagen, (c) anuncio video **con audio**, (d) anuncio YouTube; la barra de preview reflejando lo mismo; countdown con fondo.
- Suite completa actual (131 tests) debe seguir en verde; `pnpm tsc --noEmit` y `pnpm build` OK.

## Riesgos

- Romper la sincronización del `videoRef`/`ytPlayerRef` con `VideoControls` en la proyección real → el unit test + prueba manual (c)(d) lo cubren.
- Diferencias de autoplay/audio entre live y preview → explícitas en la tabla de variants.
