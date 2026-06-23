# Tarjetas de precio + Trial de 1 mes — Diseño

**Fecha:** 2026-06-22
**Estado:** Aprobado para implementación

## Objetivo

Mostrar tarjetas de precio (Free vs Premium) en dos lugares —la landing y la vista de Ajustes dentro de la app— y permitir que cualquier usuario free active **una** prueba gratis de 1 mes con beneficios premium, de forma self-service.

Los pagos se gestionan **manualmente por WhatsApp** al inicio (sin pasarela). El admin activa el plan pagado desde el panel existente (`PlansPage`). Lo único automatizado es el trial.

## Contexto y decisiones

- **Sin pasarela de pago** (MercadoPago se removió). YAGNI: integrar Stripe/MP no se justifica con el volumen inicial. Se migrará a un Stripe Payment Link sólo cuando activar/renovar a mano consuma tiempo real (>5-10 activaciones/semana).
- **Modelo de planes** ya definido en `src/hooks/usePlan.ts` (`isPremiumFromProfile`, tiers `free|trial|paid|founding`). El trial encaja en el tier `trial`, que `is_premium()` ya reconoce mientras `premium_expires_at > now()`.
- **Precio:** `$19.900 COP/mes` · `$199.000 COP/año` (el anual ≈ 2 meses gratis).
- **WhatsApp:** `+57 304 476 2051` (`573044762051`).

## 1. Backend (Supabase)

### 1.1 Columna nueva
```sql
alter table public.profiles
  add column if not exists trial_started_at timestamptz; -- null = nunca usó la prueba
```

### 1.2 RPC `start_trial()`
Función `security definer` que el usuario autenticado dispara desde Ajustes.

Reglas:
- Sólo el dueño (`auth.uid()`), sobre su propio perfil.
- Falla si `trial_started_at IS NOT NULL` → error `'Ya usaste tu prueba gratuita.'`
- Falla si el perfil ya es premium (`is_premium(auth.uid())` true) → error `'Ya tienes acceso premium.'`
- En éxito: `plan='trial'`, `premium_expires_at = now() + interval '30 days'`, `trial_started_at = now()`.
- Devuelve `premium_expires_at` (timestamptz) para que el cliente muestre la fecha.

Duración del trial: **30 días** (constante `TRIAL_DAYS`).

### 1.3 Interacción con `protect_profile_fields`
El trigger `enforce_profile_field_protection` revierte cambios a `role/plan/premium_expires_at` salvo `service_role` o admin (ver `20260620000000_freemium_plan_constraint_and_harden.sql`). Por eso un usuario no puede auto-darse el trial con un UPDATE directo.

Cambios al trigger:
1. Añadir un bypass por GUC local: si `current_setting('app.bypass_profile_guard', true) = 'on'`, no revertir. `start_trial()` hace `set local app.bypass_profile_guard = 'on'` antes del UPDATE (sólo afecta su transacción).
2. **Blindar también `trial_started_at`**: agregarlo a la lista de campos que se revierten cuando el cambio no viene de un admin/service_role/bypass. Sin esto, el cliente podría poner `trial_started_at = null` por su cuenta y repetir la prueba.

Resultado: el trial es la **única** vía por la que un usuario modifica su propio plan, siempre acotado a 30 días y 1 sola vez. No puede auto-asignarse `paid` ni `founding`.

### 1.4 Migración
Un archivo nuevo en `supabase/migrations/` (timestamp posterior a `20260620000004`) con: la columna, el `create or replace` del trigger con el bypass + `trial_started_at` protegido, y la función `start_trial()`. Se aplica también vía MCP a la base remota.

## 2. Config compartida (cliente)

`src/constants/plans.ts` (ya existe, hoy sólo `MAX_DEVICES_PREMIUM`):
```ts
export const PRICING = { monthlyCOP: 19900, annualCOP: 199000 } as const;
export const WHATSAPP_NUMBER = '573044762051';
export const TRIAL_DAYS = 30;
```
Las listas de beneficios y todos los textos visibles van en i18n (`src/i18n/es.ts` y `en.ts`), no hardcodeados en el componente.

## 3. Componente `<PricingCards>`

Un único componente reutilizado en landing y ajustes. Ubicación: `src/components/pricing/PricingCards.tsx`.

**Props:**
- `variant: 'marketing' | 'app'`
- (modo `app`) `isPremium: boolean`, `plan: PlanTier`, `premiumExpiresAt: string | null`, `trialEligible: boolean`, `onStartTrial: () => void`, `startingTrial: boolean`
- `userEmail?: string` (para el mensaje de WhatsApp; sólo presente logueado)

