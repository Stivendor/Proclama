# Auditoria de seguridad - Proclama

Fecha: 2026-05-02  
Rama auditada: `develop`  
Base de comparacion: `main..develop`  
Alcance: cambios de frontend React/Vite, Supabase, Edge Functions, MercadoPago, asistencia, setlists, medios locales, PWA y documentacion.

## Resumen ejecutivo

La base actual no muestra vulnerabilidades conocidas en dependencias de produccion con `npm audit --omit=dev`. Los controles mas fuertes encontrados son: autenticacion Supabase para checkout, webhook de MercadoPago con firma, uso de Service Role solo en Edge Functions, RLS documentado para `church_notes`, datos locales en IndexedDB para modo offline y ausencia de `dangerouslySetInnerHTML`/`eval`.

Los riesgos principales estan en secretos/configuracion versionada, endurecimiento de Edge Functions, confianza en flags de premium del cliente y falta de una fuente versionada unica de politicas RLS para todas las tablas nuevas.

## Remediacion aplicada en el repo

- `api-bible-proxy` importa `createClient` explicitamente.
- Los scripts de limpieza de letras ahora leen Supabase desde entorno o `.env.local` mediante `scripts/supabaseEnv.js`; se removieron URL y anon key literales.
- `supabase/.temp/*` y salidas operativas se agregaron a `.gitignore` y se quitaron del indice de Git.
- `.env.local` local fue ajustado para que el access token de MercadoPago no use prefijo `VITE_`.
- El checkout de MercadoPago restringe CORS mediante `ALLOWED_CORS_ORIGINS`; el webhook ya no usa `Access-Control-Allow-Origin: *`.
- El fallback de busqueda en Supabase limita longitud y elimina caracteres especiales antes de construir el filtro PostgREST.

## Hallazgos prioritarios

### Critico - Token privado de MercadoPago en entorno Vite local

Evidencia original: `.env.local` contenia `VITE_MERCADOPAGO_ACCESS_TOKEN`. Aunque `.env.local` no esta versionado, el prefijo `VITE_` expone la variable al bundle si el codigo la importa.

Estado: corregido localmente renombrando la variable a `MERCADOPAGO_ACCESS_TOKEN`. Si el token se uso solo en local y no se publico un build con esa variable expuesta, no se considera incidente publico; rotarlo sigue siendo recomendable si hubo cualquier duda de exposicion.

Impacto: si se usa en frontend, el access token permitiria llamadas directas a MercadoPago desde el navegador.

Accion requerida:

- Rotar el token si alguna vez fue usado en un build publico.
- Mantener el secreto solo como `MERCADOPAGO_ACCESS_TOKEN` en Supabase Edge Function secrets.
- No declarar secretos de servidor con prefijo `VITE_`.

### Alto - Metadatos locales de Supabase versionados

Evidencia: `git ls-files` reporta `supabase/.temp/linked-project.json`, `supabase/.temp/project-ref` y `supabase/.temp/pooler-url`.

Estado: corregido en el indice actual con `git rm --cached` y regla `supabase/.temp/` en `.gitignore`.

Impacto: estos archivos no son credenciales completas, pero filtran identificadores de proyecto y detalles de conexion que facilitan reconocimiento del entorno.

Accion requerida:

- Removerlos del indice con `git rm --cached supabase/.temp/*`.
- Agregar `supabase/.temp/` a `.gitignore`.
- Revisar historial si el repositorio fue publico.

### Alto - Scripts con URL y anon key embebidos

Evidencia: `scripts/bulk_lyrics_cleanup.js`, `scripts/dry_run_lyrics_cleanup.test.ts` y `scripts/sample_clean.js` contienen URL de Supabase y anon key literales.

Estado: corregido con `scripts/supabaseEnv.js`.

Impacto: la anon key no es secreta por diseno, pero versionarla junto al proyecto y scripts operativos aumenta el abuso automatizado si las politicas RLS no son estrictas.

Accion requerida:

- Leer `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` desde `.env.local` como ya hace `scripts/import-songs.cjs`.
- Verificar RLS antes de ejecutar scripts masivos.
- Eliminar logs generados que puedan contener datos de canciones o resultados operativos si no son necesarios.

### Alto - `api-bible-proxy` no importa `createClient`

Evidencia: `supabase/functions/api-bible-proxy/index.ts` usa `createClient` en la linea 22, pero no lo importa.

Estado: corregido.

Impacto: la funcion puede fallar en runtime o despliegue; eso rompe el control de autenticacion esperado para proteger `API_BIBLE_KEY`.

Accion requerida:

- Importar `createClient` desde `https://esm.sh/@supabase/supabase-js@2`.
- Agregar prueba o smoke test de la Edge Function.

### Alto - Politicas RLS no estan versionadas para todas las tablas usadas

