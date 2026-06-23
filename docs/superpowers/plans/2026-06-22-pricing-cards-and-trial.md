# Tarjetas de precio + Trial de 1 mes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar tarjetas Free/Premium en la landing y en Ajustes, y permitir que un usuario free active una prueba premium de 1 mes self-service (1 vez por cuenta).

**Architecture:** Un RPC `start_trial()` en Supabase (security definer + bypass del trigger de protección) activa el trial. Un componente compartido `<PricingCards>` se usa en landing (marketing) y Ajustes (app). Pagos manuales por WhatsApp; el admin activa `paid` desde el panel existente.

**Tech Stack:** React + TypeScript, Zustand, Supabase (Postgres + RLS), Vite, Vitest, i18n propio (`src/i18n`).

## Global Constraints

- Tiers válidos de `plan`: `free | trial | paid | founding` (CHECK en DB). Nunca escribir `'premium'`.
- Fuente de verdad de "es premium": `isPremiumFromProfile` (cliente) / `public.is_premium()` (DB). No duplicar el criterio.
- Precio: `$19.900 COP/mes` · `$199.000 COP/año`. Formato COP: separador de miles con punto (`es-CO`).
- WhatsApp: `573044762051`. Mensaje plantilla A (ver Task 2).
- Trial: 30 días, 1 vez por cuenta.
- Textos visibles en i18n (`es.ts` + `en.ts`). El mensaje de WhatsApp va siempre en español (lo recibe el dueño).
- Commits convencionales, terminar el cuerpo con `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Backend — columna `trial_started_at`, trigger con bypass, RPC `start_trial()`

**Files:**
- Create: `supabase/migrations/20260622000000_trial_support.sql`

**Interfaces:**
- Produces: función SQL `public.start_trial() returns timestamptz` (premium_expires_at resultante); columna `profiles.trial_started_at timestamptz`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260622000000_trial_support.sql`:

```sql
-- Trial self-service de 1 mes. El usuario sólo puede auto-cambiar su plan a
-- 'trial' (30 días, 1 vez) vía start_trial(); el resto sigue blindado.

-- 1. Columna: null = nunca usó la prueba.
alter table public.profiles
  add column if not exists trial_started_at timestamptz;

-- 2. Trigger de protección: añade bypass por GUC local y blinda trial_started_at.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.role() <> 'service_role'
     and current_setting('app.bypass_profile_guard', true) is distinct from 'on'
     and not exists (
       select 1 from public.profiles
       where id = auth.uid() and role = 'admin'
     )
  then
    new.role               := old.role;
    new.plan               := old.plan;
    new.premium_expires_at := old.premium_expires_at;
    new.trial_started_at   := old.trial_started_at;
  end if;
  return new;
end;
$function$;

-- 3. RPC: activa el trial una sola vez para el usuario autenticado.
create or replace function public.start_trial()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  v_started timestamptz;
  v_expires timestamptz;
begin
  if uid is null then
    raise exception 'No autenticado.';
  end if;

  select trial_started_at into v_started
  from public.profiles where id = uid for update;

  if v_started is not null then
    raise exception 'Ya usaste tu prueba gratuita.';
  end if;

  if public.is_premium(uid) then
    raise exception 'Ya tienes acceso premium.';
  end if;

  v_expires := now() + make_interval(days => 30);

  perform set_config('app.bypass_profile_guard', 'on', true); -- local a la transacción
  update public.profiles
     set plan = 'trial',
         premium_expires_at = v_expires,
         trial_started_at = now()
   where id = uid;

  return v_expires;
end;
$function$;

grant execute on function public.start_trial() to authenticated;
```

- [ ] **Step 2: Aplicar la migración a la base remota**

Aplicar vía MCP de Supabase (`apply_migration`, name `trial_support`) con el contenido del Step 1.

- [ ] **Step 3: Verificar estructura**

Ejecutar (MCP `execute_sql`):

```sql
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='profiles' and column_name='trial_started_at') as has_column,
  (select count(*) from pg_proc where proname='start_trial') as has_rpc,
  (select pg_get_functiondef(oid) ilike '%bypass_profile_guard%'
     from pg_proc where proname='protect_profile_fields') as trigger_has_bypass;
```

