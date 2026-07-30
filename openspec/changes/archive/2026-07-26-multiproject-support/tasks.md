# Tasks: multiproject-support

## 1. Constantes y estado base

- [x] 1.1 Añadir a `excalidraw-app/app_constants.ts` en `STORAGE_KEYS`: `IDB_PROJECTS: "excalidraw-projects"` y `LOCAL_STORAGE_ACTIVE_PROJECT: "excalidraw-active-project"`
- [x] 1.2 Añadir a `excalidraw-app/app-jotai.ts` los átomos `projectsListAtom` (`[{ id, title, updatedAt }]`) y `activeProjectIdAtom` (`string | null`)

## 2. Almacén de proyectos (projectsStore.ts)

- [x] 2.1 Crear `excalidraw-app/data/projectsStore.ts` con `createStore("projects-db", "projects-store")` siguiendo el patrón de `LibraryIndexedDBAdapter` (LocalData.ts:229)
- [x] 2.2 Implementar tipos `ProjectRecord` (`{ id, title, createdAt, updatedAt, elements, appState }`) y `ProjectIndexEntry` (`{ id, title, updatedAt }`)
- [x] 2.3 Implementar `listProjects()` (lee `__index__`), `getProject(id)`, `saveProject(record)` (escribe registro + actualiza `__index__` atómicamente en lo posible), `deleteProject(id)` (borra registro + entrada del índice)
- [x] 2.4 Implementar `getActiveProjectId()` / `setActiveProjectId(id)` sobre la clave `excalidraw-active-project` de localStorage
- [x] 2.5 Implementar `migrateLocalSceneToProject()`: si no existe `__index__`, crear el primer proyecto desde `importFromLocalStorage()` y marcarlo activo (cubre también el caso de escena vacía)
- [x] 2.6 Tests unitarios de CRUD del store con `fake-indexeddb` (patrón ya usado en el repo)

## 3. Guardado dual del proyecto activo

- [x] 3.1 En `App.tsx::onChange`, tras `LocalData.save(...)`, invocar el guardado del proyecto activo en IDB (debounce alineado con `SAVE_TO_LOCAL_STORAGE_TIMEOUT`), filtrando elementos borrados y limpiando appState con `clearAppStateForLocalStorage`
- [x] 3.2 Asegurar que el guardado en IDB también se dispara en `flushSave` (blur/visibilitychange/unload) para no perder ediciones pendientes
- [x] 3.3 Ejecutar `migrateLocalSceneToProject()` en el arranque de `ExcalidrawWrapper` antes de poblar `projectsListAtom` y `activeProjectIdAtom`

## 4. Cambio de proyecto en caliente (projectSwitch.ts)

- [x] 4.1 Crear `excalidraw-app/data/projectSwitch.ts` con `switchProject(targetId)` implementando el flujo D4 del diseño (no-op si es el activo, stopCollaboration si colabora, flush + escritura del saliente, puntero, `updateScene` con `CaptureUpdateAction.IMMEDIATELY`, carga de imágenes con `addFiles`, `updateBrowserStateVersion`, actualización de átomos jotai)
- [x] 4.2 Implementar `createProject()` (guarda el actual, crea registro vacío con título por defecto, lo activa)
- [x] 4.3 Implementar `renameProject(id, title)` (actualiza registro + índice; si es el activo, `updateScene({ appState: { name: title } })`)
- [x] 4.4 Implementar `deleteProject(id)` con la regla del proyecto activo: activar el más reciente restante o crear uno nuevo vacío si no queda ninguno
- [x] 4.5 Tests de integración del switch siguiendo el patrón de `excalidraw-app/tests/` (render de `<ExcalidrawApp />`, cambiar de proyecto, verificar elementos restaurados y ausencia de contaminación entre proyectos)

## 5. Interfaz de usuario

- [x] 5.1 Crear `excalidraw-app/components/ProjectsSidebar.tsx` usando `<Sidebar name="projects">` del paquete: lista ordenada por `updatedAt` desc, resaltado del activo, estado vacío con CTA de creación
- [x] 5.2 Añadir acciones en el sidebar: "Nueva pizarra", renombrar inline (o vía prompt), eliminar con diálogo de confirmación
- [x] 5.3 Añadir ítem "Mis pizarras" en `excalidraw-app/components/AppMainMenu.tsx` que invoque `excalidrawAPI.toggleSidebar({ name: "projects" })`
- [x] 5.4 Montar `<ProjectsSidebar />` como children de `<Excalidraw>` en `App.tsx` y suscribir el sidebar a `projectsListAtom` / `activeProjectIdAtom`
- [x] 5.5 Añadir strings de i18n (al menos `en` y `es`) para sidebar, acciones y confirmaciones

## 6. Resiliencia y casos borde

- [x] 6.1 Verificar que cambiar de proyecto durante colaboración detiene la sala y deja la escena local consistente (test manual + ajuste si procede)
- [x] 6.2 Modificar `LocalData.ts::LocalFileManager.clearObsoleteFiles` para preservar los `fileId` referenciados por la unión de todos los proyectos (no solo la escena activa)
- [x] 6.3 Verificar que restaurar un proyecto no reabre sidebars inesperados (campo `openSidebar` en appState persistido)
- [x] 6.4 Documentar en el código la limitación multi-pestaña (dos proyectos distintos en dos pestañas) apuntando a la Open Question del diseño

## 7. Verificación final

- [x] 7.1 `yarn test:typecheck` sin errores
- [x] 7.2 `yarn test:update` pasando, incluidos los tests nuevos de store y switch
- [x] 7.3 `yarn fix` aplicado (prettier + eslint)
- [ ] 7.4 Prueba manual: crear 3 proyectos, alternar entre ellos con ediciones pendientes, recargar la página y comprobar que se restaura el último activo; eliminar el activo y comprobar el fallback
