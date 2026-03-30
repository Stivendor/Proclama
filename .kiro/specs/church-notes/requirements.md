# Requirements Document

## Introduction

La sección "Notas" es una nueva vista en el sidebar de Proclama que permite al operador del culto registrar dos tipos de información por sesión: la asistencia numérica del culto y avisos/anuncios de texto libre. Estos datos se almacenan localmente (Dexie/IndexedDB) y, cuando el usuario está autenticado, se sincronizan con Supabase. La vista se integra en el sistema de navegación existente (`activeView`) sin modificar la arquitectura actual.

---

## Glossary

- **Notes_View**: La vista React en `src/pages/NotesView.tsx` que renderiza la sección "Notas".
- **Notes_Store**: El store Zustand o slice de `useAppStore` que gestiona el estado de notas en memoria.
- **Notes_DB**: La tabla `church_notes` en Dexie (IndexedDB) que persiste las notas localmente.
- **Attendance_Record**: Entrada de datos que representa el número de asistentes a un culto en una fecha concreta.
- **Notice**: Entrada de texto libre que representa un aviso o anuncio para el culto.
- **Church_Note**: Entidad que agrupa una fecha, un `Attendance_Record` opcional y una lista de `Notice` items.
- **Sidebar**: El componente `src/components/Sidebar.tsx` que contiene la navegación principal de la app.
- **Notes_Service**: Módulo de servicio que abstrae las operaciones CRUD sobre `Notes_DB` y Supabase.

---

## Requirements

### Requirement 1: Navegación a la sección Notas

**User Story:** Como operador del culto, quiero acceder a la sección "Notas" desde el sidebar, para poder registrar información del culto sin salir de la aplicación.

#### Acceptance Criteria

1. THE `Sidebar` SHALL incluir un ítem de navegación "Notas" con el icono `NotebookPen` de lucide-react, posicionado entre "Contador" y "Ajustes".
2. WHEN el usuario hace clic en el ítem "Notas" del `Sidebar`, THE `Notes_View` SHALL renderizarse en el área de contenido principal.
3. THE `Sidebar` SHALL marcar el ítem "Notas" como activo cuando `activeView === 'notes'`.
4. THE `useAppStore` SHALL incluir `'notes'` como valor válido del tipo `activeView`.

---

### Requirement 2: Registro de asistencia del culto

**User Story:** Como operador del culto, quiero registrar el número de personas que asistieron, para llevar un historial de asistencia por fecha.

#### Acceptance Criteria

1. THE `Notes_View` SHALL mostrar un campo numérico para ingresar la asistencia del culto asociada a la fecha actual.
2. WHEN el usuario introduce un valor en el campo de asistencia, THE `Notes_View` SHALL aceptar únicamente enteros positivos mayores que cero.
3. IF el usuario introduce un valor no numérico o menor que 1 en el campo de asistencia, THEN THE `Notes_View` SHALL mostrar un mensaje de error descriptivo sin guardar el dato.
4. WHEN el usuario confirma el valor de asistencia, THE `Notes_Store` SHALL actualizar el `Attendance_Record` de la `Church_Note` correspondiente a la fecha actual.
5. WHEN el `Attendance_Record` es guardado, THE `Notes_DB` SHALL persistir el registro en la tabla `church_notes` de IndexedDB.
6. WHEN el usuario navega de vuelta a la sección "Notas" en la misma sesión, THE `Notes_View` SHALL mostrar el último valor de asistencia guardado para la fecha actual.

---

### Requirement 3: Gestión de avisos de texto

**User Story:** Como operador del culto, quiero añadir, editar y eliminar avisos de texto, para comunicar anuncios importantes durante el culto.

#### Acceptance Criteria

