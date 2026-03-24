# Implementation Plan: seo-web-positioning

## Overview

Plan de implementación incremental para las mejoras de SEO y posicionamiento web de Proclama (React 18 + TypeScript + Vite 6 en Vercel). Cada tarea construye sobre la anterior y termina con la integración completa.

## Tasks

- [ ] 1. Verificar y completar OG Image, Favicon SVG y meta tags en index.html
  - [ ] 1.1 Auditar `public/og-image.png` y `public/favicon.svg` existentes
    - Verificar que `og-image.png` tenga exactamente 1200×630 px
    - Verificar que `favicon.svg` sea legible en fondos oscuros y claros
    - Si no cumplen las dimensiones/legibilidad, regenerar los archivos en `public/`
    - _Requirements: 1.1, 1.2, 1.4_
  - [ ] 1.2 Auditar y completar las meta tags Open Graph y Twitter Card en `index.html`
    - Confirmar que `og:image` y `twitter:image` apuntan a `https://proclama.vercel.app/og-image.png`
    - Confirmar que `og:type`, `og:url`, `og:title`, `og:description` están presentes y correctos
    - Confirmar que `twitter:card` es `summary_large_image`
    - _Requirements: 1.3, 1.5_

- [ ] 2. Completar y validar Schema.org SoftwareApplication en index.html
  - [ ] 2.1 Revisar el bloque `<script type="application/ld+json">` existente en `index.html`
    - Confirmar que incluye: `name`, `description`, `applicationCategory: "ReligiousApp"`, `operatingSystem: "Web"`, `offers` (price: 0, priceCurrency: USD), `url`
    - Eliminar el campo `aggregateRating` si no hay valoraciones reales
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [ ]* 2.2 Escribir test de validación del JSON-LD
    - Parsear el bloque `<script type="application/ld+json">` del HTML de salida del build
    - Verificar que todos los campos requeridos están presentes y con los valores correctos
    - Verificar que `aggregateRating` no está presente
    - _Requirements: 2.4_

- [ ] 3. Actualizar sitemap.xml y robots.txt
  - [ ] 3.1 Actualizar `public/sitemap.xml` con la fecha real de última modificación
    - Cambiar `<lastmod>` al valor de la fecha actual del build en formato `YYYY-MM-DD`
    - Confirmar que `<changefreq>monthly</changefreq>` y `<priority>1.0</priority>` están presentes
    - _Requirements: 3.1, 3.2_
  - [ ] 3.2 Verificar `public/robots.txt`
    - Confirmar que contiene `User-agent: *`, `Allow: /` y `Sitemap: https://proclama.vercel.app/sitemap.xml`
    - _Requirements: 3.3, 3.4_

- [ ] 4. Checkpoint — Verificar meta tags, schema y archivos estáticos
  - Asegurarse de que el build de Vite (`npm run build`) completa sin errores
  - Confirmar que `dist/index.html` contiene los meta tags OG, el JSON-LD y el enlace al favicon SVG
  - Preguntar al usuario si hay dudas antes de continuar.

