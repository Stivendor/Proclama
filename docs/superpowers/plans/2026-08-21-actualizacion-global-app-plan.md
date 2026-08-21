# Actualizacion global de Proclama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detectar y bloquear de forma controlada las versiones antiguas de Proclama, manteniendo el boton de actualizacion normal, el modo offline y la ventana de proyeccion.

**Architecture:** La version local vivira en `src/constants/appVersion.ts` y se comparara con una funcion pura de semver simple. Un servicio de Supabase consultara una fila publica de `app_update_config`; un hook cargara esa configuracion al iniciar y al volver a primer plano. `App.tsx` mostrara una pantalla bloqueante solo en la ventana principal cuando `force_update` este activo y la version local sea menor que `min_supported_version`. El service worker conservara el flujo prompt y procesara `SKIP_WAITING` con recarga controlada.

**Tech Stack:** React 18, TypeScript, Zustand existente, Supabase JS, Dexie offline, Vitest, Supabase SQL migrations, vite-plugin-pwa.

---

### Task 1: Definir version local y comparador puro

**Files:**
- Create: `src/constants/appVersion.ts`
- Test: `src/test/appVersion.test.ts`

- [ ] **Step 1: Escribir pruebas que fallen**

Crear pruebas para `compareVersions` y `isVersionSupported`:

```ts
import { describe, expect, it } from 'vitest'
import { compareVersions, isVersionSupported } from '@/constants/appVersion'

describe('app version comparison', () => {
  it('orders valid semantic versions', () => {
    expect(compareVersions('1.2.0', '1.3.0')).toBe(-1)
    expect(compareVersions('1.3.0', '1.3.0')).toBe(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
  })

  it('rejects malformed versions without blocking the app', () => {
    expect(compareVersions('1.2', '1.3.0')).toBeNull()
    expect(isVersionSupported('1.2.0', 'bad')).toBe(true)
    expect(isVersionSupported('bad', '2.0.0')).toBe(true)
  })

  it('reports whether the local version meets the minimum', () => {
    expect(isVersionSupported('1.4.0', '1.3.0')).toBe(true)
    expect(isVersionSupported('1.2.9', '1.3.0')).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar la prueba y confirmar el fallo**

Ejecutar `pnpm vitest --run src/test/appVersion.test.ts`. Debe fallar porque el módulo todavía no existe.

- [ ] **Step 3: Implementar el comparador mínimo**

Exportar `APP_VERSION` desde `src/constants/appVersion.ts`, inicialmente tomando `import.meta.env.VITE_APP_VERSION ?? '1.0.0'`. Validar exactamente tres componentes numéricos no negativos y devolver `null` para entradas inválidas. `isVersionSupported` devolverá `true` ante valores inválidos para mantener compatibilidad offline y evitar bloqueos falsos.

- [ ] **Step 4: Ejecutar la prueba focalizada**

Ejecutar `pnpm vitest --run src/test/appVersion.test.ts`. Resultado esperado: todas las pruebas pasan.

### Task 2: Añadir configuración remota segura

**Files:**
- Create: `supabase/migrations/20260821000000_app_update_config.sql`
- Modify: `src/services/supabase.ts`
- Test: `src/test/appUpdateConfig.test.ts`

- [ ] **Step 1: Crear migración SQL**

Crear `public.app_update_config` con una única fila estable (`id = 1`), columnas `min_supported_version`, `latest_version`, `force_update`, `updated_at`, RLS habilitado, `SELECT` anónimo/autenticado y escritura solo para `service_role`. Insertar una fila inicial con versiones `1.0.0` y `force_update = false`.

- [ ] **Step 2: Escribir prueba del servicio remoto**

Mockear el cliente Supabase existente y verificar que `getAppUpdateConfig()` transforma snake_case a camelCase, devuelve `null` ante error y no lanza excepciones al cliente.

- [ ] **Step 3: Implementar `getAppUpdateConfig`**

En `src/services/supabase.ts`, consultar `.from('app_update_config').select('min_supported_version, latest_version, force_update').eq('id', 1).maybeSingle()`. Devolver `{ minSupportedVersion, latestVersion, forceUpdate }` o `null`; registrar una advertencia si falla.

- [ ] **Step 4: Ejecutar prueba focalizada**

Ejecutar `pnpm vitest --run src/test/appUpdateConfig.test.ts`. Resultado esperado: PASS.

### Task 3: Integrar estado de actualización en la aplicación

**Files:**
- Create: `src/hooks/useAppUpdateStatus.ts`
- Create: `src/components/ui/ForcedUpdateScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/i18n/es.ts`
- Modify: `src/i18n/en.ts`

- [ ] **Step 1: Añadir hook de estado**

Implementar `useAppUpdateStatus({ enabled })` con estado `checking`, `required` y `error`. Consultar `getAppUpdateConfig()` al montar y cuando `visibilitychange` pase a `visible`. Marcar `required = true` solo si `forceUpdate` es verdadero y `isVersionSupported(APP_VERSION, minSupportedVersion)` es falso. Un error remoto debe dejar `required = false`.

- [ ] **Step 2: Añadir pantalla bloqueante**

Crear `ForcedUpdateScreen` accesible, con título, explicación y botón con icono `RefreshCw`. El botón debe intentar `registration.update()`, enviar `SKIP_WAITING` si existe `waiting`, y recargar. Si no hay service worker registrado, recargar igualmente con `window.location.reload()`.

- [ ] **Step 3: Integrar en `App.tsx`**

Activar el hook solo para la ventana principal, usando la detección existente de `/projection` y `window.name`. Renderizar `ForcedUpdateScreen` antes de las vistas operativas cuando `required` sea verdadero. No mostrarla en la ventana de proyección.

- [ ] **Step 4: Añadir traducciones**

Agregar claves `forcedUpdate.title`, `forcedUpdate.message` y `forcedUpdate.action` en español e inglés, manteniendo el idioma del store.

- [ ] **Step 5: Ejecutar typecheck**

Ejecutar `pnpm tsc --noEmit`. Resultado esperado: sin errores.

### Task 4: Completar el flujo del service worker y el botón normal

**Files:**
- Modify: `src/hooks/useSWUpdate.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Configurar activación controlada**

