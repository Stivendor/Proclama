# Requirements Document

## Introduction

La sección de Términos y Condiciones es una feature transversal de Proclama que cubre dos necesidades: (1) mostrar los términos legales de uso de la aplicación a los usuarios nuevos durante el onboarding y al registrarse, y (2) ofrecer una vista accesible desde la app para consultar los términos en cualquier momento. El usuario debe aceptar explícitamente los términos antes de poder usar la aplicación. La aceptación se registra localmente y, cuando el usuario está autenticado, se sincroniza con Supabase.

---

## Glossary

- **Terms_View**: Vista React en `src/pages/TermsView.tsx` que renderiza el contenido completo de los Términos y Condiciones.
- **Terms_Modal**: Componente modal en `src/components/TermsModal.tsx` que muestra los términos durante el flujo de registro o onboarding.
- **Terms_Acceptance**: Registro que indica que un usuario (o invitado) ha aceptado los términos, incluyendo la versión aceptada y la fecha.
- **Terms_Version**: Identificador de versión del documento de términos (ej. `"1.0"`). Permite detectar si el usuario debe aceptar una versión más nueva.
- **App_Store**: El store global `useAppStore` de Zustand que gestiona el estado de la aplicación.
- **LandingView**: La vista de entrada `src/pages/LandingView.tsx` que se muestra a usuarios no autenticados y sin modo invitado.
- **OnboardingFlow**: El componente `src/components/OnboardingFlow.tsx` que guía al usuario nuevo en su primera sesión.
- **Sidebar**: El componente `src/components/Sidebar.tsx` que contiene la navegación principal de la app.
- **Settings_View**: La vista `src/pages/SettingsView.tsx` donde el usuario puede acceder a ajustes y cuenta.

---

## Requirements

### Requirement 1: Aceptación de términos en el registro

**User Story:** Como nuevo usuario, quiero ver los Términos y Condiciones antes de crear mi cuenta, para saber a qué me comprometo al usar Proclama.

#### Acceptance Criteria

1. WHEN el usuario hace clic en "Crear Cuenta" en `Settings_View`, THE `Terms_Modal` SHALL mostrarse antes de procesar el registro.
2. THE `Terms_Modal` SHALL incluir el contenido completo de los términos en un área con scroll, un checkbox de aceptación y un botón "Aceptar y continuar".
3. WHILE el checkbox de aceptación no está marcado, THE `Terms_Modal` SHALL mantener el botón "Aceptar y continuar" deshabilitado.
4. WHEN el usuario marca el checkbox y hace clic en "Aceptar y continuar", THE `App_Store` SHALL registrar la `Terms_Acceptance` con la `Terms_Version` actual y la fecha de aceptación.
5. WHEN la `Terms_Acceptance` es registrada, THE `App_Store` SHALL persistir el registro en `localStorage` para que sobreviva recargas de página.
6. IF el usuario cierra el `Terms_Modal` sin aceptar, THEN THE `Terms_Modal` SHALL cerrarse sin iniciar el proceso de registro.

---

### Requirement 2: Aceptación de términos en modo invitado

**User Story:** Como usuario que accede sin cuenta, quiero ver los Términos y Condiciones antes de entrar en modo invitado, para conocer las condiciones de uso.

#### Acceptance Criteria

1. WHEN el usuario hace clic en "Continuar sin cuenta" (modo invitado) en `LandingView`, THE `Terms_Modal` SHALL mostrarse antes de activar el modo invitado.
2. WHILE el checkbox de aceptación no está marcado, THE `Terms_Modal` SHALL mantener el botón "Aceptar y continuar" deshabilitado.
3. WHEN el usuario acepta los términos en modo invitado, THE `App_Store` SHALL registrar la `Terms_Acceptance` con la `Terms_Version` actual y la fecha de aceptación en `localStorage`.
4. IF el usuario cierra el `Terms_Modal` sin aceptar en modo invitado, THEN THE `LandingView` SHALL permanecer visible sin activar el modo invitado.

---

### Requirement 3: Visualización completa de los términos

