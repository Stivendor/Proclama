# Bugfix Requirements Document

## Introduction

La vista de recepción móvil (`RecepcionView.tsx`) muestra categorías de asistencia incorrectas al validar el PIN de la iglesia. En lugar de mostrar las categorías personalizadas configuradas por el usuario en el PC (ej: "Escuela Dominical", "Culto de Jóvenes", "Adolescentes"), el celular recibe las categorías del último `attendance_record` guardado en la base de datos, o los valores por defecto ("Caballeros", "Damas", "Amigos", "Niños") si nunca se guardó un registro. La causa raíz es que la RPC `validate_church_pin` lee `latest_categories` desde el último registro de asistencia en lugar de leer `profiles.settings->>'attendanceCategories'`, que es donde el usuario guarda su configuración actual.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN la iglesia configura categorías personalizadas en el PC (ej: "Escuela Dominical", "Culto de Jóvenes") y nunca ha guardado un registro de asistencia con esas categorías THEN el celular muestra los valores por defecto ("Caballeros", "Damas", "Amigos", "Niños") en lugar de las categorías configuradas

1.2 WHEN la iglesia renombra una categoría existente (ej: "Niños" → "Adolescentes") en la configuración del PC THEN el celular sigue mostrando el nombre anterior ("Niños") porque la RPC lee el último `attendance_record` guardado, no `profiles.settings`

1.3 WHEN la iglesia agrega o elimina categorías en la configuración del PC sin haber guardado un nuevo registro de asistencia THEN el celular muestra la cantidad y nombres de categorías del último registro guardado, no la configuración actual

1.4 WHEN la RPC `validate_church_pin` es invocada THEN el campo `latest_categories` devuelto proviene del último `attendance_record` del usuario, ignorando el valor actualizado en `profiles.settings.attendanceCategories`

### Expected Behavior (Correct)

2.1 WHEN la iglesia configura categorías personalizadas en el PC y el celular valida el PIN THEN el sistema SHALL mostrar exactamente las categorías definidas en `profiles.settings.attendanceCategories` del usuario, independientemente de si existe o no un registro de asistencia previo

2.2 WHEN la iglesia renombra una categoría en la configuración del PC y el celular valida el PIN THEN el sistema SHALL mostrar el nombre actualizado de la categoría tal como está en `profiles.settings.attendanceCategories`

2.3 WHEN la iglesia agrega o elimina categorías en la configuración del PC y el celular valida el PIN THEN el sistema SHALL mostrar la lista de categorías actualizada con la cantidad y nombres correctos según `profiles.settings.attendanceCategories`

2.4 WHEN la RPC `validate_church_pin` es invocada THEN el sistema SHALL leer las categorías directamente desde `profiles.settings->>'attendanceCategories'` para garantizar que siempre refleje la configuración actual del PC

### Unchanged Behavior (Regression Prevention)

3.1 WHEN la iglesia no ha configurado categorías personalizadas (usa los defaults) y el celular valida el PIN THEN el sistema SHALL CONTINUE TO mostrar las categorías por defecto ("Caballeros", "Damas", "Amigos", "Niños")

3.2 WHEN el PIN ingresado en el celular es inválido THEN el sistema SHALL CONTINUE TO rechazar la validación con el mensaje de error correspondiente

3.3 WHEN el PIN ingresado corresponde a una iglesia sin plan Premium THEN el sistema SHALL CONTINUE TO rechazar el acceso con el mensaje de error de plan requerido

3.4 WHEN el celular guarda un registro de asistencia mediante `submit_reception_attendance` THEN el sistema SHALL CONTINUE TO guardar correctamente los valores de asistencia con los nombres de categorías recibidos

3.5 WHEN la RPC `validate_church_pin` devuelve datos válidos THEN el sistema SHALL CONTINUE TO retornar `user_id`, `label`, `is_premium` y `settings` (incluyendo `serviceNameTemplates`) sin cambios en su comportamiento actual
