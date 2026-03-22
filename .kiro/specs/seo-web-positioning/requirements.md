# Requirements Document

## Introduction

Este feature cubre todas las mejoras de SEO y posicionamiento web para Proclama, una aplicación de proyección de alabanzas y Biblia para iglesias. El objetivo es maximizar la visibilidad orgánica en buscadores, mejorar la tasa de conversión de la landing page y garantizar que el contenido sea correctamente indexado por Google, incluyendo soporte para compartir en redes sociales con previsualizaciones ricas.

Proclama es una SPA (React + Vite) desplegada en Vercel sin router tradicional. La navegación se gestiona con estado Zustand. La landing page (`LandingView.tsx`) es visible para usuarios no autenticados y es el principal punto de entrada orgánico.

## Glossary

- **Landing_Page**: La vista `LandingView.tsx`, visible para usuarios no autenticados, que actúa como página principal de marketing.
- **OG_Image**: Imagen Open Graph de 1200×630 px usada en previsualizaciones de redes sociales y mensajería.
- **Schema_Markup**: Datos estructurados en formato JSON-LD siguiendo el vocabulario schema.org, embebidos en `index.html`.
- **Sitemap**: Archivo `sitemap.xml` que lista las URLs del sitio para facilitar la indexación por crawlers.
- **Robots_File**: Archivo `robots.txt` que indica a los crawlers qué rutas pueden o no rastrear.
- **Pre_Rendering**: Técnica que genera HTML estático en tiempo de build para que los crawlers indexen contenido sin ejecutar JavaScript.
- **CTA**: Call To Action, botón o enlace que invita al usuario a realizar una acción clave (registrarse, usar la app).
- **Long_Tail_Keywords**: Frases de búsqueda específicas y de menor competencia que atraen tráfico cualificado.
- **Favicon_SVG**: Icono del sitio en formato SVG, escalable y con soporte para modo oscuro/claro.
- **Structured_Data**: Sinónimo de Schema_Markup en este documento.

---

## Requirements

### Requirement 1: Open Graph Image y Favicon SVG

**User Story:** Como responsable de comunicaciones de una iglesia, quiero que al compartir el enlace de Proclama en WhatsApp, Telegram o redes sociales aparezca una previsualización visual atractiva, para que más personas hagan clic y conozcan la herramienta.

#### Acceptance Criteria

1. THE Landing_Page SHALL servir una OG_Image de exactamente 1200×630 píxeles en la ruta `/og-image.png`.
2. THE Landing_Page SHALL servir un Favicon_SVG en la ruta `/favicon.svg` que sea legible en fondos oscuros y claros.
3. WHEN un crawler de redes sociales accede a `https://proclama.vercel.app/`, THE Landing_Page SHALL retornar las etiquetas `og:image` y `twitter:image` apuntando a la OG_Image.
4. THE OG_Image SHALL contener el nombre "Proclama", un tagline descriptivo y elementos visuales que comuniquen el propósito de la app (proyección para iglesias).
5. IF la OG_Image no está disponible en el servidor, THEN THE Landing_Page SHALL mostrar igualmente el contenido textual de las etiquetas Open Graph sin errores.

---

### Requirement 2: Datos Estructurados (Schema.org SoftwareApplication)

**User Story:** Como administrador de la iglesia que busca en Google "software proyección iglesia gratis", quiero ver información enriquecida sobre Proclama en los resultados de búsqueda, para evaluar rápidamente si es la herramienta que necesito.

#### Acceptance Criteria

1. THE Schema_Markup SHALL estar embebido en `index.html` como un bloque `<script type="application/ld+json">`.
2. THE Schema_Markup SHALL declarar el tipo `SoftwareApplication` con los campos: `name`, `description`, `applicationCategory`, `operatingSystem`, `offers` (precio 0, moneda USD) y `url`.
3. THE Schema_Markup SHALL incluir el campo `aggregateRating` solo si existen valoraciones reales; en caso contrario, THE Schema_Markup SHALL omitir dicho campo para evitar penalizaciones de Google.
4. WHEN Google Search Console valida la página, THE Schema_Markup SHALL pasar la validación del Rich Results Test sin errores críticos.
5. THE Schema_Markup SHALL declarar `applicationCategory` con el valor `"ReligiousApp"` y `operatingSystem` con `"Web"`.

---

### Requirement 3: Sitemap y Robots.txt actualizados

**User Story:** Como webmaster, quiero que el sitemap refleje la fecha real de última modificación y que robots.txt lo referencie correctamente, para que Google rastree el sitio con información precisa.

#### Acceptance Criteria

1. THE Sitemap SHALL contener la URL `https://proclama.vercel.app/` con el campo `<lastmod>` igual a la fecha de la última actualización del sitio en formato `YYYY-MM-DD`.
2. THE Sitemap SHALL declarar `<changefreq>monthly</changefreq>` y `<priority>1.0</priority>` para la URL raíz.
3. THE Robots_File SHALL contener la directiva `Sitemap: https://proclama.vercel.app/sitemap.xml` en una línea dedicada.
4. WHEN un crawler accede a `https://proclama.vercel.app/robots.txt`, THE Robots_File SHALL retornar `User-agent: *` con `Allow: /` para permitir el rastreo completo.
5. IF se añaden nuevas rutas públicas al sitio, THEN THE Sitemap SHALL ser actualizado para incluirlas antes del siguiente despliegue.