Evidencia: el repo incluye SQL RLS solo para `church_notes`, pero el codigo usa `songs`, `setlists`, `profiles`, `backgrounds`, `feedback`, `premium_interest`, `user_devices`, `song_reports`, `attendance_records`, `payments`, `payment_errors` y `payment_notifications`.

Impacto: la seguridad real depende de configuracion remota no reproducible desde el repo. Un cambio manual en Supabase podria exponer datos entre usuarios.

Accion requerida:

- Versionar migraciones Supabase con `ENABLE ROW LEVEL SECURITY` y policies por tabla.
- Validar que las tablas de pagos solo sean accesibles via Edge Functions con Service Role.
- Incluir pruebas SQL o checklist de deployment para RLS.

### Medio - CORS amplio en funciones de pago

Evidencia: `create-mercadopago-preference` usa `Access-Control-Allow-Origin: *`; `mercadopago-webhook` tambien responde con CORS amplio.

Estado: corregido. Checkout usa allowlist configurable y webhook usa origen fijo.

Impacto: la autenticacion reduce el riesgo en checkout y la firma reduce el riesgo en webhook, pero CORS abierto amplia superficie desde cualquier origen.

Accion recomendada:

- Restringir checkout a `https://proclama.lat` y dominios de preview necesarios.
- En webhook, responder CORS minimo o sin CORS para llamadas servidor a servidor.

### Medio - Fallback de busqueda compone filtros con input de usuario

Evidencia: `src/services/supabase.ts` arma `.or(\`title.ilike.%${query}%,artist.ilike.%${query}%,lyrics.fts.${query}\`)`.

Estado: mitigado con sanitizacion y limite de longitud antes del fallback.

Impacto: caracteres especiales de PostgREST pueden romper la consulta o alterar el filtro. No es SQL directo, pero es una superficie de inyeccion de filtro.

Accion recomendada:

- Preferir siempre la RPC `search_songs_community`.
- Sanitizar o escapar caracteres reservados antes del fallback.
- Limitar longitud de busqueda.

### Medio - Premium depende de un flag de cliente

Evidencia: `src/hooks/usePlan.ts` define `PREMIUM_FOR_EVERYONE = true`; `src/stores/index.ts` define otro flag `PREMIUM_FOR_EVERYONE = false`.

Impacto: los limites premium del frontend son bypassables por diseno. Si una funcion premium toca recursos remotos o pagos, debe validarse en servidor/RLS.

Accion recomendada:

- Unificar el flag y tratarlo como configuracion temporal.
- Enforzar permisos premium en Edge Functions/RLS para operaciones remotas.
- Documentar claramente que el cliente solo controla UX, no autorizacion.

### Medio - Device control no impone limite real

Evidencia: `checkDeviceLimit` registra el dispositivo y siempre desbloquea acceso.

Impacto: el panel puede dar la impresion de control de dispositivos, pero no protege licencias ni sesiones.

Accion recomendada:

- Implementar limite server-side o renombrar la funcionalidad como registro informativo.
- Evitar tomar decisiones de licencia solo con `localStorage`/UUID local.

## Controles revisados

- Autenticacion: Supabase Auth se usa antes de checkout y sincronizacion remota.
- MFA: existe flujo TOTP; el secreto se muestra solo durante enrolamiento.
- Pagos: webhook verifica `x-signature` y `x-request-id`, consulta MercadoPago server-side y valida monto/moneda antes de activar premium.
- Persistencia local: IndexedDB guarda canciones, setlists, asistencia y medios locales; debe tratarse como datos del dispositivo, no como almacenamiento cifrado.
- Comunicacion entre ventanas: `BroadcastChannel` se usa para proyeccion en el mismo origen; no se detecto uso de `postMessage` abierto.
- XSS: no se detecto `dangerouslySetInnerHTML`, `eval` ni `new Function`.
- Dependencias: `npm audit --omit=dev` reporto `found 0 vulnerabilities`.

## Checklist de remediacion

1. Rotar cualquier token privado que haya estado con prefijo `VITE_`.
2. Remover del repo `supabase/.temp/*` y mantenerlos ignorados.
3. Refactorizar scripts para leer credenciales desde entorno.
4. Corregir import faltante en `api-bible-proxy`.
5. Versionar migraciones RLS para todas las tablas.
6. Restringir CORS en Edge Functions.
7. Sanitizar fallback de busqueda.
8. Enforzar premium y limites de dispositivos en servidor/RLS.
9. Revisar si `dist/` y archivos de salida deben seguir versionados.

## Evidencia de verificacion

- `git status --short`: arbol limpio antes de actualizar documentacion.
- `git diff --stat main..develop`: 219 archivos cambiados, incluyendo Supabase, pagos, asistencia, setlists, PWA y docs.
- `npm audit --omit=dev`: `found 0 vulnerabilities`.