Mantener `registerType: 'prompt'` para no recargar durante una proyección. Añadir `skipWaiting: true` solo si el mensaje explícito sigue siendo necesario según el worker generado; comprobar que `SKIP_WAITING` sea compatible con el worker de `vite-plugin-pwa`.

- [ ] **Step 2: Hacer robusto el hook**

Guardar y remover el listener de `visibilitychange` en cleanup. Manejar errores de `register`, `update` y `getRegistration` sin rechazos no controlados. En `updateApp`, esperar `controllerchange` cuando sea posible y usar una sola recarga como fallback.

- [ ] **Step 3: Validar build PWA**

Ejecutar `pnpm build` y revisar que se genere `dist/sw.js` sin errores.

### Task 5: Validar cambios completos

**Files:**
- No additional files.

- [ ] **Step 1: Ejecutar pruebas unitarias completas**

Ejecutar `pnpm test`. Resultado esperado: suite completa PASS.

- [ ] **Step 2: Ejecutar typecheck y build final**

Ejecutar `pnpm tsc --noEmit` y `pnpm build`. Ambos deben finalizar con código 0.

- [ ] **Step 3: Revisar diff y estado**

Ejecutar `git diff --check` y `git status --short`. Confirmar que solo aparecen la especificación, el plan y los archivos de actualización global; no modificar ni borrar cambios ajenos.

- [ ] **Step 4: Documentar operación**

Añadir en `docs/SUPABASE.md` el comando SQL o procedimiento para cambiar `min_supported_version` y `force_update` desde un entorno administrativo, sin exponer credenciales ni habilitar escritura pública.
