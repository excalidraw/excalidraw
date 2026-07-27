# Spec: project-boards

Gestión de pizarras (proyectos) locales desde la interfaz de la aplicación web.

## ADDED Requirements

### Requirement: Listado de proyectos en el sidebar

El sistema SHALL mostrar un sidebar "projects" con la lista de proyectos locales ordenada por `updatedAt` descendente, mostrando título y fecha de última modificación de cada uno, e indicando visualmente cuál es el proyecto activo.

#### Scenario: Abrir el sidebar con proyectos existentes

- **WHEN** el usuario abre el sidebar "projects" existiendo proyectos guardados
- **THEN** se muestra la lista completa ordenada por `updatedAt` descendente, con el proyecto activo resaltado

#### Scenario: Abrir el sidebar sin proyectos

- **WHEN** el usuario abre el sidebar "projects" y no existe ningún proyecto guardado
- **THEN** se muestra un estado vacío con una acción para crear el primer proyecto

### Requirement: Acceso desde el menú principal

El sistema SHALL incluir un ítem "Mis pizarras" en el menú principal (`AppMainMenu`) que abra el sidebar "projects".

#### Scenario: Abrir proyectos desde el menú

- **WHEN** el usuario selecciona el ítem "Mis pizarras" del menú principal
- **THEN** el sidebar "projects" se abre (o se cierra si ya estaba abierto, siguiendo el comportamiento toggle nativo de `Sidebar`)

### Requirement: Crear proyecto

El sistema SHALL permitir crear un proyecto nuevo y vacío, que pase a ser el proyecto activo inmediatamente. El estado del proyecto anterior MUST persistirse antes del cambio.

#### Scenario: Crear proyecto nuevo

- **WHEN** el usuario activa la acción "Nueva pizarra"
- **THEN** el proyecto activo actual se guarda en IDB, se crea un registro nuevo con título por defecto (p. ej. "Sin título"), el canvas queda vacío y el nuevo proyecto queda marcado como activo

### Requirement: Cambiar de proyecto en caliente

El sistema SHALL cambiar al proyecto seleccionado sin recargar la página: volcando primero los cambios pendientes del proyecto actual, y restaurando después elementos, appState e imágenes del proyecto destino.

#### Scenario: Cambio exitoso de proyecto

- **WHEN** el usuario selecciona otro proyecto de la lista
- **THEN** los cambios pendientes del proyecto actual se guardan (flush), el puntero de proyecto activo se actualiza, y la escena del proyecto destino se restaura en el editor vía `updateScene()` con `CaptureUpdateAction.IMMEDIATELY`, incluyendo sus imágenes vía `addFiles()`

#### Scenario: Cambiar de proyecto durante una colaboración activa

- **WHEN** el usuario intenta cambiar de proyecto mientras está en una sala de colaboración
- **THEN** el sistema detiene la colaboración (`stopCollaboration()`) antes de aplicar el cambio de proyecto

#### Scenario: Cambiar al proyecto ya activo

- **WHEN** el usuario selecciona el proyecto que ya está activo
- **THEN** no se realiza ninguna escritura ni actualización de escena

### Requirement: Renombrar proyecto

El sistema SHALL permitir renombrar un proyecto. El título del proyecto activo MUST sincronizarse con `appState.name` para que las exportaciones de archivo usen el nuevo nombre.

#### Scenario: Renombrar el proyecto activo

- **WHEN** el usuario edita el título del proyecto activo
- **THEN** se actualiza el registro en IDB, el índice `__index__`, y `appState.name` del editor

#### Scenario: Renombrar un proyecto inactivo

- **WHEN** el usuario edita el título de un proyecto que no está activo
- **THEN** se actualiza su registro en IDB y el índice, sin tocar la escena en pantalla

### Requirement: Eliminar proyecto

El sistema SHALL permitir eliminar un proyecto tras confirmación explícita del usuario. El borrado MUST ser irreversible desde la UI.

#### Scenario: Eliminar un proyecto inactivo

- **WHEN** el usuario confirma la eliminación de un proyecto que no está activo
- **THEN** se elimina su registro de IDB y su entrada del índice; la escena en pantalla no cambia

#### Scenario: Eliminar el proyecto activo

- **WHEN** el usuario confirma la eliminación del proyecto activo
- **THEN** se elimina el registro, y el sistema activa el proyecto más reciente restante; si no queda ninguno, crea y activa un proyecto nuevo vacío