**User Story:** Como usuario de la app, quiero poder leer los Términos y Condiciones completos en cualquier momento, para consultarlos cuando lo necesite.

#### Acceptance Criteria

1. THE `Settings_View` SHALL incluir un enlace o botón "Términos y Condiciones" que abra la `Terms_View` o el `Terms_Modal` en modo solo lectura.
2. THE `Terms_View` SHALL mostrar el contenido completo de los términos con formato legible: encabezados, párrafos y listas.
3. THE `Terms_View` SHALL mostrar la `Terms_Version` vigente y la fecha de última actualización del documento.
4. WHEN el usuario accede a `Terms_View` desde `Settings_View`, THE `Terms_View` SHALL mostrar también la fecha en que el usuario aceptó los términos, si existe una `Terms_Acceptance` registrada.
5. THE `Terms_View` SHALL incluir un botón o enlace para volver a `Settings_View` sin perder el estado de navegación.

---

### Requirement 4: Detección de versión actualizada de términos

**User Story:** Como usuario registrado, quiero ser notificado cuando los Términos y Condiciones cambien, para decidir si acepto las nuevas condiciones.

#### Acceptance Criteria

1. WHEN la aplicación carga y el usuario tiene una `Terms_Acceptance` registrada, THE `App_Store` SHALL comparar la `Terms_Version` aceptada con la `Terms_Version` vigente en el código.
2. IF la `Terms_Version` aceptada es diferente a la `Terms_Version` vigente, THEN THE `Terms_Modal` SHALL mostrarse automáticamente al usuario con el nuevo contenido antes de permitir el acceso a la app.
3. WHILE el usuario no acepta la nueva versión de los términos, THE `App_Store` SHALL bloquear el acceso a las vistas principales de la aplicación.
4. WHEN el usuario acepta la nueva versión, THE `App_Store` SHALL actualizar la `Terms_Acceptance` con la nueva `Terms_Version` y la fecha actual.

---

### Requirement 5: Sincronización de aceptación con Supabase

**User Story:** Como usuario autenticado, quiero que mi aceptación de los términos quede registrada en la nube, para que no se me vuelva a pedir en otros dispositivos.

#### Acceptance Criteria

1. WHEN el usuario autenticado acepta los términos, THE `App_Store` SHALL enviar la `Terms_Acceptance` (versión, fecha, `user_id`) a la tabla `profiles` o a una tabla dedicada en Supabase.
2. WHEN el usuario autenticado inicia sesión en un dispositivo nuevo, THE `App_Store` SHALL recuperar la `Terms_Acceptance` desde Supabase y almacenarla en `localStorage`.
3. IF la `Terms_Acceptance` remota tiene una `Terms_Version` igual a la vigente, THEN THE `Terms_Modal` SHALL no mostrarse al usuario en ese dispositivo.
4. IF la sincronización con Supabase falla al registrar la aceptación, THEN THE `App_Store` SHALL conservar la `Terms_Acceptance` en `localStorage` y reintentar la sincronización en la próxima sesión.

---

### Requirement 6: Diseño visual consistente

**User Story:** Como usuario de Proclama, quiero que la sección de Términos y Condiciones tenga el mismo estilo visual que el resto de la app, para una experiencia coherente.

#### Acceptance Criteria

1. THE `Terms_Modal` y THE `Terms_View` SHALL utilizar exclusivamente variables CSS definidas en `src/index.css` (dark theme) sin introducir estilos inline o frameworks CSS externos.
2. THE `Terms_Modal` SHALL ser accesible: incluir `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apuntando al título del modal, y gestión de foco al abrirse y cerrarse.
3. THE `Terms_View` SHALL ser responsive y funcionar correctamente en viewports desde 320px de ancho.
4. THE `Terms_Modal` SHALL incluir un botón de cierre visible con `aria-label="Cerrar términos"` que permita cerrar el modal sin aceptar (excepto cuando los términos son obligatorios por versión nueva, ver Requirement 4).
5. THE `Terms_View` SHALL utilizar iconos de `lucide-react` para las acciones de navegación.
