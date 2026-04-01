# Bugfix Requirements Document

## Introduction

La aplicación Proclama presenta múltiples problemas de rendimiento y redundancia que afectan la experiencia del usuario, causando uso excesivo de bandwidth, consultas ineficientes a la base de datos, y potencial pérdida de datos por condiciones de carrera. Este documento identifica 12 problemas específicos clasificados en tres niveles de prioridad (CRITICAL, HIGH, MEDIUM) que deben ser corregidos para mejorar el rendimiento general de la aplicación.

Los problemas principales incluyen:
- Sincronizaciones redundantes con Supabase en cada cambio de autenticación
- Patrón N+1 en consultas de setlists
- Condiciones de carrera en LibraryView
- Falta de caché para datos frecuentemente accedidos
- Consultas ineficientes sin uso de índices
- Peticiones en cascada que bloquean la UI

## Bug Analysis

### Current Behavior (Defect)

#### CRITICAL Issues

1.1 WHEN el estado de autenticación cambia (login, logout, o cualquier auth state change) THEN el sistema ejecuta fetchSongs() que limpia completamente Dexie y descarga TODAS las canciones de Supabase, causando uso masivo de bandwidth innecesario (src/App.tsx líneas 68-85)

#### HIGH Priority Issues

1.2 WHEN se realiza una búsqueda global en la biblia mediante searchGlobal() THEN el sistema hace llamadas secuenciales sin deduplicación y sin caché de resultados, permitiendo que la misma query dispare múltiples API calls (src/services/bible.ts líneas 150-200)

1.3 WHEN hay cambios rápidos de usuario en LibraryView THEN el useEffect sin AbortController permite que db.songs.clear() se ejecute aunque el usuario haya navegado, causando pérdida de datos por race condition (src/pages/LibraryView.tsx líneas 50-70)

1.4 WHEN se carga un setlist con 20 canciones THEN SortableSongItem hace una query individual por cada canción (20 queries separadas a Dexie) en lugar de batch-load (src/pages/SetlistsView.tsx líneas 120-130)

#### MEDIUM Priority Issues

1.5 WHEN se monta SettingsView THEN fetchBackgrounds() se llama cada vez sin caché, siempre re-fetch de Supabase (src/stores/index.ts línea 180)

1.6 WHEN se obtiene la sesión del usuario THEN fetchProfile() se llama dos veces para el mismo user ID: una en getSession() y otra en onAuthStateChange (src/App.tsx líneas 60-65)

1.7 WHEN se cambia de capítulo en BibleView THEN no hay caché de capítulos previamente cargados, cada cambio dispara nueva carga (src/pages/BibleView.tsx líneas 60-70)

1.8 WHEN ocurren errores en LibraryView, BibleView o SettingsView THEN remoteError nunca se limpia en LibraryView, no hay error state para failed chapter loads en BibleView, y no hay error handling para background fetch en SettingsView

1.9 WHEN se sincroniza asistencia en NotesView THEN el sync es secuencial (local → remote) y el usuario no sabe si Supabase sync falló hasta después (src/pages/NotesView.tsx líneas 100-150)

1.10 WHEN se implementa lógica de fetch en múltiples componentes THEN hay código duplicado: fetchChapter() y searchGlobal() tienen lógica similar local-then-remote, múltiples componentes tienen patrón "sync local → sync remote", y useLiveQuery() calls sin abstracción

1.11 WHEN se llama fetchSongs() múltiples veces THEN usa paginación pero sin caché, cada llamada fetch todas las canciones incluso si se llama múltiples veces (src/services/supabase.ts líneas 40-60)

1.12 WHEN cambian los filtros en LibraryView THEN songs query hace full table scan en cada cambio de filtro, aplicando filtros en memoria en lugar de usar índices Dexie (src/pages/LibraryView.tsx líneas 80-120)

### Expected Behavior (Correct)

#### CRITICAL Fixes

