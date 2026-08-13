# Activar el cobro

Runbook de la transición de la fase fundadores (todo premium, gratis) al modelo de
pago. Los pasos van en este orden y el orden importa: **si el deploy con
`FOUNDING_PHASE = false` llega antes que el grandfathering, todas las cuentas caen a
Gratis en el acto.**

## Decisiones ya tomadas

- **Precio por iglesia, sólo anual.** Lista COP 199.000/año, fundador COP 99.000/año
  hasta `FOUNDER_PRICE_UNTIL`, congelado mientras renueve. No hay plan mensual: el
  cobro es manual por transferencia y un mensual serían 12 cobranzas al año por
  iglesia. La entrada de bajo compromiso es el mes de prueba.
- **Gracia de 90 días** para toda cuenta existente al momento del cambio.
- **Vitalicias**: `stivendor101@gmail.com`, `stivendor14yt@gmail.com` y
  `decomgranizal@gmail.com`. La lista vive en el script.
- **Las iglesias externas entran a la gracia y se les cobra.** El precio fundador es el
  agradecimiento por haber llegado primero. Si alguna dice que no puede pagar, se le da
  `founding` a mano en ese momento: una decisión, no un default.
- **Cobro manual por WhatsApp.** Nada de checkout ni webhooks hasta que el volumen duela.

## Secuencia

1. **Probar la app entera con una cuenta free real y `FOUNDING_PHASE = false`.**
   Los gates que sólo existen en RLS no se ven mientras el flag esté arriba, porque
   todo el mundo es premium. La última vez aparecieron dos agujeros en minutos.
2. Revisar la lista de correos vitalicios del script. Y decidir sobre las cuentas en
   `paid` sin fecha, que son premium **de por vida** y el script no toca:
   ```sql
   select email from public.profiles where plan = 'paid' and premium_expires_at is null;
   ```
3. Mirar la distribución antes de tocar nada — los números cambian:
   ```sql
   select plan, count(*) from public.profiles group by plan;
   ```
4. Correr `supabase/manual/phase6_grandfather_before_paywall.sql` con service_role
   (SQL editor). **Verificar los conteos antes de hacer commit de la transacción**: las
   3 vitalicias en `founding`, el resto en `paid` venciendo en 90 días, las `trial`
   intactas.
5. Desplegar el código: aviso in-app, `FOUNDING_PHASE = false` y docs. Con el paso 4
   hecho nadie pierde nada — todos son `paid` con fecha — y el aviso les explica hasta
   cuándo.
6. **Volver a correr el script** en cuanto el deploy esté vivo. Es idempotente (sólo
   toca `free` y `founding`) y recoge a quien se haya registrado entre los pasos 4 y 5:
   el script filtra por `created_at < now()`, así que esas cuentas se quedarían en
   `free` y perderían funciones sin haber visto ningún aviso.
7. Aplicar `supabase/migrations/20260728000000_collaborators_premium_gate.sql`.
   **Nunca antes del paso 5**: con el flag arriba, un usuario `free` vería el botón de
   colaboradores habilitado y el insert le fallaría por RLS.
8. Escribir por WhatsApp a las iglesias. El modal no sustituye esto: quien no abra
   Proclama entre semana se entera el domingo.
9. Cobrar y otorgar premium desde el panel admin, con duración **12m**.

## Trampas verificadas

- **`plan='founding'` es premium gratis PARA SIEMPRE**, no una marca de cohorte. Se
  repartió a mano desde el admin durante la fase fundadores, así que el script tiene
  que incluirlo en la gracia; una versión que sólo tocara `'free'` dejaría el paywall
  sin alcanzar a nadie que importe.
- **`plan='paid'` con `premium_expires_at = null` es vitalicio** y el script no lo toca.
- **Las cuentas en `'trial'` se dejan intactas a propósito.** Su prueba ya corre con su
  propia fecha; no corresponde regalarles 90 días encima.
- **Los gates no se anuncian solos.** `PricingCards.tsx` arma la lista Pro con un array
  de claves a mano y `PricingCards.test.tsx` la vigila con regex, también a mano. Un
  gate nuevo en `usePlan()` que no toque ambos se cobra sin anunciarse. Ya pasó una vez.
- **La caducidad se ancla a medianoche de Colombia**, no a la hora de correr el script:
  si no, correrlo un domingo por la tarde apaga el Pro de todos un domingo por la tarde,
  en pleno servicio.

## Riesgos conocidos

- **Todas las cuentas vencen el mismo día.** El corte de funciones cae sobre el 100% a
  la vez.
- **Los enlaces de colaborador ya emitidos dejan de funcionar y el afectado no es tu
  usuario.** La migración hace que `_collab_auth()` mire el plan del dueño: cuando una
  iglesia cae a Gratis, el líder de alabanza que tenía el enlace se queda fuera sin
  haber visto ningún aviso, porque no tiene cuenta en la app. Decirlo en el WhatsApp.
- **El cambio de plan no llega sin recargar.** No hay realtime sobre `profiles`;
  `fetchProfile` sólo corre en `INITIAL_SESSION`/`SIGNED_IN`. Después de cobrar y subir
  la cuenta, el cliente sigue viendo el aviso hasta que recargue.
- **Un usuario Pro sin red se ve como free.** Si `fetchProfile` falla, el perfil se
  queda en `free` sin fecha y no hay reintento. Con el flag abajo esto deja de ser
  teórico.

## El aviso in-app

Dos piezas, una sola regla:

- **`GraceNoticeModal.tsx`**, montado en `App.tsx`: la explicación completa, una vez al
  entrar. Se cierra y no vuelve solo.
- **El banner del sidebar** (`Sidebar.tsx`): "Pro hasta el 11 nov · Ver planes",
  presente durante toda la gracia y sin botón de descartar. Es el único sitio desde el
  que se reabre el modal, así que quien lo cerró sin leer no se queda sin vía.

La regla de elegibilidad es `graceStatus()` en
`src/components/pricing/pricingHelpers.ts`, compartida por los dos a propósito: si
divergieran, uno anunciaría un vencimiento que el otro no reconoce. Lee la fecha del
propio perfil, no una constante global, y deja fuera a admins, vitalicios, `trial`,
`free` y a quien ya pagó el año.

Ojo con las dos fechas: `premium_expires_at` es la **medianoche en que se cae a Gratis**,
así que el último día completo con Pro es el anterior, y es ese el que se muestra.
Corriendo el script el 13-ago-2026, el aviso dice "hasta el 11 de noviembre" y la cuenta
vence el 12 a las 00:00.
