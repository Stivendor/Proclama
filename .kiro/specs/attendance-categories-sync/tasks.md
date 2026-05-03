# Implementation Plan

- [x] 1. Escribir test de exploración del bug condition (ANTES del fix)
  - **Property 1: Bug Condition** - Categorías leídas desde `attendance_records` en lugar de `profiles.settings`
  - **CRITICAL**: Este test DEBE FALLAR en el código sin corregir — el fallo confirma que el bug existe
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Este test codifica el comportamiento esperado — validará el fix cuando pase después de la implementación
  - **GOAL**: Exponer contraejemplos que demuestren que la RPC devuelve categorías incorrectas
  - **Scoped PBT Approach**: Enfocar la propiedad en los casos concretos del bug condition:
    - Caso 1: Usuario con `profiles.settings.attendanceCategories = ['Escuela Dominical', 'Jóvenes']` y sin `attendance_records` → la RPC devuelve defaults en lugar de las categorías configuradas
    - Caso 2: Usuario con último `attendance_record` con `['Caballeros', 'Damas', 'Niños']` pero `profiles.settings.attendanceCategories = ['Caballeros', 'Damas', 'Adolescentes']` → la RPC devuelve el nombre viejo
    - Caso 3: Usuario con 4 categorías en el último registro pero solo 3 en `profiles.settings` → la RPC devuelve 4 categorías
  - Crear archivo `src/test/bugfix-attendance-categories-sync.test.ts`
  - El test debe mockear la respuesta de `supabase.rpc('validate_church_pin')` simulando el comportamiento actual (buggy) y verificar que el campo devuelto NO coincide con `profiles.settings.attendanceCategories`
  - Ejecutar el test en código SIN CORREGIR
  - **EXPECTED OUTCOME**: Test FALLA (esto es correcto — prueba que el bug existe)
  - Documentar los contraejemplos encontrados (ej: "RPC devuelve `['Caballeros','Damas','Amigos','Niños']` en lugar de `['Escuela Dominical','Jóvenes']`")
  - Marcar tarea completa cuando el test esté escrito, ejecutado y el fallo documentado
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Escribir tests de preservación (ANTES del fix)
  - **Property 2: Preservation** - Comportamiento no relacionado con categorías permanece igual
  - **IMPORTANT**: Seguir la metodología observation-first
  - Observar el comportamiento en código SIN CORREGIR para inputs que NO activan el bug condition:
    - Observar: PIN inválido → la RPC devuelve array vacío o error
    - Observar: PIN válido de iglesia sin plan Premium → la RPC devuelve `is_premium: false`
    - Observar: PIN válido Premium → los campos `user_id`, `label`, `is_premium`, `settings.serviceNameTemplates` tienen valores correctos
    - Observar: `profiles.settings` NULL o sin `attendanceCategories` → la RPC devuelve defaults `['Caballeros','Damas','Amigos','Niños']`
  - Escribir tests de propiedad que capturen el comportamiento observado para inputs no afectados por el bug
  - Los tests deben mockear `supabase.rpc` con respuestas que simulen el comportamiento actual para estos casos
  - Ejecutar tests en código SIN CORREGIR
  - **EXPECTED OUTCOME**: Tests PASAN (confirma el comportamiento baseline a preservar)
  - Marcar tarea completa cuando los tests estén escritos, ejecutados y pasando en código sin corregir
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix: Sincronizar categorías desde `profiles.settings` en lugar de `attendance_records`

  - [x] 3.1 Modificar la función SQL `validate_church_pin` en Supabase
    - Leer la definición actual de la función via MCP de Supabase para confirmar la causa raíz
    - Eliminar el subquery/JOIN sobre `attendance_records` que obtiene `category_names`
    - Agregar lectura del campo JSONB `profiles.settings->'attendanceCategories'` con fallback:
      ```sql
      CASE
        WHEN p.settings->'attendanceCategories' IS NOT NULL
             AND jsonb_array_length(p.settings->'attendanceCategories') > 0
        THEN p.settings->'attendanceCategories'
        ELSE '["Caballeros","Damas","Amigos","Niños"]'::jsonb
      END AS settings_categories
      ```
    - Renombrar el campo de retorno de `latest_categories` a `settings_categories` en la definición de la función
    - Aplicar la migración via MCP de Supabase
    - _Bug_Condition: `isBugCondition(input)` — la RPC lee `category_names` desde `attendance_records` en lugar de `profiles.settings->'attendanceCategories'`_
    - _Expected_Behavior: `result.settings_categories` = `profiles[userId].settings.attendanceCategories` OR defaults si el campo no existe o está vacío_
    - _Preservation: Validación de PIN, rechazo por plan no Premium, campos `user_id`/`label`/`is_premium`/`settings.serviceNameTemplates` no deben cambiar_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Actualizar `RecepcionView.tsx` para usar `settings_categories`
    - En `handleVerify`, cambiar la asignación de `categories`:
      ```typescript
      // ANTES:
      categories: churchInfo.latest_categories || ['Caballeros', 'Damas', 'Amigos', 'Niños'],
      // DESPUÉS:
      categories: churchInfo.settings_categories || ['Caballeros', 'Damas', 'Amigos', 'Niños'],
      ```
    - En `handleVerify`, cambiar la inicialización del array `att`:
      ```typescript
      // ANTES:
      setAtt(new Array((churchInfo.latest_categories || [1, 2, 3, 4]).length).fill(''))
      // DESPUÉS:
      setAtt(new Array((churchInfo.settings_categories || [1, 2, 3, 4]).length).fill(''))
      ```
    - _Bug_Condition: El frontend consume `churchInfo.latest_categories` que proviene del último `attendance_record`_
    - _Expected_Behavior: El frontend consume `churchInfo.settings_categories` que proviene de `profiles.settings`_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verificar que el test de exploración del bug condition ahora pasa
    - **Property 1: Expected Behavior** - Categorías reflejan `profiles.settings.attendanceCategories`
    - **IMPORTANT**: Re-ejecutar el MISMO test del paso 1 — NO escribir un test nuevo
    - El test del paso 1 codifica el comportamiento esperado
    - Cuando este test pase, confirma que el comportamiento esperado se cumple
    - Actualizar el mock del test para simular la respuesta corregida (usando `settings_categories`)
    - Ejecutar el test de exploración del bug condition del paso 1
    - **EXPECTED OUTCOME**: Test PASA (confirma que el bug está corregido)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verificar que los tests de preservación siguen pasando
    - **Property 2: Preservation** - Comportamiento no relacionado con categorías permanece igual
    - **IMPORTANT**: Re-ejecutar los MISMOS tests del paso 2 — NO escribir tests nuevos
    - Ejecutar los tests de preservación del paso 2
    - **EXPECTED OUTCOME**: Tests PASAN (confirma que no hay regresiones)
    - Confirmar que todos los tests pasan después del fix (sin regresiones)

- [x] 4. Checkpoint — Asegurar que todos los tests pasan
  - Ejecutar la suite completa de tests: `npx vitest run src/test/bugfix-attendance-categories-sync.test.ts`
  - Verificar que tanto el test de bug condition (Property 1) como los tests de preservación (Property 2) pasan
  - Confirmar que no hay regresiones en otros tests del proyecto
  - Preguntar al usuario si surgen dudas o si se necesita ajustar algo
