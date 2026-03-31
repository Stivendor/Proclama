# Implementation Plan: Terms and Conditions

## Overview

Implementar la feature de Términos y Condiciones de forma incremental: primero las constantes y tipos base, luego el contenido y componentes visuales, después la lógica del store, y finalmente la integración en los flujos de la app (registro, modo invitado, detección de versión y sincronización con Supabase).

## Tasks

- [x] 1. Crear constantes y tipos base
  - Crear `src/constants/terms.ts` con `CURRENT_TERMS_VERSION = "1.0"` y `TERMS_LAST_UPDATED`
  - Añadir la interfaz `TermsAcceptance` a `src/types/index.ts`
  - Añadir `'terms'` al union type de `activeView` en `src/types/index.ts`
  - _Requirements: 3.3, 4.1_

- [x] 2. Implementar lógica del store
  - [x] 2.1 Extender `useAppStore` en `src/stores/index.ts`
    - Añadir `termsAccepted: TermsAcceptance | null` al estado
    - Añadir `termsSyncPending: boolean` al estado
    - Implementar `acceptTerms(version: string): Promise<void>`
    - Implementar `checkTermsVersion(): boolean`
    - Añadir `termsAccepted` al `partialize` del persist middleware
    - _Requirements: 1.4, 1.5, 2.3, 4.1, 4.4, 5.4_

  - [ ]* 2.2 Escribir property test — Property 1: Aceptación persiste en localStorage
    - **Property 1: Aceptación persiste en localStorage**
    - **Validates: Requirements 1.4, 1.5, 2.3**

  - [ ]* 2.3 Escribir property test — Property 3: Bloqueo por versión desactualizada
    - **Property 3: Bloqueo por versión desactualizada**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [ ]* 2.4 Escribir property test — Property 4: Actualización de versión en re-aceptación
    - **Property 4: Actualización de versión en re-aceptación**
    - **Validates: Requirements 4.4**

  - [ ]* 2.5 Escribir unit tests para `checkTermsVersion`
    - Caso: `termsAccepted = null` → retorna `true`
    - Caso: versión igual a `CURRENT_TERMS_VERSION` → retorna `false`
    - _Requirements: 4.1_

- [ ] 3. Checkpoint — Asegurarse de que todos los tests del store pasan
  - Asegurarse de que todos los tests pasan, preguntar al usuario si hay dudas.

- [x] 4. Implementar funciones de Supabase
  - [x] 4.1 Añadir `syncTermsAcceptance` y `fetchTermsAcceptance` a `src/services/supabase.ts`
    - `syncTermsAcceptance(userId, version, acceptedAt)`: hace upsert en `profiles` con `terms_version` y `terms_accepted_at`
    - `fetchTermsAcceptance(userId)`: recupera `terms_version` y `terms_accepted_at` de `profiles`
    - _Requirements: 5.1, 5.2_

  - [ ]* 4.2 Escribir property test — Property 7: Sincronización round-trip con Supabase
    - **Property 7: Sincronización round-trip con Supabase**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 4.3 Escribir property test — Property 8: Fallo de sincronización preserva aceptación local
    - **Property 8: Fallo de sincronización preserva aceptación local**
    - **Validates: Requirements 5.4**

- [x] 5. Implementar componente `TermsContent`
  - Crear `src/components/TermsContent.tsx` como componente puro sin props
  - Incluir el texto completo de los T&C con encabezados, párrafos y listas
  - Usar solo variables CSS del dark theme de `src/index.css`
  - _Requirements: 3.2, 6.1_

- [x] 6. Implementar `TermsModal`
  - [x] 6.1 Crear `src/components/TermsModal.tsx` con props `mode`, `onAccept`, `onClose`
    - Añadir `role="dialog"`, `aria-modal="true"`, `aria-labelledby="terms-modal-title"`
    - Área de scroll con `<TermsContent />`
    - Checkbox con `id="terms-accept-checkbox"`, `aria-required="true"`
    - Botón "Aceptar y continuar" deshabilitado hasta que el checkbox esté marcado
    - Botón de cierre con `aria-label="Cerrar términos"` visible solo en `mode='optional'`
    - Gestión de foco al abrirse y cerrarse
    - _Requirements: 1.2, 1.3, 1.6, 2.2, 6.1, 6.2, 6.4_

  - [ ]* 6.2 Escribir property test — Property 2: Botón deshabilitado sin checkbox
    - **Property 2: Botón deshabilitado sin checkbox**
    - **Validates: Requirements 1.3, 2.2**

  - [ ]* 6.3 Escribir unit tests para `TermsModal`
    - `mode='required'`: botón de cierre no aparece
    - `mode='optional'`: botón de cierre aparece con `aria-label="Cerrar términos"`
    - Verificar atributos de accesibilidad: `role`, `aria-modal`, `aria-labelledby`
    - _Requirements: 6.2, 6.4_