Expected: `has_column=1`, `has_rpc=1`, `trigger_has_bypass=true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260622000000_trial_support.sql
git commit -m "feat(db): trial_started_at column and start_trial RPC

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Constantes de precio + helpers puros (TDD)

**Files:**
- Modify: `src/constants/plans.ts`
- Create: `src/components/pricing/pricingHelpers.ts`
- Create: `src/test/pricing.test.ts`

**Interfaces:**
- Consumes: `PlanTier` de `@/hooks/usePlan`.
- Produces:
  - `PRICING = { monthlyCOP: number; annualCOP: number }`, `WHATSAPP_NUMBER: string`, `TRIAL_DAYS: number` (en `constants/plans.ts`).
  - `type BillingPeriod = 'monthly' | 'annual'`
  - `formatCOP(n: number): string`
  - `subscribeWhatsappUrl(period: BillingPeriod, email?: string): string`
  - `isTrialEligible(args: { isPremium: boolean; trialStartedAt: string | null }): boolean`

- [ ] **Step 1: Añadir constantes**

En `src/constants/plans.ts` (hoy sólo `MAX_DEVICES_PREMIUM = 2`), agregar:

```ts
export const PRICING = { monthlyCOP: 19900, annualCOP: 199000 } as const;
export const WHATSAPP_NUMBER = '573044762051';
export const TRIAL_DAYS = 30;
```

- [ ] **Step 2: Escribir el test que falla**

Crear `src/test/pricing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  formatCOP,
  subscribeWhatsappUrl,
  isTrialEligible,
} from '@/components/pricing/pricingHelpers'

describe('formatCOP', () => {
  it('formatea con separador de miles es-CO', () => {
    expect(formatCOP(19900)).toBe('$19.900')
    expect(formatCOP(199000)).toBe('$199.000')
  })
})

describe('subscribeWhatsappUrl', () => {
  it('incluye número, plan y correo cuando hay email', () => {
    const url = subscribeWhatsappUrl('annual', 'a@b.com')
    expect(url.startsWith('https://wa.me/573044762051?text=')).toBe(true)
    const text = decodeURIComponent(url.split('text=')[1])
    expect(text).toContain('plan Anual')
    expect(text).toContain('a@b.com')
    expect(text).toContain('¿Cómo hago el pago?')
  })

  it('omite la frase del correo cuando no hay email', () => {
    const text = decodeURIComponent(subscribeWhatsappUrl('monthly').split('text=')[1])
    expect(text).toContain('plan Mensual')
    expect(text).not.toContain('correo')
  })
})

