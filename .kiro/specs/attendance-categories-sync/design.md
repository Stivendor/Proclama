# attendance-categories-sync Bugfix Design

## Overview

La RPC `validate_church_pin` en Supabase devuelve las categorías de asistencia leyéndolas del último `attendance_record` guardado (campo `latest_categories`), en lugar de leerlas desde `profiles.settings.attendanceCategories`, que es donde el usuario guarda su configuración actual desde el PC.

El fix consiste en modificar la función SQL `validate_church_pin` para que lea las categorías directamente desde `profiles.settings->>'attendanceCategories'` (campo JSONB), con fallback a los valores por defecto si el campo no existe o está vacío. Adicionalmente, se actualiza `RecepcionView.tsx` para usar el campo correcto del response de la RPC.

El cambio es mínimo y quirúrgico: no altera la firma de la RPC, no rompe otros consumidores, y garantiza que el celular siempre refleje la configuración actual del PC.

## Glossary

- **Bug_Condition (C)**: La condición que activa el bug — cuando `validate_church_pin` devuelve categorías leídas del último `attendance_record` en lugar de `profiles.settings.attendanceCategories`
- **Property (P)**: El comportamiento correcto esperado — la RPC debe devolver las categorías tal como están en `profiles.settings.attendanceCategories` del usuario
- **Preservation**: El comportamiento existente que no debe cambiar — validación de PIN, rechazo por plan inválido, guardado de registros de asistencia, y todos los demás campos del response de la RPC
- **`validate_church_pin`**: Función RPC en Supabase que valida el PIN de una iglesia y devuelve sus datos de configuración para el modo recepción
- **`profiles.settings`**: Campo JSONB en la tabla `profiles` donde se almacena el objeto `AppSettings` del usuario, incluyendo `attendanceCategories`
- **`attendance_records`**: Tabla donde se guardan los registros históricos de asistencia; actualmente (incorrectamente) usada como fuente de categorías
- **`latest_categories`**: Campo que actualmente devuelve la RPC, obtenido del último `attendance_record`; debe ser reemplazado por `settings_categories`
- **`settings_categories`**: Nuevo nombre del campo en el response de la RPC, leído desde `profiles.settings`

## Bug Details

### Bug Condition

El bug se manifiesta cuando la RPC `validate_church_pin` es invocada desde `RecepcionView.tsx`. La función SQL lee las categorías haciendo un JOIN o subquery sobre `attendance_records` para obtener el último registro, en lugar de leer directamente el campo JSONB `settings` de la tabla `profiles`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input de tipo { pin_code: string }
  OUTPUT: boolean

  profileSettings := SELECT settings FROM profiles WHERE church_pin = input.pin_code
  lastRecord      := SELECT category_names FROM attendance_records
                     WHERE user_id = profile.user_id
                     ORDER BY created_at DESC LIMIT 1

  -- El bug ocurre cuando la RPC usa lastRecord en lugar de profileSettings
  RETURN profileSettings.attendanceCategories != lastRecord.category_names
         OR lastRecord IS NULL AND profileSettings.attendanceCategories != DEFAULT_CATEGORIES