- [x] 7. Implementar `TermsView`
  - [x] 7.1 Crear `src/pages/TermsView.tsx`
    - Renderizar `<TermsContent />`
    - Mostrar `CURRENT_TERMS_VERSION` y `TERMS_LAST_UPDATED`
    - Si existe `termsAccepted` en el store, mostrar la fecha de aceptación formateada
    - Botón "Volver a Ajustes" con icono `ArrowLeft` de `lucide-react` que llama a `setActiveView('settings')`
    - Responsive desde 320px usando variables CSS del dark theme
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 6.1, 6.3, 6.5_

  - [ ]* 7.2 Escribir property test — Property 6: TermsView muestra fecha de aceptación
    - **Property 6: TermsView muestra fecha de aceptación del usuario**
    - **Validates: Requirements 3.4**

  - [ ]* 7.3 Escribir unit tests para `TermsView`
    - Sin `termsAccepted` en el store: no debe mostrar fecha de aceptación
    - Con `termsAccepted` en el store: debe mostrar la fecha formateada
    - _Requirements: 3.4_

- [ ] 8. Checkpoint — Asegurarse de que todos los tests de componentes pasan
  - Asegurarse de que todos los tests pasan, preguntar al usuario si hay dudas.

- [x] 9. Integrar `TermsView` en el shell de la app
  - Añadir `{activeView === 'terms' && <TermsView />}` en `src/App.tsx` dentro de `MainApp`
  - Importar `TermsView` en `App.tsx`
  - _Requirements: 3.1_

- [x] 10. Integrar detección de versión en `App.tsx`
  - En `AppContent`, después de resolver `authStatus`, llamar a `checkTermsVersion()`
  - Si retorna `true`, renderizar `<TermsModal mode="required" onAccept={...} onClose={() => {}} />` bloqueando `MainApp`
  - Al aceptar, llamar a `acceptTerms(CURRENT_TERMS_VERSION)`
  - Al iniciar sesión (evento `SIGNED_IN`), llamar a `fetchTermsAcceptance(userId)` y actualizar el store si la versión remota es igual a la vigente; si hay `termsSyncPending`, reintentar `syncTermsAcceptance`
  - _Requirements: 4.2, 4.3, 5.2, 5.3, 5.4_

- [x] 11. Integrar `TermsModal` en `LandingView`
  - En `src/pages/LandingView.tsx`, el botón "Continuar sin cuenta" abre `TermsModal` con `mode='required'`
  - Al aceptar: llamar a `acceptTerms(CURRENT_TERMS_VERSION)` y luego a `setGuestMode(true)`
  - Al cerrar sin aceptar: `LandingView` permanece visible, `guestMode` no cambia
  - _Requirements: 2.1, 2.3, 2.4_

  - [ ]* 11.1 Escribir property test — Property 5: Modo invitado no se activa sin aceptación
    - **Property 5: Modo invitado no se activa sin aceptación**
    - **Validates: Requirements 2.4**

- [x] 12. Integrar `TermsModal` en `SettingsView`
  - En `src/pages/SettingsView.tsx`, interceptar el clic en "Crear Cuenta"
  - Mostrar `TermsModal` con `mode='optional'` antes de llamar a `supabase.auth.signUp`
  - Al aceptar: llamar a `acceptTerms(CURRENT_TERMS_VERSION)` y continuar con el registro
  - Al cerrar sin aceptar: el modal se cierra, el formulario de registro permanece visible sin iniciar el proceso
  - Añadir enlace/botón "Términos y Condiciones" en la sección de cuenta que llama a `setActiveView('terms')`
  - _Requirements: 1.1, 1.6, 3.1_

- [ ] 13. Checkpoint final — Asegurarse de que todos los tests pasan
  - Asegurarse de que todos los tests pasan, preguntar al usuario si hay dudas.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los property tests usan **fast-check** con mínimo 100 iteraciones por test
- Los checkpoints garantizan validación incremental antes de continuar con integraciones
