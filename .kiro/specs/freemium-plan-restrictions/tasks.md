# Implementation Plan: Freemium Plan Restrictions

## Overview

Este plan implementa el modelo freemium en Proclama, diferenciando entre usuarios gratuitos (Free) y premium (Premium). La implementación se centra en actualizar el hook usePlan con todos los helpers necesarios, aplicar restricciones en los componentes clave (LibraryView, OnlineSearchModal, MediaPanel), y agregar indicadores visuales claros de las funcionalidades premium.

## Tasks

- [x] 1. Actualizar hook usePlan con helper canUseMediaBackgrounds
  - Agregar la función `canUseMediaBackgrounds` que retorna `isPremium`
  - Exportar `canUseMediaBackgrounds` en la interfaz del hook
  - Asegurar que la función respeta el flag `PREMIUM_FOR_EVERYONE`
  - _Requirements: 3.1, 3.4, 6.1, 6.5_

- [ ]* 1.1 Write property test for usePlan hook
  - **Property 5: Media background restrictions**
  - **Property 11: Admin always premium**
  - **Property 12: Plan value correctness**
  - **Property 13: PREMIUM_FOR_EVERYONE override**
  - **Validates: Requirements 3.1, 3.4, 6.1, 6.2, 8.2**

- [x] 2. Implementar restricciones de fondos multimedia en MediaPanel
  - [x] 2.1 Importar y usar hook usePlan en MediaPanel
    - Importar `usePlan` desde `@/hooks/usePlan`
    - Extraer `canUseMediaBackgrounds` del hook
    - _Requirements: 3.1, 3.4_

  - [x] 2.2 Bloquear carga de archivos multimedia para usuarios free
    - Modificar función `processFiles` para verificar `canUseMediaBackgrounds`
    - Mostrar mensaje de error cuando usuario free intenta cargar archivos
    - Mensaje: "Los fondos multimedia son una función premium. Actualiza tu plan para acceder."
    - _Requirements: 3.2, 3.3_

  - [x] 2.3 Agregar indicador visual de restricción en header del panel
    - Agregar icono `Lock` junto al título cuando `!canUseMediaBackgrounds`
    - Importar `Lock` desde `lucide-react`
    - _Requirements: 7.1, 7.3_

  - [x] 2.4 Renderizar mensaje de función premium para usuarios free
    - Crear bloque condicional que muestra mensaje premium cuando `!canUseMediaBackgrounds`
    - Incluir icono `Lock`, título "Función Premium", y descripción
    - Sugerir alternativa: "Puedes usar fondos de color sólido y gradientes en el panel de temas."
    - Mantener renderizado normal del panel para usuarios premium
    - _Requirements: 3.3, 3.5, 7.2, 7.5_

- [ ]* 2.5 Write property test for MediaPanel restrictions
  - **Property 5: Media background restrictions**
  - **Validates: Requirements 3.1, 3.4**

- [ ]* 2.6 Write unit tests for MediaPanel
  - Test: Usuario free ve mensaje de restricción
  - Test: Usuario premium puede cargar archivos
  - Test: Icono de candado visible para usuario free
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Checkpoint - Verificar restricciones de MediaPanel
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Mejorar restricciones de sincronización en OnlineSearchModal
  - [x] 4.1 Modificar función handleSave para respetar canSync
    - Extraer `canSync` del hook `usePlan`
    - Modificar lógica de guardado: si `canSync && user`, sincronizar con Supabase
    - Si no `canSync`, guardar solo en Dexie local
    - Mantener comportamiento existente para usuarios sin autenticar
    - _Requirements: 5.1, 5.2, 5.4, 5.6_

- [ ]* 4.2 Write property test for cloud sync restrictions
  - **Property 8: Cloud sync restrictions**
  - **Property 9: Local-only storage for free users**
  - **Property 10: Cloud sync for premium users**
  - **Validates: Requirements 5.1, 5.4, 5.5**

- [ ]* 4.3 Write unit tests for OnlineSearchModal sync behavior
  - Test: Usuario free guarda canción solo en Dexie
  - Test: Usuario premium guarda en Dexie y Supabase
  - Test: Verificar que no se llama `createSong` para usuarios free
  - _Requirements: 5.1, 5.4, 5.6_

- [x] 5. Aplicar restricciones de sincronización en SongEditor
  - [x] 5.1 Importar y usar hook usePlan en SongEditor
    - Importar `usePlan` desde `@/hooks/usePlan`
    - Extraer `canSync` del hook
    - _Requirements: 5.1, 5.4_

  - [x] 5.2 Modificar función de guardado para respetar canSync
    - En la función que guarda canciones (crear/editar), verificar `canSync`
    - Si `canSync && user`, llamar a `createSong` o `updateSong` de Supabase
    - Si no `canSync`, guardar solo en Dexie
    - Asegurar que siempre se guarda en Dexie primero
    - _Requirements: 5.1, 5.2, 5.4, 5.6_

- [ ]* 5.3 Write unit tests for SongEditor sync behavior
  - Test: Usuario free crea canción solo en Dexie
  - Test: Usuario premium crea canción en Dexie y Supabase
  - Test: Usuario free edita canción solo en Dexie
  - Test: Usuario premium edita canción en Dexie y Supabase
  - _Requirements: 5.1, 5.4, 5.6_

