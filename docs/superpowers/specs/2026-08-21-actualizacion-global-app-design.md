# Actualizacion global de Proclama

## Objetivo

Evitar que equipos con una version antigua sigan operando indefinidamente cuando se publique una version que deba ser obligatoria, sin romper el modo offline ni interrumpir silenciosamente la proyeccion.

## Diseno aprobado

### Version local

Definir una constante de version de aplicacion en el frontend. El valor se compara como una version semantica simple (`major.minor.patch`) mediante una funcion pura y testeable.

### Configuracion remota

Crear una tabla/configuracion publica de Supabase con una fila activa que contenga:

- `min_supported_version`: version minima permitida.
- `latest_version`: version informativa mas reciente.
- `force_update`: indica si la aplicacion debe bloquearse.
- `updated_at`: auditoria del cambio.

La lectura sera publica y de solo lectura para clientes. La escritura quedara restringida a administradores mediante RLS. Si la consulta falla, la app continua funcionando con la version local y el modo offline.

### Flujo de cliente

Al iniciar la ventana principal y al volver a primer plano, el cliente consulta la configuracion remota con timeout. Si la version local es menor que `min_supported_version` y `force_update` esta activo, se muestra una pantalla bloqueante con accion para actualizar. La accion solicita la actualizacion del service worker, limpia caches controlados si es necesario y recarga la pagina.

La ventana de proyeccion no mostrara el bloqueo para no dejar una pantalla de culto inutilizable; recibira la recarga al actualizarse la ventana principal.

### Service worker

Mantener el aviso actual para actualizaciones normales. Asegurar que el mensaje `SKIP_WAITING` sea procesado y que la nueva version tome control despues de la accion del usuario. No activar recargas automaticas durante una sesion de proyeccion.

### Errores y compatibilidad

- Sin conexion: no se bloquea la app.
- Configuracion remota inexistente: no se bloquea la app.
- Version malformada: se ignora la configuracion remota y se registra una advertencia.
- El boton existente seguira disponible cuando haya una actualizacion pendiente.

## Pruebas

- Comparacion de versiones: menor, igual, mayor y entradas invalidas.
- La configuracion remota no bloquea cuando falla la red.
- Una version inferior se bloquea solo con `force_update` activo.
- Una version igual o superior continua normalmente.
- Build y suite de Vitest existentes.

## Fuera de alcance

- Actualizar datos de canciones o contenido de Supabase.
- Borrar IndexedDB, para preservar datos locales.
- Recargar automaticamente la ventana de proyeccion.
