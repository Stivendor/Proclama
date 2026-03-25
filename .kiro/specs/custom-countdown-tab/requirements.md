# Requirements Document

## Introduction

Nueva pestaña en la aplicación Proclama que permite al usuario configurar y proyectar un contador regresivo (countdown) personalizado. El usuario puede definir el título, el tiempo, los colores, la fuente y el fondo del contador. La pantalla de proyección muestra el título y el tiempo restante en tiempo real, con las mismas capacidades de personalización visual que el resto del sistema de proyección.

## Glossary

- **Countdown_Tab**: Pestaña de la aplicación principal dedicada a la configuración y control del contador regresivo.
- **Countdown_Timer**: El componente que gestiona el estado del contador (tiempo restante, en curso, pausado, finalizado).
- **Countdown_Config**: Conjunto de parámetros configurables del contador: título, duración, tema visual.
- **Countdown_Theme**: Subconjunto del tema visual aplicable al contador: fondo, color de texto, fuente, imagen de fondo.
- **Projection_Window**: Ventana secundaria del navegador que muestra el contenido proyectado al público.
- **Control_Panel**: Panel lateral derecho de la aplicación principal desde donde el operador controla la proyección.
- **BroadcastChannel**: Canal de comunicación entre la ventana principal y la Projection_Window.

---

## Requirements

### Requirement 1: Pestaña de Countdown en la navegación principal

**User Story:** Como operador de presentación, quiero una pestaña dedicada al countdown en la barra lateral, para acceder rápidamente a la configuración y control del contador.

#### Acceptance Criteria

1. THE Sidebar SHALL incluir una entrada de navegación para la Countdown_Tab.
2. WHEN el usuario selecciona la entrada de Countdown en el Sidebar, THE App SHALL mostrar la Countdown_Tab como vista activa.
3. THE Countdown_Tab SHALL ser accesible desde el mismo sistema de navegación que LibraryView, BibleView y SetlistsView.

---

### Requirement 2: Configuración del contador

**User Story:** Como operador de presentación, quiero configurar el título y la duración del contador, para que el público vea información relevante durante la espera.

#### Acceptance Criteria

1. THE Countdown_Tab SHALL mostrar un campo de texto para que el usuario ingrese el título del contador.
2. THE Countdown_Tab SHALL mostrar controles para que el usuario defina la duración del contador en minutos y segundos.
3. WHEN el usuario modifica el título o la duración, THE Countdown_Config SHALL actualizarse de forma inmediata en la interfaz.
4. THE Countdown_Tab SHALL persistir la Countdown_Config en el store local de la aplicación entre sesiones.

---

### Requirement 3: Control de reproducción del contador

**User Story:** Como operador de presentación, quiero iniciar, pausar y reiniciar el contador desde la pestaña de control, para gestionar el tiempo durante el evento.

#### Acceptance Criteria

1. THE Countdown_Tab SHALL mostrar un botón para iniciar el Countdown_Timer.
2. WHEN el Countdown_Timer está en curso, THE Countdown_Tab SHALL mostrar un botón para pausar el Countdown_Timer.
3. WHEN el Countdown_Timer está pausado, THE Countdown_Tab SHALL mostrar un botón para reanudar el Countdown_Timer.
4. THE Countdown_Tab SHALL mostrar un botón para reiniciar el Countdown_Timer al valor de duración configurado.
5. WHEN el Countdown_Timer llega a cero, THE Countdown_Timer SHALL detenerse y mostrar "00:00" en la Projection_Window.
6. WHEN el Countdown_Timer está en curso, THE Countdown_Timer SHALL decrementar el tiempo restante en intervalos de un segundo.

---

### Requirement 4: Proyección del countdown

**User Story:** Como operador de presentación, quiero proyectar el countdown en la pantalla del público, para que los asistentes vean el tiempo restante.

#### Acceptance Criteria

1. WHEN el usuario activa la proyección del countdown, THE Projection_Window SHALL mostrar el título del contador y el tiempo restante.
2. THE Projection_Window SHALL mostrar el título del contador en la parte superior y el tiempo restante debajo.
3. WHEN el Countdown_Timer está en curso, THE Projection_Window SHALL actualizar el tiempo restante cada segundo.
4. WHEN el Countdown_Timer llega a cero, THE Projection_Window SHALL mostrar "00:00" y mantener el título visible.
5. THE Countdown_Tab SHALL enviar el estado del Countdown_Timer a la Projection_Window mediante el BroadcastChannel.
6. WHEN el usuario desactiva la proyección del countdown, THE Projection_Window SHALL dejar de mostrar el countdown y volver al estado de espera.

---

### Requirement 5: Personalización del tema visual del countdown

**User Story:** Como operador de presentación, quiero personalizar los colores, la fuente y el fondo del countdown, para que sea coherente con la identidad visual del evento.

#### Acceptance Criteria

1. THE Countdown_Tab SHALL mostrar controles para que el usuario seleccione el color del texto del countdown.
2. THE Countdown_Tab SHALL mostrar controles para que el usuario seleccione la fuente del texto del countdown.
3. THE Countdown_Tab SHALL mostrar controles para que el usuario configure el fondo del countdown con un color sólido.
4. WHERE el usuario sube una imagen de fondo, THE Countdown_Theme SHALL usar dicha imagen como fondo en la Projection_Window.
5. IF el usuario no sube una imagen de fondo, THEN THE Countdown_Theme SHALL usar el color de fondo configurado.
6. WHEN el usuario modifica cualquier propiedad del Countdown_Theme, THE Projection_Window SHALL reflejar el cambio de forma inmediata si el countdown está siendo proyectado.
7. THE Countdown_Tab SHALL reutilizar el sistema de assets de fondo existente (BackgroundAsset) para la selección de imágenes.

---

### Requirement 6: Integración con el sistema de proyección existente

**User Story:** Como operador de presentación, quiero que el countdown use el mismo canal de proyección que el resto de la app, para no tener que gestionar ventanas adicionales.

#### Acceptance Criteria

1. THE Countdown_Timer SHALL comunicarse con la Projection_Window mediante el BroadcastChannel existente.
2. THE App SHALL extender el tipo BroadcastMessage para incluir mensajes de tipo COUNTDOWN_UPDATE con el payload del estado del countdown.
3. THE Projection_Window SHALL manejar mensajes de tipo COUNTDOWN_UPDATE y renderizar la vista del countdown.
4. WHEN el countdown está activo en la Projection_Window, THE Projection_Window SHALL ignorar los mensajes de tipo PROJECTION_UPDATE para slides.
5. THE Countdown_Tab SHALL respetar el estado de pantalla negra (isBlack) del sistema de proyección existente.