- [ ] 5. Mejorar el CTA principal y los textos de la Landing Page
  - [ ] 5.1 Actualizar los botones CTA en `src/pages/LandingView.tsx`
    - Cambiar el texto del botón hero primary de `"Empezar ahora"` a `"Usar gratis ahora"`
    - Confirmar que el botón CTA de `cta-final` ya tiene el texto `"Usar gratis ahora"` (ya existe); si no, actualizarlo
    - Mantener el comportamiento `onClick={() => setShowAuth(true)}` en ambos botones
    - Mantener el botón "Acceder" de la nav y el botón "Ver funciones" sin cambios
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Integrar keywords long-tail en el contenido visible de LandingView.tsx
  - [ ] 6.1 Añadir keywords long-tail en el párrafo del hero y en las FeatureCards
    - Incluir "alternativa gratuita a EasyWorship" de forma natural en el párrafo `<p>` del hero
    - Incluir "proyección de letras para iglesias sin instalación" en el párrafo del hero o en una FeatureCard
    - Incluir "software de proyección para iglesias" en al menos un `<h2>`, `<h3>` o `<p>` del cuerpo
    - Asegurarse de que el texto resulta natural y legible (sin keyword stuffing)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Mejorar el contenido de la Landing Page para conversión y SEO
  - [ ] 7.1 Añadir/refinar la propuesta de valor en el hero de `LandingView.tsx`
    - Asegurarse de que el párrafo del hero explica en 2-3 oraciones qué es Proclama, para quién es y qué problema resuelve
    - Verificar que el `<h1>` del hero es el único `<h1>` de la página
    - Verificar que las secciones usan `<h2>` para sus títulos (jerarquía semántica correcta)
    - _Requirements: 6.1, 6.6_
  - [ ] 7.2 Revisar y mejorar las FeatureCards para mencionar beneficios concretos
    - Confirmar que al menos 4 FeatureCards mencionan beneficios medibles ("sin instalación", "gratis", "en el navegador", etc.)
    - Añadir o ajustar una FeatureCard o párrafo que compare implícitamente con soluciones de pago como EasyWorship
    - _Requirements: 6.2, 6.3_
  - [ ] 7.3 Añadir atributos `alt` descriptivos a todas las imágenes de la landing
    - Revisar si hay elementos `<img>` en `LandingView.tsx` y añadir `alt` descriptivo a cada uno
    - _Requirements: 6.5_
  - [ ]* 7.4 Escribir tests de estructura semántica HTML
    - Verificar que el HTML renderizado contiene exactamente un `<h1>`
    - Verificar que los títulos de sección usan `<h2>`
    - Verificar que el contenido principal es visible sin scroll en viewport estándar (1280×800)
    - _Requirements: 6.4, 6.6_

- [ ] 8. Checkpoint — Verificar landing page actualizada
  - Asegurarse de que el build completa sin errores TypeScript
  - Revisar visualmente que los CTAs, keywords y jerarquía semántica son correctos
  - Preguntar al usuario si hay dudas antes de continuar.

- [ ] 9. Implementar pre-rendering estático (SSG) con vite-ssg
  - [ ] 9.1 Instalar y configurar `vite-ssg` en el proyecto
    - Instalar `vite-ssg` como dependencia de desarrollo: `npm install -D vite-ssg`
    - Modificar `vite.config.ts` para integrar el plugin de vite-ssg
    - Crear o adaptar el entry point SSG (ej. `src/main-ssg.ts`) que exporte la función de render
    - _Requirements: 7.1, 7.3, 7.5_
  - [ ] 9.2 Adaptar `src/main.tsx` para soportar hidratación tras el pre-rendering
    - Cambiar `ReactDOM.createRoot(...).render(...)` por la variante compatible con SSG/hidratación
    - Asegurarse de que la SPA completa sigue funcionando tras la hidratación
    - _Requirements: 7.5_
  - [ ] 9.3 Verificar que el HTML pre-renderizado incluye el contenido de la landing
    - Confirmar que `dist/index.html` contiene el `<h1>`, el párrafo de descripción y las FeatureCards en el HTML estático
    - Confirmar que el HTML es válido (sin errores de estructura)
    - _Requirements: 7.1, 7.2, 7.6_
  - [ ]* 9.4 Escribir test de validación del HTML pre-renderizado
    - Parsear `dist/index.html` tras el build
    - Verificar que `<h1>` está presente en el HTML estático
    - Verificar que al menos 4 FeatureCards están presentes en el HTML estático
    - Verificar que el HTML no contiene errores de estructura básica (tags sin cerrar, anidamiento inválido)
    - _Requirements: 7.2, 7.6_

- [ ] 10. Final checkpoint — Asegurarse de que todo el pipeline funciona
  - Ejecutar `npm run build` y confirmar que el tiempo de build no supera 60 segundos
  - Confirmar que `dist/index.html` contiene: meta OG, JSON-LD, `<h1>` del hero, FeatureCards y CTAs
  - Confirmar que la SPA se hidrata correctamente en el navegador
  - Preguntar al usuario si hay dudas antes de dar por completado el feature.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- El lenguaje de implementación es TypeScript/React (stack existente del proyecto)
- vite-ssg es la solución recomendada por ser compatible con Vite 6 y Vercel sin configuración adicional de servidor
- Si el tiempo de build supera 60 segundos con vite-ssg, evaluar la alternativa de inyección estática en `index.html` (ya parcialmente implementada con el bloque `display:none`)
- Cada tarea referencia los requisitos específicos para trazabilidad completa