- [x] 6. Checkpoint - Verificar sincronización condicional
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Mejorar indicadores visuales en LibraryView
  - [x] 7.1 Verificar tooltips en botones deshabilitados
    - Asegurar que botón "Nueva canción" tiene tooltip cuando está deshabilitado
    - Tooltip: "Límite de 10 canciones propias alcanzado — actualiza tu plan"
    - Asegurar que botón "Buscar online" tiene tooltip cuando está deshabilitado
    - Tooltip: "Función premium — actualiza tu plan"
    - _Requirements: 7.2, 7.5_

  - [x] 7.2 Verificar iconos de candado en botones deshabilitados
    - Confirmar que icono `Lock` aparece en botón "Nueva canción" cuando deshabilitado
    - Confirmar que icono `Lock` aparece en botón "Buscar online" cuando deshabilitado
    - _Requirements: 7.1, 7.3_

- [ ]* 7.3 Write unit tests for LibraryView visual indicators
  - Test: Botón "Nueva canción" deshabilitado cuando límite alcanzado
  - Test: Icono de candado visible en botón "Nueva canción" para usuario free con 10 canciones
  - Test: Botón "Buscar online" deshabilitado para usuario free
  - Test: Icono de candado visible en botón "Buscar online" para usuario free
  - Test: Tooltips correctos en botones deshabilitados
  - _Requirements: 2.2, 4.2, 4.3, 7.1, 7.2, 7.3_

- [x] 8. Agregar estilos CSS para mensajes de restricción premium
  - [x] 8.1 Crear estilos para .premium-feature-notice
    - Crear clase CSS para mensajes de función premium
    - Incluir estilos para layout centrado, icono, título y descripción
    - Usar variables CSS existentes para colores y espaciado
    - Aplicar en MediaPanel y OnlineSearchModal
    - _Requirements: 7.5_

- [ ]* 8.2 Write unit tests for accessibility of restriction indicators
  - Test: Botones deshabilitados tienen `aria-label` descriptivo
  - Test: Mensajes de restricción tienen `role="alert"` para lectores de pantalla
  - Test: Tooltips son accesibles mediante teclado
  - _Requirements: 7.4_

- [ ] 9. Implementar property-based tests para propiedades de correctness
  - [ ]* 9.1 Write property test for public library access
    - **Property 1: Public library access**
    - **Validates: Requirements 1.1, 1.2**
    - Verificar que todos los usuarios pueden acceder a canciones públicas verificadas

  - [ ]* 9.2 Write property test for free user song creation limit
    - **Property 2: Free user song creation limit**
    - **Validates: Requirements 2.1, 2.5**
    - Verificar que `canCreateSong` retorna false cuando `ownSongCount >= 10` para usuarios free

  - [ ]* 9.3 Write property test for premium user unlimited songs
    - **Property 3: Premium user unlimited songs**
    - **Validates: Requirements 2.4, 2.5**
    - Verificar que `canCreateSong` retorna true para cualquier `ownSongCount` en usuarios premium

  - [ ]* 9.4 Write property test for new song button state
    - **Property 4: New song button state**
    - **Validates: Requirements 2.2**
    - Verificar que botón "Nueva canción" tiene `disabled=true` cuando `canCreateSong` retorna false

  - [ ]* 9.5 Write property test for gradient backgrounds unrestricted
    - **Property 6: Gradient backgrounds unrestricted**
    - **Validates: Requirements 3.5**
    - Verificar que fondos de gradiente están disponibles para todos los usuarios

  - [ ]* 9.6 Write property test for Genius search restrictions
    - **Property 7: Genius search restrictions**
    - **Validates: Requirements 4.1, 4.4, 4.5**
    - Verificar que `canUseGenius` retorna false para usuarios free y true para premium

  - [ ]* 9.7 Write property test for plan-based restrictions when flag disabled
    - **Property 14: Plan-based restrictions when flag disabled**
    - **Validates: Requirements 8.3**
    - Verificar que restricciones se aplican correctamente cuando `PREMIUM_FOR_EVERYONE=false`

- [x] 10. Checkpoint final - Verificar todas las restricciones
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integración y validación completa
  - [x] 11.1 Verificar comportamiento con PREMIUM_FOR_EVERYONE=true
    - Confirmar que todos los usuarios tienen acceso premium
    - Verificar que no hay restricciones visibles
    - _Requirements: 8.2_

  - [x] 11.2 Verificar comportamiento con PREMIUM_FOR_EVERYONE=false
    - Confirmar que usuarios free tienen restricciones aplicadas
    - Confirmar que usuarios premium tienen acceso completo
    - Confirmar que administradores tienen acceso completo independientemente del plan
    - _Requirements: 8.3, 6.6_

  - [x] 11.3 Verificar conteo correcto de canciones propias
    - Confirmar que `ownSongCount` solo cuenta canciones del usuario actual
    - Verificar que canciones públicas no se cuentan en el límite
    - _Requirements: 2.1, 2.5_

- [ ]* 11.4 Write integration tests for complete user flows
  - Test: Flujo completo de usuario free creando 10 canciones
  - Test: Flujo completo de usuario free intentando crear canción 11
  - Test: Flujo completo de usuario premium creando canciones ilimitadas
  - Test: Flujo completo de usuario free intentando usar Genius
  - Test: Flujo completo de usuario free intentando cargar fondos multimedia
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2_

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido
- Cada tarea referencia requisitos específicos para trazabilidad
- Los checkpoints aseguran validación incremental
- Los property tests validan las 14 propiedades de correctness del diseño
- Los unit tests validan casos específicos y comportamiento de UI
- El código existente en LibraryView y OnlineSearchModal ya implementa parte de las restricciones
- La implementación debe mantener compatibilidad con el flag `PREMIUM_FOR_EVERYONE`