END FUNCTION
```

### Examples

- **Ejemplo 1 — Categorías nuevas sin registro previo**: La iglesia configura ["Escuela Dominical", "Culto de Jóvenes"] en el PC. Nunca ha guardado un registro de asistencia. El celular recibe `['Caballeros', 'Damas', 'Amigos', 'Niños']` (defaults) en lugar de las categorías configuradas.

- **Ejemplo 2 — Categoría renombrada**: La iglesia tenía ["Caballeros", "Damas", "Niños", "Jóvenes"] y guardó un registro. Luego renombró "Niños" a "Adolescentes" en la configuración. El celular sigue recibiendo "Niños" porque la RPC lee el último `attendance_record`, no `profiles.settings`.

- **Ejemplo 3 — Categoría eliminada**: La iglesia tenía 4 categorías, eliminó una y quedaron 3 en `profiles.settings`. El celular sigue recibiendo 4 categorías porque el último registro guardado tenía 4.

- **Caso borde — Sin configuración personalizada**: La iglesia nunca modificó las categorías. `profiles.settings.attendanceCategories` contiene `['Caballeros', 'Damas', 'Amigos', 'Niños']` o el campo no existe. El celular debe recibir los defaults correctamente (comportamiento sin cambio visible).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- La validación del PIN (correcto/incorrecto) debe continuar funcionando exactamente igual
- El rechazo por plan no Premium debe continuar con el mismo mensaje de error
- Los campos `user_id`, `label`, `is_premium` y `settings` (con `serviceNameTemplates`) del response de la RPC no deben cambiar
- La RPC `submit_reception_attendance` no debe ser modificada; sigue recibiendo y guardando los nombres de categorías que le envía el frontend
- El comportamiento de fallback a defaults cuando no hay categorías configuradas debe mantenerse

**Scope:**
Todos los inputs que NO involucren la lectura de `latest_categories` deben quedar completamente sin cambios. Esto incluye:
- Validación de PIN inválido
- Validación de plan Premium
- Guardado de registros de asistencia
- Cualquier otro campo del response de `validate_church_pin`

**Nota:** El comportamiento correcto esperado (Property 1) está definido en la sección Correctness Properties.

## Hypothesized Root Cause

Basado en el análisis del bug y el código del frontend, las causas más probables son:

1. **Lectura desde tabla incorrecta**: La función SQL `validate_church_pin` hace un subquery o LEFT JOIN sobre `attendance_records` para obtener `category_names` del último registro, en lugar de leer `profiles.settings->>'attendanceCategories'` directamente.
   - El campo `settings` en `profiles` es de tipo JSONB
   - La clave dentro del JSON es `attendanceCategories` (camelCase, como en el frontend)
   - El acceso correcto en PostgreSQL sería: `(p.settings->>'attendanceCategories')::jsonb` o `p.settings->'attendanceCategories'`

2. **Nombre de campo incorrecto en el response**: La RPC devuelve el campo como `latest_categories` (nombre que sugiere que viene del último registro). El frontend en `RecepcionView.tsx` lo consume como `churchInfo.latest_categories`. Ambos deben actualizarse coordinadamente.

3. **Ausencia de fallback robusto en SQL**: Si `profiles.settings` es NULL o no contiene la clave `attendanceCategories`, la función debe devolver el array de defaults `['Caballeros', 'Damas', 'Amigos', 'Niños']`. El fallback actual puede estar dependiendo de que exista un `attendance_record`.

4. **Posible problema de tipos en JSONB**: El campo `attendanceCategories` dentro del JSON es un array de strings. En PostgreSQL, extraerlo correctamente requiere usar `->'attendanceCategories'` (devuelve JSONB) en lugar de `->>'attendanceCategories'` (devuelve text). Hay que asegurarse de que el tipo devuelto sea compatible con el tipo de retorno declarado de la función.

## Correctness Properties

Property 1: Bug Condition - Las categorías reflejan `profiles.settings.attendanceCategories`

_For any_ invocación de `validate_church_pin` con un PIN válido de una iglesia Premium, la función SQL corregida SHALL devolver en el campo `settings_categories` exactamente el array de strings almacenado en `profiles.settings->'attendanceCategories'` para ese usuario, o `['Caballeros', 'Damas', 'Amigos', 'Niños']` si el campo no existe o está vacío.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Comportamiento no relacionado con categorías permanece igual

_For any_ invocación de `validate_church_pin` donde el resultado no depende de las categorías (PIN inválido, plan no Premium, campos `user_id`/`label`/`is_premium`/`settings.serviceNameTemplates`), la función SQL corregida SHALL producir exactamente el mismo resultado que la función original, preservando toda la lógica de validación y los demás campos del response.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Asumiendo que el análisis de causa raíz es correcto:

**Cambio 1 — Función SQL en Supabase**

**Archivo**: Supabase SQL Editor / Migration  
**Función**: `validate_church_pin`

**Cambios específicos**:
1. **Eliminar subquery/JOIN sobre `attendance_records`**: Remover la parte de la función que lee `category_names` del último registro de asistencia.

2. **Leer desde `profiles.settings`**: Agregar lectura del campo JSONB:
   ```sql
   COALESCE(
     (p.settings->'attendanceCategories'),
     '["Caballeros","Damas","Amigos","Niños"]'::jsonb
   ) AS settings_categories
   ```

3. **Renombrar el campo en el RETURNS**: Cambiar `latest_categories` por `settings_categories` en la definición de retorno de la función (o mantener `latest_categories` como alias para no romper el frontend hasta que se actualice).

4. **Manejar NULL y array vacío**: Usar `COALESCE` y verificar que el array no esté vacío:
   ```sql
   CASE
     WHEN p.settings->'attendanceCategories' IS NOT NULL
          AND jsonb_array_length(p.settings->'attendanceCategories') > 0
     THEN p.settings->'attendanceCategories'
     ELSE '["Caballeros","Damas","Amigos","Niños"]'::jsonb
   END AS settings_categories
   ```

5. **Actualizar el tipo de retorno**: Si la función tiene un tipo de retorno declarado con `latest_categories`, actualizar a `settings_categories` (o agregar ambos durante la transición).

**Cambio 2 — Frontend `RecepcionView.tsx`**

**Archivo**: `src/pages/RecepcionView.tsx`  
**Función**: `handleVerify`

**Cambio específico**:
```typescript
// ANTES (línea ~52):
categories: churchInfo.latest_categories || ['Caballeros', 'Damas', 'Amigos', 'Niños'],

// DESPUÉS:
categories: churchInfo.settings_categories || ['Caballeros', 'Damas', 'Amigos', 'Niños'],
```

Y en la inicialización del array de asistencia:
```typescript
// ANTES:
setAtt(new Array((churchInfo.latest_categories || [1, 2, 3, 4]).length).fill(''))

