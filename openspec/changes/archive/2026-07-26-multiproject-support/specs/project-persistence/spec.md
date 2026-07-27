# Spec: project-persistence

Modelo de persistencia local para múltiples proyectos: almacén IndexedDB, doble escritura en localStorage, migración y ciclo de guardado.

## ADDED Requirements

### Requirement: Almacén de proyectos en IndexedDB

El sistema SHALL persistir los proyectos en una base IndexedDB `projects-db` con store `projects-store` (vía `idb-keyval`), con dos tipos de registros: un índice bajo la clave `__index__` con la lista ligera `[{ id, title, updatedAt }]`, y un registro por proyecto bajo la clave `proj_<id>` con `{ id, title, createdAt, updatedAt, elements, appState }`. Los elementos guardados MUST excluir los marcados como borrados y el appState MUST pasar por `clearAppStateForLocalStorage` antes de persistirse.

#### Scenario: Guardar un proyecto

- **WHEN** se persiste un proyecto
- **THEN** su registro `proj_<id>` contiene todos los campos requeridos, sin elementos borrados, y el índice `__index__` refleja su `title` y `updatedAt` actualizados

#### Scenario: Índice consistente tras eliminar

- **WHEN** se elimina un proyecto
- **THEN** su clave `proj_<id>` desaparece del store y su entrada se quita de `__index__` en la misma operación

### Requirement: Doble escritura del proyecto activo en localStorage

El sistema SHALL seguir escribiendo el proyecto activo en las claves tradicionales de `localStorage` (`excalidraw`, `excalidraw-state`) además de en su registro IDB, de modo que `initializeScene()` y la sincronización entre pestañas (`tabSync`) sigan funcionando sin cambios para el proyecto activo.

#### Scenario: Guardado periódico del proyecto activo

- **WHEN** se produce un guardado automático (debounce) del proyecto activo
- **THEN** se escriben tanto las claves de `localStorage` como el registro `proj_<id>` y el índice en IDB

#### Scenario: Arranque de la aplicación

- **WHEN** la aplicación arranca
- **THEN** `initializeScene()` restaura el último proyecto activo desde `localStorage` sin necesidad de leer IDB

### Requirement: Puntero de proyecto activo

El sistema SHALL mantener el identificador del proyecto activo en la clave `excalidraw-active-project` de `localStorage`, actualizándola en cada cambio de proyecto.

#### Scenario: Actualizar puntero al cambiar

- **WHEN** se completa un cambio de proyecto
- **THEN** `excalidraw-active-project` contiene el id del nuevo proyecto activo

### Requirement: Migración de la escena preexistente

El sistema SHALL convertir automáticamente la escena local existente (elementos y appState en `localStorage`) en el primer proyecto del usuario la primera vez que la funcionalidad se inicializa, sin diálogos ni pérdida de datos.

#### Scenario: Primera ejecución con escena existente

- **WHEN** la funcionalidad se inicializa y ya existe contenido en `localStorage` pero ningún proyecto en IDB
- **THEN** se crea un proyecto con esos elementos y appState, se registra en `__index__` y queda marcado como activo

#### Scenario: Primera ejecución sin escena existente

- **WHEN** la funcionalidad se inicializa sin contenido previo en `localStorage` ni proyectos en IDB
- **THEN** se crea un proyecto vacío por defecto y queda marcado como activo

### Requirement: Volcado síncrono antes de operaciones críticas

El sistema SHALL forzar el volcado inmediato del proyecto activo a IDB (sin debounce) antes de cambiar de proyecto, al ocultarse la pestaña y al descargarse la página, reutilizando el mecanismo `flushSave` existente.

#### Scenario: Cambiar de proyecto con cambios sin guardar

- **WHEN** el usuario cambia de proyecto con ediciones aún dentro de la ventana de debounce
- **THEN** esas ediciones se escriben primero en el registro IDB del proyecto saliente, y ninguna edición se pierde ni contamina el proyecto destino

### Requirement: Almacén de imágenes compartido entre proyectos

El sistema SHALL mantener las imágenes en el store `files-db` existente, compartido entre proyectos (direccionado por `fileId`), y la limpieza de archivos obsoletos (`clearObsoleteFiles`) MUST considerar la unión de los `fileId` referenciados por todos los proyectos, no solo el activo.

#### Scenario: Cambiar a proyecto con imágenes

- **WHEN** se cambia a un proyecto cuyos elementos referencian imágenes
- **THEN** esas imágenes se cargan desde `files-db` vía `addFiles()` sin duplicar binarios en IDB

#### Scenario: Limpieza de archivos obsoletos

- **WHEN** se ejecuta `clearObsoleteFiles`
- **THEN** no se elimina ninguna imagen referenciada por algún proyecto existente, aunque el proyecto activo no la use