describe('isTrialEligible', () => {
  it('elegible sólo si no es premium y nunca usó trial', () => {
    expect(isTrialEligible({ isPremium: false, trialStartedAt: null })).toBe(true)
    expect(isTrialEligible({ isPremium: true, trialStartedAt: null })).toBe(false)
    expect(isTrialEligible({ isPremium: false, trialStartedAt: '2026-01-01' })).toBe(false)
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm vitest run src/test/pricing.test.ts`
Expected: FAIL ("Cannot find module .../pricingHelpers").

- [ ] **Step 4: Implementar los helpers**

Crear `src/components/pricing/pricingHelpers.ts`:

```ts
import { WHATSAPP_NUMBER } from '@/constants/plans'

export type BillingPeriod = 'monthly' | 'annual'

export function formatCOP(n: number): string {
  return '$' + new Intl.NumberFormat('es-CO').format(n)
}

export function subscribeWhatsappUrl(period: BillingPeriod, email?: string): string {
  const planLabel = period === 'annual' ? 'Anual' : 'Mensual'
  const emailPart = email ? ` Mi correo de la cuenta es ${email}.` : ''
  const msg = `¡Hola! 👋 Quiero suscribirme a Proclama Pro — plan ${planLabel}.${emailPart} ¿Cómo hago el pago?`
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`
}

export function isTrialEligible(args: { isPremium: boolean; trialStartedAt: string | null }): boolean {
  return !args.isPremium && args.trialStartedAt == null
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm vitest run src/test/pricing.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/constants/plans.ts src/components/pricing/pricingHelpers.ts src/test/pricing.test.ts
git commit -m "feat(pricing): price constants and pure helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Claves i18n (es + en)

**Files:**
- Modify: `src/i18n/es.ts`
- Modify: `src/i18n/en.ts`

**Interfaces:**
- Produces: claves bajo `landing.pricing.*` y `settings.plan.*` accesibles vía `t(language, 'landing.pricing.title')`. Listas de features como claves numeradas `free.f1..f5` y `premium.f1..f6` (porque `t()` sólo devuelve strings).

- [ ] **Step 1: Añadir `landing.pricing` y actualizar el CTA del hero (es.ts)**

En `src/i18n/es.ts`, dentro de `landing`, añadir la clave `hero.viewPlans: 'Ver los planes'` y un bloque nuevo `pricing` hermano de `hero`/`benefits`:

```ts
    pricing: {
      title: 'Planes simples, sin sorpresas',
      monthly: 'Mensual',
      annual: 'Anual',
      annualBadge: '2 meses gratis',
      perMonth: '/mes',
      perYear: '/año',
      free: {
        name: 'Gratis',
        tagline: 'Gratis para siempre',
        price: '$0',
        f1: 'Proyección completa, sin límites',
        f2: 'Hasta 30 canciones propias',
        f3: 'Biblioteca colaborativa y búsqueda básica',
        f4: 'Hasta 5 archivos de media local',
        f5: 'Asistencia básica en la app',
        cta: 'Empezar gratis',
      },
      premium: {
        name: 'Pro',
        tagline: 'Todo lo de Free, y además:',
        trialBadge: 'Prueba 1 mes gratis',
        f1: 'Canciones ilimitadas',
        f2: 'Búsqueda online (Genius) e importar letras',
        f3: 'Sincronización en la nube y multi-dispositivo',
        f4: 'Fondos de video/imágenes y media local ilimitada',
        f5: 'Reportes PDF de asistencia con gráficas',
        f6: '+1.000 versiones de la Biblia',
        ctaTrial: 'Probar 1 mes gratis',
        ctaSubscribe: 'Suscribirme',
      },
    },
```

- [ ] **Step 2: Añadir `settings.plan` (es.ts)**

Dentro de `settings`, añadir:

```ts
    plan: {
      title: 'Plan',
      currentFree: 'Estás en el plan Gratis',
      proActive: 'Pro activo',
      trialActive: 'Prueba Pro activa',
      expiresPrefix: 'Vence el {date}',
      lifetime: 'Acceso de por vida',
      trialConfirm: '¿Activar tu prueba gratis de 1 mes con todos los beneficios Pro?',
      trialSuccess: '¡Prueba activada! Disfruta Pro por 30 días.',
      starting: 'Activando…',
    },
```

- [ ] **Step 3: Replicar en inglés (en.ts)**

En `src/i18n/en.ts`, añadir `hero.viewPlans: 'View plans'` y los bloques equivalentes:

```ts
    pricing: {
      title: 'Simple plans, no surprises',
      monthly: 'Monthly',
      annual: 'Annual',
      annualBadge: '2 months free',
      perMonth: '/mo',
      perYear: '/yr',
      free: {
        name: 'Free',
        tagline: 'Free forever',
        price: '$0',
        f1: 'Full projection, no limits',
        f2: 'Up to 30 of your own songs',
        f3: 'Collaborative library and basic search',
        f4: 'Up to 5 local media files',
        f5: 'Basic attendance in the app',
        cta: 'Get started free',
      },
      premium: {
        name: 'Pro',
        tagline: 'Everything in Free, plus:',
        trialBadge: '1-month free trial',
        f1: 'Unlimited songs',
        f2: 'Online search (Genius) and lyrics import',
        f3: 'Cloud sync and multi-device',
        f4: 'Video/image backgrounds and unlimited local media',
        f5: 'PDF attendance reports with charts',
        f6: '1,000+ Bible versions',
        ctaTrial: 'Try 1 month free',
        ctaSubscribe: 'Subscribe',
      },
    },
```

```ts
    plan: {
      title: 'Plan',
      currentFree: "You're on the Free plan",
      proActive: 'Pro active',
      trialActive: 'Pro trial active',
      expiresPrefix: 'Expires on {date}',
      lifetime: 'Lifetime access',
      trialConfirm: 'Start your free 1-month trial with all Pro benefits?',
      trialSuccess: 'Trial activated! Enjoy Pro for 30 days.',
      starting: 'Activating…',
    },
```

- [ ] **Step 4: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores (las claves nuevas no rompen tipos; los objetos de traducción son literales).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/es.ts src/i18n/en.ts
git commit -m "feat(i18n): pricing and settings plan strings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Componente `<PricingCards>`

**Files:**
- Create: `src/components/pricing/PricingCards.tsx`

**Interfaces:**
- Consumes: `PRICING` de `@/constants/plans`; `formatCOP`, `subscribeWhatsappUrl`, `BillingPeriod` de `./pricingHelpers`; `t` de `@/i18n`; store para `language`.
- Produces:
  ```ts
  interface PricingCardsProps {
    variant: 'marketing' | 'app'
    isPremium?: boolean
    trialEligible?: boolean
    onStartTrial?: () => void
    startingTrial?: boolean
    onFreeCta?: () => void        // marketing: registro
    userEmail?: string
  }
  export default function PricingCards(props: PricingCardsProps)
  ```

- [ ] **Step 1: Implementar el componente**

Crear `src/components/pricing/PricingCards.tsx`:

```tsx
import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores'
import { t } from '@/i18n'
import { PRICING } from '@/constants/plans'
import { formatCOP, subscribeWhatsappUrl, type BillingPeriod } from './pricingHelpers'

interface PricingCardsProps {
  variant: 'marketing' | 'app'
  isPremium?: boolean
  trialEligible?: boolean
  onStartTrial?: () => void
  startingTrial?: boolean
  onFreeCta?: () => void
  userEmail?: string
}

export default function PricingCards(props: PricingCardsProps) {
  const language = useAppStore((s) => s.language)
  const [period, setPeriod] = useState<BillingPeriod>('monthly')

  const freeFeatures = ['f1', 'f2', 'f3', 'f4', 'f5'].map((k) =>
    t(language, `landing.pricing.free.${k}`),
  )
  const premiumFeatures = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((k) =>
    t(language, `landing.pricing.premium.${k}`),
  )

  const price = period === 'annual' ? PRICING.annualCOP : PRICING.monthlyCOP
  const per = period === 'annual'
    ? t(language, 'landing.pricing.perYear')
    : t(language, 'landing.pricing.perMonth')

  const showTrialBtn = props.variant === 'app' && props.trialEligible
  const showSubscribe = !(props.variant === 'app' && props.isPremium)

  return (
    <div className="pricing">
      <div className="pricing-toggle" role="group" aria-label="Periodo">
        <button
          className={period === 'monthly' ? 'active' : ''}
          onClick={() => setPeriod('monthly')}
        >
          {t(language, 'landing.pricing.monthly')}
        </button>
        <button
          className={period === 'annual' ? 'active' : ''}
          onClick={() => setPeriod('annual')}
        >
          {t(language, 'landing.pricing.annual')}
          <span className="pricing-badge">{t(language, 'landing.pricing.annualBadge')}</span>
        </button>
      </div>

      <div className="plans-grid">
        {/* Free */}
        <div className="plan-card">
          <h3>{t(language, 'landing.pricing.free.name')}</h3>
          <div className="plan-price">{t(language, 'landing.pricing.free.price')}</div>
          <p className="plan-tagline">{t(language, 'landing.pricing.free.tagline')}</p>
          <ul>
            {freeFeatures.map((f, i) => (
              <li key={i}><Check size={16} /> {f}</li>
            ))}
          </ul>
          {props.variant === 'marketing' ? (
            <button className="plan-btn-outline" onClick={props.onFreeCta}>
              {t(language, 'landing.pricing.free.cta')}
            </button>
          ) : (
            !props.isPremium && <div className="plan-current">{t(language, 'settings.plan.currentFree')}</div>
          )}
        </div>

        {/* Premium */}
        <div className="plan-card plan-pro">
          <span className="plan-badge plan-badge-pro">
            <Sparkles size={13} /> {t(language, 'landing.pricing.premium.trialBadge')}
          </span>
          <h3>{t(language, 'landing.pricing.premium.name')}</h3>
          <div className="plan-price">{formatCOP(price)}<span> {per}</span></div>
          <p className="plan-tagline">{t(language, 'landing.pricing.premium.tagline')}</p>
          <ul>
            {premiumFeatures.map((f, i) => (
              <li key={i}><Check size={16} /> {f}</li>
            ))}
          </ul>
          <div className="plan-actions">
            {showTrialBtn && (
              <button className="plan-btn-primary" onClick={props.onStartTrial} disabled={props.startingTrial}>
                {props.startingTrial
                  ? t(language, 'settings.plan.starting')
                  : t(language, 'landing.pricing.premium.ctaTrial')}
              </button>
            )}
            {showSubscribe && (
              <a
                className="plan-btn-outline"
                href={subscribeWhatsappUrl(period, props.userEmail)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t(language, 'landing.pricing.premium.ctaSubscribe')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

Nota: las clases `plans-grid`, `plan-card`, `plan-pro`, `plan-price`, `plan-badge`, `plan-badge-pro`, `plan-btn-outline` ya existen en el `<style>` de `LandingView.tsx`. `pricing-toggle`, `pricing-badge`, `plan-tagline`, `plan-actions`, `plan-btn-primary`, `plan-current` se añaden en Task 6 (landing) y Task 7 (settings ya tiene estilos de sección).

- [ ] **Step 2: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/pricing/PricingCards.tsx
git commit -m "feat(pricing): shared PricingCards component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Plumbing del perfil — `trialStartedAt` + servicio `startTrial`

**Files:**
- Modify: `src/services/supabase.ts` (`fetchProfile` ~líneas 293-318; añadir `startTrial` al final del bloque de Settings)
- Modify: `src/stores/index.ts` (~líneas 275-278, 402-405, 494-495)
- Modify: `src/hooks/useAuth.ts` (~líneas 13-24, 73-89, 156-164)

**Interfaces:**
- Consumes: `fetchProfile` devuelve ahora `{ role, plan, premiumExpiresAt, trialStartedAt }`.
- Produces:
  - store: `trialStartedAt: string | null`, `setTrialStartedAt: (v: string | null) => void`.
  - `export async function startTrial(): Promise<{ ok: true; expiresAt: string } | { ok: false; error: string }>`.

- [ ] **Step 1: `fetchProfile` devuelve `trialStartedAt`**

En `src/services/supabase.ts`, en `fetchProfile`, ampliar el `select` y el objeto devuelto:

```ts
    .select('role, terms_version, terms_accepted_at, full_name, plan, premium_expires_at, trial_started_at')
```

y antes del `return`:

```ts
  const trialStartedAt: string | null = data.trial_started_at ?? null
```

```ts
  return {
    role: mappedRole as 'admin' | 'user',
    plan: rawPlan,
    premiumExpiresAt,
    trialStartedAt,
  }
```

- [ ] **Step 2: Añadir `startTrial` al servicio**

Al final del bloque "Funciones para Settings" en `src/services/supabase.ts`:

```ts
export async function startTrial(): Promise<{ ok: true; expiresAt: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('start_trial')
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true, expiresAt: data as string }
}
```

- [ ] **Step 3: Store — campo y setter**

En `src/stores/index.ts`, junto a `premiumExpiresAt` (interfaz ~277):

```ts
  trialStartedAt: string | null
  setTrialStartedAt: (v: string | null) => void
```

en el estado inicial (~404):

```ts
      trialStartedAt: null,
      setTrialStartedAt: (v) => set({ trialStartedAt: v }),
```

y en el reset de logout (~494, junto a `premiumExpiresAt: null`):

```ts
        trialStartedAt: null,
```

- [ ] **Step 4: `useAuth` setea `trialStartedAt`**

En `src/hooks/useAuth.ts`:

En el `useShallow` (~13-24) añadir `setTrialStartedAt: s.setTrialStartedAt,` y desestructurarlo.

Tras `setPremiumExpiresAt(profile.premiumExpiresAt)` (~76):

```ts
                setTrialStartedAt(profile.trialStartedAt)
```

En la rama sin usuario (~157-158), tras `setUserPlan('free')`:

```ts
          useAppStore.getState().setTrialStartedAt(null)
```

- [ ] **Step 5: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/services/supabase.ts src/stores/index.ts src/hooks/useAuth.ts
git commit -m "feat(plan): expose trialStartedAt and startTrial to the client

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Integración en la landing (hero CTA + sección de precios)

**Files:**
- Modify: `src/pages/LandingView.tsx` (hero ~196-208; insertar sección antes de `</main>` ~351; estilos en el `<style>`)

**Interfaces:**
- Consumes: `PricingCards` (marketing), `setLandingShowAuth`/registro existente.

- [ ] **Step 1: Importar y cambiar el CTA del hero**

En `src/pages/LandingView.tsx`, importar el componente:

```tsx
import PricingCards from '@/components/pricing/PricingCards'
```

Reemplazar el botón primario del hero (líneas ~197-205) por un CTA que hace scroll a `#precios`:

```tsx
              <button
                className="landing-btn-primary"
                onClick={() => document.getElementById('precios')?.scrollIntoView({ behavior: 'smooth' })}
              >
                {t(language, 'landing.hero.viewPlans')} <ChevronRight size={18} />
              </button>
```

(La entrada a la app permanece en el nav `nav.goToApp`, sin cambios.)

- [ ] **Step 2: Insertar la sección de precios**

Antes de `</main>` (~línea 351), tras la sección de testimonio:

```tsx
        <section id="precios" className="section pricing-section">
          <div className="section-head animate-on-scroll">
            <h2>{t(language, 'landing.pricing.title')}</h2>
          </div>
          <PricingCards
            variant="marketing"
            onFreeCta={() => setLandingShowAuth(true)}
          />
        </section>
```

- [ ] **Step 3: Añadir estilos faltantes**

Dentro del `<style>` de la landing, añadir las clases que el componente usa y que no existían:

```css
        .pricing-section { padding-top: 20px; }
        .pricing-toggle { display: flex; justify-content: center; gap: 6px; margin: 0 auto 28px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 4px; width: fit-content; }
        .pricing-toggle button { display: flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 999px; color: #9aa6bb; font-weight: 600; font-size: 14px; }
        .pricing-toggle button.active { background: #c9a658; color: #1a1206; }
        .pricing-badge { font-size: 11px; background: rgba(201,166,88,0.18); color: #c9a658; padding: 2px 8px; border-radius: 999px; }
        .pricing-toggle button.active .pricing-badge { background: rgba(0,0,0,0.15); color: #1a1206; }
        .plan-tagline { color: #9aa6bb; font-size: 14px; margin: 4px 0 16px; }
        .plan-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
        .plan-btn-primary { background: #c9a658; color: #1a1206; font-weight: 700; padding: 12px; border-radius: 12px; text-align: center; }
        .plan-btn-primary:disabled { opacity: 0.6; }
```

- [ ] **Step 4: Verificar build**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificación manual**

Run: `pnpm dev` (si no corre ya). En la landing: el botón del hero dice "Ver los planes" y hace scroll suave a las tarjetas; el toggle Mensual/Anual cambia el precio (`$19.900 /mes` ↔ `$199.000 /año`); "Suscribirme" abre WhatsApp con el mensaje en español sin correo.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LandingView.tsx
git commit -m "feat(landing): pricing section and hero CTA to plans

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Integración en Ajustes (sección Plan + activación de trial)

**Files:**
- Modify: `src/pages/SettingsView.tsx` (insertar sección tras `account` ~274; estilos en el `<style>`)

**Interfaces:**
- Consumes: `PricingCards` (app), `usePlan`, store (`userPlan`, `premiumExpiresAt`, `trialStartedAt`, `language`, `user`), `startTrial` de `@/services/supabase`, `isTrialEligible` de `pricingHelpers`.

- [ ] **Step 1: Imports y estado local**

En `src/pages/SettingsView.tsx` añadir imports:

```tsx
import PricingCards from '@/components/pricing/PricingCards'
import { isTrialEligible } from '@/components/pricing/pricingHelpers'
import { startTrial } from '@/services/supabase'
```

Dentro del componente, leer del store lo necesario (junto a donde ya se usa `usePlan`/store) y un estado local:

```tsx
  const { userPlan, premiumExpiresAt, trialStartedAt, language, user } = useAppStore(
    useShallow((s) => ({
      userPlan: s.userPlan,
      premiumExpiresAt: s.premiumExpiresAt,
      trialStartedAt: s.trialStartedAt,
      language: s.language,
      user: s.user,
    })),
  )
  const [startingTrial, setStartingTrial] = useState(false)
  const [planMsg, setPlanMsg] = useState<string | null>(null)
```

(Si `user`/`language` ya se leen arriba, no dupliques: añade sólo `premiumExpiresAt`, `trialStartedAt`, `userPlan` al `useShallow` existente.)

- [ ] **Step 2: Handler de activación**

```tsx
  const handleStartTrial = async () => {
    if (!window.confirm(t(language, 'settings.plan.trialConfirm'))) return
    setStartingTrial(true)
    setPlanMsg(null)
    const res = await startTrial()
    if (res.ok) {
      useAppStore.getState().setUserPlan('trial')
      useAppStore.getState().setPremiumExpiresAt(res.expiresAt)
      useAppStore.getState().setTrialStartedAt(new Date().toISOString())
      setPlanMsg(t(language, 'settings.plan.trialSuccess'))
    } else {
      setPlanMsg(res.error)
    }
    setStartingTrial(false)
  }
```

- [ ] **Step 3: Render de la sección Plan**

Insertar tras el cierre de la sección de cuenta (~línea 274, antes del bloque `user && isPremium`):

```tsx
          {user && (
            <section className="settings-section">
              <h2>{t(language, 'settings.plan.title')}</h2>
              {isPremium && (
                <p className="settings-plan-status">
                  {userPlan === 'trial'
                    ? t(language, 'settings.plan.trialActive')
                    : t(language, 'settings.plan.proActive')}
                  {' · '}
                  {premiumExpiresAt
                    ? t(language, 'settings.plan.expiresPrefix', {
                        date: new Date(premiumExpiresAt).toLocaleDateString(language === 'en' ? 'en-US' : 'es-CO'),
                      })
                    : t(language, 'settings.plan.lifetime')}
                </p>
              )}
              <PricingCards
                variant="app"
                isPremium={isPremium}
                trialEligible={isTrialEligible({ isPremium, trialStartedAt })}
                onStartTrial={handleStartTrial}
                startingTrial={startingTrial}
                userEmail={user.email ?? undefined}
              />
              {planMsg && <p className="settings-plan-msg">{planMsg}</p>}
            </section>
          )}
```

- [ ] **Step 4: Estilos de la sección**

En el `<style>` de `SettingsView.tsx` añadir:

```css
        .settings-plan-status { color: var(--gold, #c9a658); font-weight: 600; margin: 0 0 16px; }
        .settings-plan-msg { margin-top: 12px; color: var(--green, #34d399); font-size: 14px; }
        .settings-section .pricing-toggle { background: var(--bg-surface); border: 1px solid var(--border); }
        .settings-section .plan-card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
        .settings-section .plan-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
        .settings-section .plan-btn-primary { background: var(--gold, #c9a658); color: #1a1206; font-weight: 700; padding: 11px; border-radius: 10px; text-align: center; }
        .settings-section .plan-btn-outline { border: 1px solid var(--border); padding: 11px; border-radius: 10px; text-align: center; color: var(--text-primary); }
        .settings-section .plan-current { color: var(--text-secondary); font-size: 13px; margin-top: 14px; }
```

- [ ] **Step 5: Verificar tipos**

Run: `pnpm tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Verificación manual (flujo trial)**

Con una cuenta free que nunca usó trial: en Ajustes aparece "Probar 1 mes gratis"; al activarlo → confirm → mensaje de éxito → la UI desbloquea premium y el banner muestra "Prueba Pro activa · Vence el {fecha}". Recargar y confirmar persistencia. Volver a intentar el RPC (vía consola) debe devolver "Ya usaste tu prueba gratuita.".

- [ ] **Step 7: Commit**

```bash
git add src/pages/SettingsView.tsx
git commit -m "feat(settings): plan section with self-service trial

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notas de verificación cruzada (spec → plan)

- Backend (col + RPC + trigger bypass + blindaje `trial_started_at`): Task 1. ✓
- Config compartida (PRICING, WHATSAPP, TRIAL_DAYS): Task 2. ✓
- Componente `PricingCards` (toggle, listas, CTAs): Task 4. ✓
- WhatsApp mensaje A con/sin correo: Task 2 (helper) + tests. ✓
- Landing: sección `#precios` + hero "Ver los planes": Task 6. ✓
- Ajustes: sección Plan, estados (free/trial/premium), activación trial: Task 7. ✓
- `trialStartedAt` en `useAuth`/store/`fetchProfile`: Task 5. ✓
- i18n es/en: Task 3. ✓
- Fuera de alcance (pasarela, cron de downgrade, recordatorios): no hay tareas, correcto. ✓
```