// DESPUÉS:
setAtt(new Array((churchInfo.settings_categories || [1, 2, 3, 4]).length).fill(''))
```

## Testing Strategy

### Validation Approach

La estrategia de testing sigue un enfoque de dos fases: primero, exponer contraejemplos que demuestren el bug en el código sin corregir, luego verificar que el fix funciona correctamente y preserva el comportamiento existente.

### Exploratory Bug Condition Checking

**Goal**: Exponer contraejemplos que demuestren el bug ANTES de implementar el fix. Confirmar o refutar el análisis de causa raíz. Si se refuta, se deberá re-hipotetizar.

**Test Plan**: Escribir tests que invoquen (o simulen) `validate_church_pin` con distintos estados de `profiles.settings` y `attendance_records`, y verificar que el campo de categorías devuelto NO coincide con `profiles.settings.attendanceCategories`. Ejecutar estos tests en el código SIN CORREGIR para observar los fallos.

**Test Cases**:
1. **Categorías nuevas sin registro previo**: Usuario con `profiles.settings.attendanceCategories = ['Escuela Dominical', 'Jóvenes']` y sin `attendance_records`. La RPC devuelve defaults en lugar de las categorías configuradas. (fallará en código sin corregir)
2. **Categoría renombrada**: Usuario con último `attendance_record` con `['Caballeros', 'Damas', 'Niños']` pero `profiles.settings.attendanceCategories = ['Caballeros', 'Damas', 'Adolescentes']`. La RPC devuelve el nombre viejo. (fallará en código sin corregir)
3. **Categoría eliminada**: Usuario con último registro con 4 categorías pero `profiles.settings.attendanceCategories` con 3. La RPC devuelve 4 categorías. (fallará en código sin corregir)
4. **Settings NULL**: Usuario con `profiles.settings = NULL`. La RPC debe devolver defaults. (puede fallar o pasar dependiendo del fallback actual)

**Expected Counterexamples**:
- La RPC devuelve categorías del último `attendance_record` en lugar de `profiles.settings`
- Posibles causas: subquery sobre `attendance_records`, JOIN incorrecto, ausencia de lectura del campo JSONB `settings`

### Fix Checking

**Goal**: Verificar que para todos los inputs donde la condición del bug se cumple, la función corregida produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := validate_church_pin_fixed(input.pin_code)
  ASSERT result.settings_categories = profiles[input.userId].settings.attendanceCategories
         OR (profiles[input.userId].settings.attendanceCategories IS EMPTY
             AND result.settings_categories = DEFAULT_CATEGORIES)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde la condición del bug NO se cumple, la función corregida produce el mismo resultado que la función original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT validate_church_pin_original(input) = validate_church_pin_fixed(input)
END FOR
```

**Testing Approach**: Se recomienda property-based testing para preservation checking porque:
- Genera muchos casos de prueba automáticamente sobre el dominio de inputs
- Captura edge cases que los tests unitarios manuales podrían omitir
- Provee garantías fuertes de que el comportamiento no cambia para inputs no afectados por el bug

**Test Plan**: Observar el comportamiento en el código SIN CORREGIR para PINs inválidos, planes no Premium y otros campos del response, luego escribir tests de propiedad que capturen ese comportamiento.

**Test Cases**:
1. **Preservation de PIN inválido**: Verificar que el rechazo de PIN inválido funciona igual antes y después del fix
2. **Preservation de plan no Premium**: Verificar que el rechazo por plan sigue funcionando igual
3. **Preservation de campos del response**: Verificar que `user_id`, `label`, `is_premium`, `settings.serviceNameTemplates` no cambian
4. **Preservation de defaults**: Verificar que cuando no hay categorías configuradas, se devuelven los defaults correctos

### Unit Tests

- Test de la función SQL con usuario que tiene `attendanceCategories` en `profiles.settings` y sin `attendance_records`
- Test de la función SQL con usuario que tiene `attendanceCategories` actualizada y un `attendance_record` con categorías viejas
- Test de fallback cuando `profiles.settings` es NULL o no contiene `attendanceCategories`
- Test de fallback cuando `attendanceCategories` es un array vacío `[]`
- Test de que `RecepcionView.tsx` usa `settings_categories` del response correctamente

### Property-Based Tests

- Generar estados aleatorios de `profiles.settings.attendanceCategories` (arrays de strings de longitud 1-10) y verificar que la RPC devuelve exactamente esas categorías
- Generar combinaciones aleatorias de `attendance_records` con distintas categorías y verificar que la RPC ignora esos registros y usa `profiles.settings`
- Verificar que para cualquier PIN inválido, el comportamiento de rechazo es idéntico antes y después del fix

### Integration Tests

- Test end-to-end: configurar categorías en el PC (vía `updateUserSettings`), validar PIN en el celular, verificar que las categorías recibidas coinciden con las configuradas
- Test de flujo completo: configurar → validar PIN → registrar asistencia → verificar que el registro se guarda con las categorías correctas
- Test de sincronización: cambiar categorías en el PC, volver a validar el PIN en el celular, verificar que las nuevas categorías se reflejan inmediatamente
