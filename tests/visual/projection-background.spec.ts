import { test, expect, type Page } from '@playwright/test';
import path from 'path';

// Carpeta de salida para las capturas (se pasa por env al ejecutar).
const OUT = process.env.SHOT_DIR || path.join(process.cwd(), 'test-results', 'projection-bg');

// Imágenes deterministas embebidas: sin red, misma salida en cada corrida.
const IMG_BG =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#9333ea"/>
       </linearGradient></defs>
       <rect width="640" height="360" fill="url(#g)"/>
       <circle cx="160" cy="90" r="60" fill="#fbbf24"/>
       <rect x="380" y="200" width="200" height="120" fill="#10b981"/>
     </svg>`
  ).toString('base64');

const IMG_MEDIA =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
       <rect width="400" height="400" fill="#dc2626"/>
       <text x="200" y="220" font-size="48" fill="#fff" text-anchor="middle" font-family="sans-serif">ANUNCIO</text>
     </svg>`
  ).toString('base64');

const BASE_THEME = {
  background: '#0a0a0f',
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 72,
  textColor: '#ffffff',
  textShadow: true,
  transition: 'fade',
  showTitle: false,
  showVerseLabel: false,
  backgroundType: 'color',
  backgroundBlur: 0,
  backgroundOverlayOpacity: 0.3,
  backgroundVideoUrl: '',
  fontSizeMax: false,
  titlePosition: 'top',
  verseReferencePosition: 'bottom',
  textUppercase: true,
  fontScale: 1,
  showBibleVersion: true,
  linesPerSlide: 2,
};

const SLIDES = [{ index: 0, label: '[Coro]', lines: ['Grande es tu fidelidad', 'oh Dios mi Padre'] }];

/** Publica un PROJECTION_UPDATE igual que lo hace la ventana de control. */
async function project(page: Page, state: Record<string, unknown>) {
  await page.evaluate((s) => {
    const ch = new BroadcastChannel('proclama-projection');
    ch.postMessage({ type: 'PROJECTION_UPDATE', payload: s });
    ch.close();
  }, state);

  // Espera determinista: sin esto la captura sale a mitad de la decodificación de
  // la imagen o del transition de opacidad, y el mismo commit da capturas distintas.
  await page.waitForFunction(async () => {
    await document.fonts.ready;
    const imgs = Array.from(document.images);
    if (!imgs.every((i) => i.complete && i.naturalWidth > 0)) return false;
    await Promise.all(imgs.map((i) => i.decode().catch(() => null)));
    return true;
  }, null, { timeout: 10000 });
  // La capa de texto entra con transition de opacidad 0.5s.
  await page.waitForTimeout(900);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
}

const SCENARIOS: Array<{ name: string; state: Record<string, unknown> }> = [
  {
    name: '01-fondo-color',
    state: { songId: null, songTitle: '', slides: SLIDES, currentSlide: 0, theme: BASE_THEME, media: null },
  },
  {
    name: '02-fondo-imagen',
    state: {
      songId: null, songTitle: '', slides: SLIDES, currentSlide: 0, media: null,
      theme: { ...BASE_THEME, backgroundType: 'image', backgroundImageUrl: IMG_BG },
    },
  },
  {
    name: '03-fondo-imagen-blur-overlay',
    state: {
      songId: null, songTitle: '', slides: SLIDES, currentSlide: 0, media: null,
      theme: { ...BASE_THEME, backgroundType: 'image', backgroundImageUrl: IMG_BG, backgroundBlur: 12, backgroundOverlayOpacity: 0.6 },
    },
  },
  {
    name: '04-media-modo-fondo',
    state: {
      songId: null, songTitle: '', slides: SLIDES, currentSlide: 0,
      theme: { ...BASE_THEME, backgroundBlur: 8 },
      media: { url: IMG_MEDIA, type: 'image', isBackgroundMode: true, name: 'fondo' },
    },
  },
  {
    name: '05-anuncio-pantalla-completa',
    state: {
      songId: null, songTitle: '', slides: SLIDES, currentSlide: 0, theme: BASE_THEME,
      media: { url: IMG_MEDIA, type: 'image', isBackgroundMode: false, name: 'anuncio' },
    },
  },
  {
    name: '06-anuncio-objectfit-cover',
    state: {
      songId: null, songTitle: '', slides: SLIDES, currentSlide: 0, theme: BASE_THEME,
      media: { url: IMG_MEDIA, type: 'image', isBackgroundMode: false, objectFit: 'cover', name: 'anuncio' },
    },
  },
  {
    name: '07-biblia-con-cita-sobre-imagen',
    state: {
      songId: null, songTitle: 'Juan 3:16', isBible: true,
      slides: [{ index: 0, label: '', lines: ['Porque de tal manera amó Dios al mundo'] }],
      currentSlide: 0, media: null,
      theme: { ...BASE_THEME, backgroundType: 'image', backgroundImageUrl: IMG_BG, backgroundOverlayOpacity: 0.45 },
    },
  },
];

/** Falla el test ante cualquier excepción de render en la ventana de proyección. */
function failOnPageError(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(String(e)));
}

test.describe('ProjectionBackground — render de la ventana de proyección', () => {
  for (const { name, state } of SCENARIOS) {
    test(name, async ({ page }) => {
      const errors: string[] = [];
      failOnPageError(page, errors);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/projection');
      // La ventana arranca en negro hasta recibir estado del control.
      await page.waitForTimeout(300);
      await project(page, state);
      await page.screenshot({ path: path.join(OUT, `${name}.png`) });

      // El estado llegó y ProjectionBackground pintó sin romper el render.
      expect(errors, `errores de render: ${errors.join(' | ')}`).toEqual([]);
      const bg = page.locator('div[style*="z-index: 0"]').first();
      await expect(bg).toBeAttached();
      // La capa de media solo existe cuando el operador proyecta media.
      const mediaLayer = page.getByTestId('media-layer');
      if (state.media) await expect(mediaLayer).toBeAttached();
      else await expect(mediaLayer).toHaveCount(0);
    });
  }
});