**Estructura:**
- Toggle Mensual/Anual (el anual muestra etiqueta "2 meses gratis").
- Tarjeta Free: lista de beneficios + CTA según variante.
- Tarjeta Premium: precio según toggle + lista de beneficios + insignia "Prueba 1 mes gratis" + CTAs.

**Contenido de las tarjetas (copy en i18n):**

Free — "Gratis para siempre":
- Proyección completa (el núcleo nunca se bloquea)
- Hasta 30 canciones propias
- Biblioteca colaborativa + búsqueda básica
- Hasta 5 archivos de media local
- Asistencia básica en la app

Premium — "$19.900/mes · $199.000/año", "Todo lo de Free, y además:":
- Canciones ilimitadas
- Búsqueda online (Genius) e importar letras
- Sincronización en la nube / multi-dispositivo
- Fondos de video/imágenes + media local ilimitada
- Reportes PDF de asistencia con gráficas
- +1.000 versiones de la Biblia (catálogo HelloAO)

## 4. Botón "Suscribirme" (WhatsApp)

Link: `https://wa.me/573044762051?text=<mensaje url-encoded>`.

Mensaje (plantilla A):
> `¡Hola! 👋 Quiero suscribirme a Proclama Pro — plan {Mensual|Anual}. Mi correo de la cuenta es {correo}. ¿Cómo hago el pago?`

- `{Mensual|Anual}` = toggle activo.
- `{correo}` = `userEmail` cuando existe; en landing (sin login) se omite la frase del correo: `…plan {Mensual|Anual}. ¿Cómo hago el pago?`.

## 5. Integración por vista

### 5.1 Landing (`src/pages/LandingView.tsx`, `variant='marketing'`)
- Nueva sección de precios. Reutiliza el CSS ya presente pero muerto (`.plans-grid`, `.plan-card`, `.plan-price`, `.plan-badge`, etc.).
- CTAs:
  - Free → "Empezar gratis" → registro.
  - Premium → "Probar 1 mes gratis" → registro (el trial real se activa luego en Ajustes) + "Suscribirme" → WhatsApp (sin correo).

### 5.2 Ajustes (`src/pages/SettingsView.tsx`, `variant='app'`)
Nueva sección "Plan". Estado según el perfil real:
- **Free + trial sin usar** (`trialEligible`): tarjetas + botón "Probar 1 mes gratis" (llama `onStartTrial`) + "Suscribirme".
- **En trial o premium** (`isPremium`): banner "Pro activo · vence el {fecha}" (o "de por vida" si `premium_expires_at` null). Sin botón de trial.
- **Trial ya usado, de vuelta en free**: sin botón de trial; sólo "Suscribirme".

`trialEligible = !isPremium && plan !== 'trial' && trial_started_at == null`. Para conocer `trial_started_at` en el cliente, `useAuth` debe incluirlo al cargar el perfil (ver 6).

### 5.3 Activación del trial (flujo)
1. Click en "Probar 1 mes gratis" → `window.confirm` de confirmación.
2. Llamada al RPC `start_trial()` vía `supabase.rpc('start_trial')`.
3. Éxito → toast/mensaje de éxito + `useAuth` re-lee el perfil para refrescar `plan`/`premiumExpiresAt` → la UI desbloquea premium al instante.
4. Error (ya usado / ya premium) → mensaje del error devuelto por el RPC.

## 6. Cambios de soporte

- `useAuth` / store: incluir `trial_started_at` (camelCase `trialStartedAt`) al cargar el perfil, y exponerlo donde se consuma (`usePlan` o directo en SettingsView). Hoy `useAuth` ya carga `plan`, `role`, `premiumExpiresAt`; se suma este campo.
- i18n: nuevas claves en `es.ts` y `en.ts` para títulos de sección, nombres de plan, listas de beneficios, etiquetas de botones, toggle, banner de estado y mensajes de éxito/error del trial.

## Alcance / fuera de alcance

**Incluye:** columna + RPC + trigger, componente `PricingCards`, integración en landing y ajustes, botón WhatsApp, activación de trial self-service, i18n es/en.

**No incluye (YAGNI, futuro):**
- Pasarela de pago / checkout automático.
- Cron de auto-downgrade de `trial`/`paid` vencidos (hoy `is_premium()` ya los trata como no-premium; el dato queda "sucio" pero inofensivo). Se añade cuando el volumen lo justifique.
- Recordatorios automáticos de vencimiento.

## Riesgos

- **Bypass del trigger:** el GUC `app.bypass_profile_guard` debe ser `set local` (no `set`) para no filtrarse a otras operaciones de la misma sesión/conexión (pooling). `start_trial()` lo activa justo antes de su único UPDATE.
- **Trial repetible:** mitigado blindando `trial_started_at` en el trigger (sólo el RPC lo escribe).
