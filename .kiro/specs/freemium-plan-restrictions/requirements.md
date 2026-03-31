# Requirements Document

## Introduction

Este documento define los requisitos para implementar un modelo freemium en la aplicación Proclama. El sistema diferenciará entre usuarios gratuitos (Free) y usuarios premium (Premium), aplicando restricciones específicas a las funcionalidades disponibles para cada plan. Los usuarios administradores tendrán acceso completo independientemente de su plan.

## Glossary

- **System**: La aplicación Proclama completa
- **User**: Usuario autenticado en la aplicación
- **Free_User**: Usuario con plan gratuito
- **Premium_User**: Usuario con plan premium o administrador
- **Public_Library**: Biblioteca pública de 3026 canciones verificadas
- **Own_Songs**: Canciones creadas por el usuario
- **Genius_Search**: Servicio de búsqueda online de letras
- **Cloud_Sync**: Sincronización de datos con Supabase
- **Media_Backgrounds**: Fondos multimedia (videos e imágenes)
- **Solid_Color_Background**: Fondo de color sólido
- **Song_Limit**: Límite de 10 canciones propias para usuarios gratuitos
- **Plan_Helper**: Funciones auxiliares en usePlan hook

## Requirements

### Requirement 1: Acceso a la Biblioteca Pública

**User Story:** Como usuario gratuito, quiero acceder a la biblioteca pública completa, para poder proyectar canciones verificadas sin restricciones.

#### Acceptance Criteria

1. THE System SHALL permitir a todos los usuarios acceder a las 3026 canciones de la biblioteca pública
2. THE System SHALL mostrar canciones públicas verificadas (isPublic=true, isVerified=true) sin restricciones de plan
3. THE System SHALL permitir a Free_User cargar y proyectar cualquier canción de la biblioteca pública

### Requirement 2: Límite de Canciones Propias para Usuarios Gratuitos

**User Story:** Como usuario gratuito, quiero crear hasta 10 canciones propias, para personalizar mi biblioteca dentro de los límites del plan gratuito.

#### Acceptance Criteria

1. THE System SHALL limitar a Free_User a un máximo de 10 canciones propias
2. WHEN Free_User alcanza el límite de 10 canciones propias, THE System SHALL deshabilitar el botón "Nueva canción"
3. WHEN el botón "Nueva canción" está deshabilitado, THE System SHALL mostrar un tooltip indicando el límite alcanzado
4. THE System SHALL permitir a Premium_User crear canciones propias ilimitadas
5. THE Plan_Helper SHALL exponer la función canCreateSong(ownSongCount) que retorna true si el usuario puede crear más canciones

### Requirement 3: Restricción de Fondos Multimedia para Usuarios Gratuitos

**User Story:** Como usuario gratuito, quiero usar fondos de color sólido en mis proyecciones, mientras que los fondos multimedia están reservados para usuarios premium.

#### Acceptance Criteria

1. THE System SHALL permitir a Free_User usar únicamente Solid_Color_Background en proyecciones
2. THE System SHALL bloquear el acceso a Media_Backgrounds (videos e imágenes) para Free_User
3. WHEN Free_User intenta seleccionar Media_Backgrounds, THE System SHALL mostrar un mensaje de actualización de plan
4. THE System SHALL permitir a Premium_User acceso completo a todos los tipos de fondos multimedia
5. THE System SHALL mantener la funcionalidad de gradientes disponible para todos los usuarios

### Requirement 4: Restricción de Búsqueda Online (Genius)

**User Story:** Como usuario gratuito, quiero saber que la búsqueda online está disponible en el plan premium, para considerar actualizar mi plan cuando necesite esta funcionalidad.

#### Acceptance Criteria

1. THE System SHALL bloquear el acceso a Genius_Search para Free_User
2. WHEN Free_User hace clic en "Buscar online", THE System SHALL mostrar un mensaje indicando que es una función premium
3. THE System SHALL mostrar un icono de candado junto al botón "Buscar online" para Free_User
4. THE System SHALL permitir a Premium_User acceso completo a Genius_Search
5. THE Plan_Helper SHALL exponer la función canUseGenius que retorna true si el usuario puede usar la búsqueda online

### Requirement 5: Restricción de Sincronización en la Nube

**User Story:** Como usuario gratuito, quiero que mis canciones se almacenen localmente, mientras que los usuarios premium pueden sincronizar con la nube.

#### Acceptance Criteria

1. THE System SHALL almacenar Own_Songs de Free_User únicamente en almacenamiento local (Dexie)
2. THE System SHALL prevenir que Own_Songs de Free_User se guarden en Supabase
3. THE System SHALL permitir a Free_User acceder a canciones públicas sincronizadas desde Supabase
4. THE System SHALL permitir a Premium_User sincronizar todas sus canciones y setlists con Cloud_Sync
5. THE Plan_Helper SHALL exponer la función canSync que retorna true si el usuario tiene sincronización habilitada
6. WHEN Free_User crea o edita una canción, THE System SHALL guardarla solo en Dexie sin intentar sincronizar con Supabase

### Requirement 6: Helpers del Hook usePlan

**User Story:** Como desarrollador, quiero usar funciones auxiliares claras en el hook usePlan, para verificar permisos de manera consistente en toda la aplicación.

#### Acceptance Criteria

1. THE Plan_Helper SHALL exponer isPremium que retorna true para usuarios premium o administradores
2. THE Plan_Helper SHALL exponer plan que retorna 'free' o 'premium'
3. THE Plan_Helper SHALL exponer canCreateSong(ownSongCount: number) que verifica si el usuario puede crear más canciones
4. THE Plan_Helper SHALL exponer canUseGenius que verifica si el usuario puede usar búsqueda online
5. THE Plan_Helper SHALL exponer canSync que verifica si el usuario tiene sincronización en la nube
6. THE Plan_Helper SHALL considerar a los administradores como premium independientemente de su plan asignado

### Requirement 7: Indicadores Visuales de Restricciones

**User Story:** Como usuario gratuito, quiero ver claramente qué funciones están bloqueadas, para entender los beneficios del plan premium.

#### Acceptance Criteria

1. WHEN una función está bloqueada para Free_User, THE System SHALL mostrar un icono de candado (Lock)
2. WHEN Free_User pasa el cursor sobre una función bloqueada, THE System SHALL mostrar un tooltip explicativo
3. THE System SHALL deshabilitar visualmente los botones de funciones bloqueadas
4. THE System SHALL mantener los botones bloqueados accesibles para lectores de pantalla con aria-label descriptivo
5. WHEN Free_User intenta usar una función premium, THE System SHALL mostrar un mensaje claro indicando la restricción

### Requirement 8: Transición del Flag Global PREMIUM_FOR_EVERYONE

**User Story:** Como administrador del sistema, quiero poder activar o desactivar el modelo freemium mediante un flag global, para controlar el despliegue de las restricciones.

#### Acceptance Criteria

1. THE System SHALL mantener el flag PREMIUM_FOR_EVERYONE en el hook usePlan
2. WHEN PREMIUM_FOR_EVERYONE es true, THE System SHALL otorgar acceso premium a todos los usuarios
3. WHEN PREMIUM_FOR_EVERYONE es false, THE System SHALL aplicar las restricciones según el plan del usuario
4. THE System SHALL verificar el plan del usuario desde userPlan en el store
5. THE System SHALL considerar userRole === 'admin' como premium independientemente del flag