2.1 WHEN el estado de autenticación cambia THEN el sistema SHALL sincronizar con Supabase solo cuando sea necesario (no en cada auth change), implementando sincronización incremental en lugar de limpiar y recargar todo

#### HIGH Priority Fixes

2.2 WHEN se realiza una búsqueda global en la biblia THEN el sistema SHALL implementar request deduplication y caché de resultados para evitar llamadas duplicadas a la API

2.3 WHEN hay cambios de usuario en LibraryView THEN el sistema SHALL usar AbortController para cancelar operaciones pendientes y prevenir race conditions que causan pérdida de datos

2.4 WHEN se carga un setlist con múltiples canciones THEN el sistema SHALL hacer batch loading de todas las canciones de una vez usando db.songs.bulkGet() en lugar de queries individuales

#### MEDIUM Priority Fixes

2.5 WHEN se monta SettingsView THEN el sistema SHALL implementar caché para backgrounds, evitando re-fetch innecesarios de Supabase

2.6 WHEN se obtiene la sesión del usuario THEN el sistema SHALL llamar fetchProfile() una sola vez, eliminando la llamada duplicada

2.7 WHEN se navega entre capítulos en BibleView THEN el sistema SHALL implementar caché de capítulos previamente cargados para evitar recargas innecesarias

2.8 WHEN ocurren errores en componentes THEN el sistema SHALL implementar manejo consistente de estados de loading y error: limpiar remoteError en LibraryView, agregar error state para chapter loads en BibleView, y agregar error handling para background fetch en SettingsView

2.9 WHEN se sincroniza asistencia en NotesView THEN el sistema SHALL proporcionar feedback inmediato al usuario sobre el estado del sync con Supabase

2.10 WHEN se implementa lógica de fetch THEN el sistema SHALL abstraer patrones comunes (local-then-remote, sync local → remote) en funciones reutilizables para eliminar código duplicado

2.11 WHEN se llama fetchSongs() THEN el sistema SHALL implementar caché para evitar fetch repetidos de las mismas canciones

2.12 WHEN cambian los filtros en LibraryView THEN el sistema SHALL usar índices Dexie para queries eficientes en lugar de aplicar filtros en memoria con full table scan

### Unchanged Behavior (Regression Prevention)

3.1 WHEN un usuario autenticado tiene canciones sincronizadas THEN el sistema SHALL CONTINUE TO mantener la integridad de los datos locales y remotos

3.2 WHEN se proyectan canciones, versículos bíblicos o avisos THEN el sistema SHALL CONTINUE TO funcionar correctamente sin degradación de rendimiento

3.3 WHEN se crean, editan o eliminan setlists THEN el sistema SHALL CONTINUE TO persistir los cambios correctamente tanto local como remotamente

3.4 WHEN se registra asistencia en NotesView THEN el sistema SHALL CONTINUE TO guardar los datos localmente y sincronizar con Supabase cuando esté disponible

3.5 WHEN se buscan canciones en la biblioteca THEN el sistema SHALL CONTINUE TO mostrar resultados precisos y completos

3.6 WHEN se navega entre diferentes vistas de la aplicación THEN el sistema SHALL CONTINUE TO mantener el estado de la aplicación correctamente

3.7 WHEN se usan backgrounds y temas personalizados THEN el sistema SHALL CONTINUE TO aplicar los estilos correctamente en la proyección

3.8 WHEN usuarios free y premium usan la aplicación THEN el sistema SHALL CONTINUE TO respetar las restricciones de plan correctamente

3.9 WHEN se importan/exportan canciones THEN el sistema SHALL CONTINUE TO mantener la compatibilidad del formato de datos

3.10 WHEN se usa el modo guest THEN el sistema SHALL CONTINUE TO funcionar correctamente con datos locales

3.11 WHEN se realizan búsquedas online de canciones THEN el sistema SHALL CONTINUE TO integrar correctamente con Genius API

3.12 WHEN se proyectan capítulos completos de la biblia THEN el sistema SHALL CONTINUE TO formatear y mostrar correctamente todos los versículos
