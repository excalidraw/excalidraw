# Proposal: multiproject-support

## Why

Excalidraw opera hoy bajo un modelo de "pizarra única global": la escena activa sobrescribe siempre las mismas claves de `localStorage` (`excalidraw`, `excalidraw-state`). Un usuario que quiera trabajar en varios diagramas debe exportar e importar manualmente archivos `.excalidraw` una y otra vez, con riesgo de perder trabajo. La gestión de múltiples pizarras locales es la funcionalidad más natural que la aplicación web aún no ofrece de forma nativa.

## What Changes

- Nuevo almacén de proyectos en IndexedDB (`projects-db`/`projects-store` vía `idb-keyval`) con un índice ligero (`__index__`) y un registro completo por proyecto (`proj_<id>`).
- Estrategia de doble escritura (MVP): el proyecto activo se sigue volcando a las claves tradicionales de `localStorage`, preservando intactos el arranque (`initializeScene`) y la sincronización entre pestañas (`tabSync`).
- Migración automática: la escena local existente del usuario se convierte en su primer proyecto, sin pérdida de datos ni diálogos.
- Cambio de proyecto en caliente (sin recargar la página) mediante `excalidrawAPI.updateScene()` con `CaptureUpdateAction.IMMEDIATELY`, más carga de imágenes asociadas vía `addFiles()`.
- Operaciones de gestión: crear, renombrar, cambiar y eliminar pizarras. El título del proyecto se sincroniza con `appState.name` (ya usado para nombrar exportaciones).
- Nueva UI: `<ProjectsSidebar>` registrado con la API nativa `<Sidebar name="projects">` y un ítem "Mis pizarras" en el menú principal.
- Protección de casos borde: detener la colaboración activa antes de cambiar de proyecto y ajustar la limpieza de archivos huérfanos (`clearObsoleteFiles`) para considerar la unión de todos los proyectos.
- Todo el código vive en `excalidraw-app/`. La librería publicada `@excalidraw/excalidraw` permanece intacta.

## Capabilities

### New Capabilities

- `project-boards`: Gestión de pizarras desde la interfaz — listar, crear, renombrar, cambiar y eliminar proyectos locales mediante el sidebar y el menú principal, con cambio en caliente sin recarga de página.
- `project-persistence`: Modelo de persistencia local de proyectos — estructura del almacén IndexedDB, índice de metadatos, doble escritura en `localStorage` para el proyecto activo, migración de la escena preexistente y ciclo de guardado/volcado al cambiar de proyecto.

### Modified Capabilities

<!-- No hay specs existentes en openspec/specs/; todas las capacidades son nuevas. -->

## Impact

- **Código afectado** (todo dentro de `excalidraw-app/`):
  - Nuevos: `data/projectsStore.ts`, `data/projectSwitch.ts`, `components/ProjectsSidebar.tsx`.
  - Modificados: `app_constants.ts` (nuevas `STORAGE_KEYS`), `App.tsx` (montaje del sidebar, átomo de proyecto activo en `onChange`), `components/AppMainMenu.tsx` (ítem de menú), `app-jotai.ts` (átomos de estado de proyectos), `data/LocalData.ts` (limpieza de archivos considerando todos los proyectos).
- **Librería `@excalidraw/excalidraw`**: sin cambios. Se consumen únicamente APIs públicas ya existentes (`updateScene`, `addFiles`, `getName/setName`, `<Sidebar>`, `<MainMenu>`, `restore*`).
- **Dependencias**: ninguna nueva; `idb-keyval` y `jotai` ya son dependencias de la app.
- **Sistemas relacionados**: colaboración en tiempo real (se fuerza `stopCollaboration()` al cambiar de proyecto) y `tabSync` (la doble escritura mantiene su comportamiento actual para el proyecto activo).
- **Sin cambios BREAKING** para consumidores de la librería ni para datos locales existentes.
