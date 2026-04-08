# Skill: Proclama Management

Habilidad específica para la gestión, mantenimiento y evolución del ecosistema Proclama.

## Conocimientos de Dominio

### 1. Sistema de Proyección Dual
Proclama utiliza un sistema de dos ventanas comunicadas mediante `BroadcastChannel`. 
- **Main Window**: Controlador de estado.
- **Projection Window**: Renderizador basado en un canvas de resolución fija (1920x1080) con auto-escalado dinámico.
- **Patrón Crítico**: Cualquier cambio en el tema visual o el contenido debe despachar un mensaje `PROJECTION_UPDATE`.

### 2. Sincronización Híbrida (Dexie + Supabase)
El sistema prioriza la disponibilidad offline mediante Dexie (IndexedDB) y sincroniza con Supabase en segundo plano.
- **Estrategia de Guardado**: Usar siempre `db.songs.put` o `upsert` para evitar colisiones de IDs entre local y nube.
- **Migración**: Al iniciar sesión, el sistema debe mover los registros creados como 'guest' al ID del usuario autenticado.

### 3. Autenticación y Seguridad
- **RLS (Row Level Security)**: Las tablas `songs`, `setlists` y `attendance_records` están protegidas. El acceso de escritura requiere que `auth.uid() = user_id`.
- **Timeouts**: `App.tsx` implementa un timeout de 6s para la inicialización de auth, permitiendo el uso de la app incluso si Supabase tarda en responder.

## Procedimientos Sugeridos

### Para Añadir una Nueva Funcionalidad
1.  **Modelo**: Actualizar `src/types/index.ts`.
2.  **Persistencia Local**: Actualizar el esquema en `src/db/index.ts`.
3.  **Persistencia Cloud**: Crear la tabla/RLS en Supabase y añadir el servicio en `src/services/supabase.ts`.
4.  **UI**: Crear la vista en `src/pages` y añadir la ruta virtual en `useAppStore.activeView`.

### Para Diagnosticar Fallos de Guardado
1.  Verificar si el usuario tiene sesión activa (`authStatus === 'authenticated'`).
2.  Comprobar el log de consola por errores de RLS (códigos 42501 o similar).
3.  Asegurarse de que el componente disponga de un bloque `try/catch` con feedback visual para el usuario.