1. THE `Notes_View` SHALL mostrar una lista de `Notice` items asociados a la `Church_Note` de la fecha actual.
2. THE `Notes_View` SHALL incluir un botón "Añadir aviso" que muestre un campo de texto para ingresar un nuevo `Notice`.
3. WHEN el usuario introduce texto en el campo de aviso y confirma, THE `Notes_Store` SHALL añadir el `Notice` a la lista de la `Church_Note` actual.
4. IF el usuario intenta guardar un `Notice` con texto vacío o que contenga únicamente espacios en blanco, THEN THE `Notes_View` SHALL mostrar un mensaje de error y no añadir el aviso.
5. WHEN un `Notice` es añadido, THE `Notes_DB` SHALL persistir la `Church_Note` actualizada en IndexedDB.
6. WHEN el usuario hace clic en el botón de eliminar de un `Notice`, THE `Notes_View` SHALL solicitar confirmación antes de eliminar.
7. WHEN el usuario confirma la eliminación de un `Notice`, THE `Notes_Store` SHALL remover el `Notice` de la lista y THE `Notes_DB` SHALL persistir el cambio.
8. WHEN el usuario hace clic en el botón de editar de un `Notice`, THE `Notes_View` SHALL mostrar el texto del aviso en un campo editable con el contenido previo.
9. WHEN el usuario confirma la edición de un `Notice`, THE `Notes_Store` SHALL actualizar el texto del `Notice` y THE `Notes_DB` SHALL persistir el cambio.

---

### Requirement 4: Persistencia local con Dexie

**User Story:** Como operador del culto, quiero que las notas se guarden localmente aunque no tenga conexión a internet, para no perder información durante el culto.

#### Acceptance Criteria

1. THE `Notes_DB` SHALL almacenar las `Church_Note` en una tabla `church_notes` indexada por `id`, `date` y `userId`.
2. WHEN la aplicación carga la sección "Notas", THE `Notes_View` SHALL recuperar la `Church_Note` correspondiente a la fecha actual desde `Notes_DB`.
3. IF no existe una `Church_Note` para la fecha actual en `Notes_DB`, THEN THE `Notes_View` SHALL mostrar la vista vacía sin errores, lista para recibir nuevos datos.
4. THE `Notes_DB` SHALL ser una versión incremental de `ProclamaDB` que no rompa las tablas existentes (`songs`, `setlists`, `settings`).

---

### Requirement 5: Sincronización con Supabase

**User Story:** Como operador autenticado, quiero que las notas se sincronicen con la nube, para acceder al historial desde cualquier dispositivo.

#### Acceptance Criteria

1. WHILE el usuario está autenticado, THE `Notes_Service` SHALL sincronizar las operaciones de creación, actualización y eliminación de `Church_Note` con la tabla `church_notes` de Supabase.
2. WHILE el usuario no está autenticado, THE `Notes_Service` SHALL operar exclusivamente sobre `Notes_DB` local sin intentar conectar a Supabase.
3. IF una operación de sincronización con Supabase falla, THEN THE `Notes_Service` SHALL conservar el dato en `Notes_DB` local y mostrar un indicador de error no bloqueante en `Notes_View`.
4. WHEN el usuario se autentica por primera vez con notas locales existentes, THE `Notes_Service` SHALL intentar migrar las notas locales a Supabase sin duplicar registros.

---

### Requirement 6: Historial de notas por fecha

**User Story:** Como operador del culto, quiero ver notas de cultos anteriores, para consultar el historial de asistencia y avisos pasados.

#### Acceptance Criteria

1. THE `Notes_View` SHALL mostrar un selector de fecha que permita navegar entre `Church_Note` de diferentes días.
2. WHEN el usuario selecciona una fecha diferente a la actual, THE `Notes_View` SHALL cargar la `Church_Note` correspondiente a esa fecha desde `Notes_DB`.
3. IF no existe una `Church_Note` para la fecha seleccionada, THEN THE `Notes_View` SHALL mostrar la vista vacía para esa fecha, permitiendo crear nuevas notas.
4. THE `Notes_View` SHALL indicar visualmente cuál es la fecha actual para distinguirla de fechas históricas.

---

### Requirement 7: Diseño visual consistente

**User Story:** Como operador del culto, quiero que la sección "Notas" tenga el mismo estilo visual que el resto de la app, para una experiencia coherente.

#### Acceptance Criteria

1. THE `Notes_View` SHALL utilizar exclusivamente variables CSS definidas en `src/index.css` (dark theme) sin introducir estilos inline o frameworks CSS externos.
2. THE `Notes_View` SHALL utilizar iconos de `lucide-react` para todas las acciones (añadir, editar, eliminar, confirmar, cancelar).
3. THE `Notes_View` SHALL ser responsive y funcionar correctamente en viewports desde 320px de ancho.
4. THE `Notes_View` SHALL mantener contraste de texto suficiente para ser legible en condiciones de poca luz (entorno típico de culto).
