# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primario (y único objetivo de la landing): el operador de proyección.** Voluntario de una iglesia pentecostal en Colombia, normalmente joven y sin formación técnica. El domingo está detrás de un portátil conectado a un proyector, al fondo del templo, con la luz apagada, siguiendo un servicio en vivo que no se detiene por él.

**Secundario (usa el producto, no es a quien se le vende en la landing): el pastor o líder.** No toca el software. Consume los reportes de asistencia.

## Product Purpose

Proyectar letras de canciones, pasajes bíblicos y setlists durante un servicio de iglesia, y convertir la asistencia de cada reunión en reportes exportables.

Éxito = el operador termina el servicio sin un solo momento en que la pantalla no mostró lo que tenía que mostrar.

## Positioning

Dos mecanismos que un vecino de categoría no puede copiar tal cual:

1. **Proyección a dos ventanas sobre `BroadcastChannel`** que sigue funcionando sin red una vez cargada la biblioteca. La ventana de proyección renderiza sobre un lienzo fijo escalado con `transform`, así que es inmune al tamaño de ventana y a F11.
2. **Reportes de asistencia en PDF con gráficas.** Ningún proyector gratuito de la categoría hace esta parte.

## Operating Context

- Servicio dominical en vivo. Dos pantallas: la del operador y la que ve la congregación.
- Alguien dice "vamos a Juan 3:16" en voz alta y el pasaje tiene que estar proyectado antes de que se enfríe el momento.
- El wifi del templo se cae a mitad del servicio. Es un escenario esperado, no una excepción.
- El operador trabaja a oscuras.
- 4 congregaciones IPUC (Medellín y alrededores) llegaron al producto por su cuenta, sin marketing. Ese es el canal real de distribución.

## Capabilities and Constraints

- +3.000 canciones verificadas por la comunidad. Una canción es pública solo si `is_public AND is_verified`.
- RVR1960, NVI y KJV incluidas; +1.000 versiones más importables.
- Fondos de imagen y video propios, setlists, enlaces de colaborador, asistencia.
- Sincronización en la nube hasta 2 dispositivos. Funciona offline vía IndexedDB (Dexie).
- PWA instalable.
- UI de la app en español únicamente. La landing y los precios tienen conmutador es/en.
- Freemium: Gratis / Pro. Precio fundador $99.000 COP/año, $199.000 después. Congelado de por vida mientras se renueve.
- Backend solo Supabase. Sin servidor propio.

## Brand Commitments

- **"Proclama" es lo único fijo.** El 2026-08-12 el usuario liberó explícitamente todo lo demás para rediseño: el dorado `#c9a658`, el fondo casi negro, el logo de nota musical y las tipografías actuales dejan de ser compromisos.
- Redes: `@proclamapro` en Instagram y TikTok. Contacto: `proclamapro@gmail.com`.
- Voz: español de Colombia, directa, sin jerga de software. Habla del domingo, no de "workflows".
- **Estándar de categoría, jugado derecho (2026-08-12).** Ante una dirección de mundo visual propio, el usuario tomó explícitamente la puerta de la convención. Proclama se presenta como software de producto moderno, sin ironía ni giros conceptuales. **Vara de oficio: Linear, Stripe, Vercel.** La diferenciación viene de la ejecución, no del concepto. Es un compromiso permanente, no una decisión de una sola página.

## Evidence on Hand

**Real y utilizable:**
- Capturas de la app en `/public`: `app.jpg`, `bible.jpg`, `search.jpg`, `setlist.jpg`, `backgrounds.jpg`.
- `report.jpg`: exportación real del PDF de asistencia con gráficas y cifras reales.
- 4 congregaciones IPUC como usuarios reales.

**Con salvedad:**
- El único testimonio de la landing es del propio fundador (Stiven, IPUC Granizal, Medellín). Debe marcarse como tal o reemplazarse por uno de tercero.

**No existe y no se debe inventar:**
- Fotos de servicios reales, de congregaciones o del operador trabajando.
- Testimonios de terceros, conteo de iglesias más allá de las 4, prensa, benchmarks, precios distintos a los registrados arriba.
- `projection.jpg`: la landing la referencia y no existe; cae a `app.jpg`. Las capturas actuales son del 22-jun-2026 y muestran UI ya retirada.

## Product Principles

1. **El domingo manda.** Toda decisión se juzga contra un servicio en vivo con la red caída, no contra una demo.
2. **Demostrar, no prometer.** Se enseña el producto haciendo su trabajo; las afirmaciones sin prueba sobran.
3. **El operador es voluntario, no técnico.** Nada puede exigir saber de software.
4. **El catálogo lo construye la comunidad.** El valor crece porque las iglesias aportan y corrigen letras.
5. **Español primero.** El inglés es una cortesía en la superficie comercial, no la lengua del producto.

## Accessibility & Inclusion

- El operador trabaja en un templo a oscuras: la UI de la app es oscura por necesidad operativa, no por estética.
- Base de usuarios con alfabetización técnica muy variable, en equipos modestos y conexiones inestables.