---

### Requirement 4: Mejora del CTA principal de la Landing Page

**User Story:** Como visitante que llega a la landing page, quiero entender de inmediato que puedo usar Proclama sin necesidad de crear una cuenta, para reducir la fricción y empezar a usarlo cuanto antes.

#### Acceptance Criteria

1. THE Landing_Page SHALL mostrar el texto "Usar gratis ahora" en el botón CTA principal del hero, en lugar de "Crear cuenta gratuita".
2. THE Landing_Page SHALL mostrar el texto "Usar gratis ahora" en el botón CTA de la sección final (`cta-final`), en lugar de "Crear cuenta gratuita".
3. WHEN un usuario hace clic en cualquier botón CTA con texto "Usar gratis ahora", THE Landing_Page SHALL navegar a la vista de autenticación (`AuthView`) de la misma forma que el comportamiento anterior.
4. THE Landing_Page SHALL mantener el botón "Acceder" en la barra de navegación sin cambios.
5. THE Landing_Page SHALL mostrar el texto "Empezar ahora" en el botón secundario del hero sin cambios.

---

### Requirement 5: Keywords Long-Tail en la Landing Page

**User Story:** Como responsable de SEO, quiero que la landing page incluya frases de búsqueda específicas que usan los líderes de alabanza al buscar alternativas gratuitas a EasyWorship, para capturar tráfico orgánico cualificado.

#### Acceptance Criteria

1. THE Landing_Page SHALL incluir la frase "alternativa gratuita a EasyWorship" de forma natural en el contenido visible (no solo en metadatos).
2. THE Landing_Page SHALL incluir la frase "proyección de letras para iglesias sin instalación" de forma natural en el contenido visible.
3. THE Landing_Page SHALL incluir al menos una mención a "software de proyección para iglesias" en el cuerpo del texto.
4. WHEN un motor de búsqueda indexa la página, THE Landing_Page SHALL presentar las keywords en etiquetas semánticamente relevantes (párrafos `<p>`, encabezados `<h2>` o `<h3>`, o listas `<ul>`).
5. THE Landing_Page SHALL integrar las keywords de forma que el texto resulte natural y legible para un humano, sin keyword stuffing.

---

### Requirement 6: Mejora de contenido de la Landing Page para conversión y SEO

**User Story:** Como líder de alabanza que busca una herramienta de proyección, quiero encontrar en la landing page información clara sobre las funcionalidades clave y por qué Proclama es mejor que las alternativas de pago, para tomar una decisión informada rápidamente.

#### Acceptance Criteria

1. THE Landing_Page SHALL mostrar una sección de propuesta de valor que explique en 2-3 oraciones qué es Proclama, para quién es y qué problema resuelve.
2. THE Landing_Page SHALL incluir al menos 4 tarjetas de funcionalidades (`FeatureCard`) con descripciones que mencionen beneficios concretos y medibles (ej. "sin instalación", "gratis", "en el navegador").
3. THE Landing_Page SHALL incluir una sección o párrafo que compare implícitamente Proclama con soluciones de pago como EasyWorship, destacando que es gratuito y no requiere instalación.
4. WHEN un usuario llega a la landing page desde un motor de búsqueda, THE Landing_Page SHALL presentar el contenido principal (hero + propuesta de valor) sin necesidad de hacer scroll.
5. THE Landing_Page SHALL incluir texto alternativo (`alt`) descriptivo en todas las imágenes presentes.
6. THE Landing_Page SHALL usar etiquetas `<h1>` para el título principal del hero y `<h2>` para los títulos de sección, manteniendo una jerarquía semántica correcta.

---

### Requirement 7: Pre-rendering o SSG para indexación sin JavaScript

**User Story:** Como webmaster, quiero que Google pueda indexar el contenido de la landing page sin depender de la ejecución de JavaScript, para garantizar que el contenido aparezca correctamente en los resultados de búsqueda.

#### Acceptance Criteria

1. THE Landing_Page SHALL tener su contenido HTML principal (hero, features, CTA) disponible en el HTML inicial servido por el servidor, sin requerir ejecución de JavaScript para renderizarlo.
2. WHEN Googlebot accede a `https://proclama.vercel.app/` con JavaScript deshabilitado, THE Landing_Page SHALL mostrar el título `<h1>`, la descripción y al menos las tarjetas de funcionalidades en el HTML de respuesta.
3. THE Pre_Rendering SHALL implementarse mediante una solución compatible con el stack actual (Vite + Vercel), como `vite-plugin-ssr`, `vite-ssg` o pre-rendering estático con `vite build --ssr`.
4. IF el pre-rendering introduce un tiempo de build superior a 60 segundos en el pipeline de Vercel, THEN THE Pre_Rendering SHALL ser evaluado para optimización antes de activarse en producción.
5. THE Pre_Rendering SHALL preservar la funcionalidad completa de la SPA (hidratación React) después de que el HTML estático sea servido al navegador.
6. WHEN el HTML pre-renderizado es validado con un parser HTML5, THE Pre_Rendering SHALL producir HTML válido sin errores de estructura.
