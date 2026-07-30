# Design: multiproject-support

## Context

Hoy la persistencia local de Excalidraw vive íntegramente en `excalidraw-app/` y sigue este ciclo:

```
onChange (App.tsx:677)
   └─► LocalData.save() — debounce 300ms (LocalData.ts)
        ├─► localStorage: "excalidraw" (elementos sin borrados)
        │                 "excalidraw-state" (appState limpiado)
        └─► IndexedDB "files-db": imágenes por fileId

initializeScene() (App.tsx:215)
   └─► importFromLocalStorage() → restoreElements/restoreAppState
       → initialStatePromiseRef → <Excalidraw initialData={promise} />
       → loadImages() → LocalData.fileStorage.getFiles() → addFiles()
```

La librería `@excalidraw/excalidraw` es deliberadamente _storage-agnostic_: recibe `initialData` y emite `onChange`. Toda decisión de almacenamiento es responsabilidad de la app anfitriona. Además, el swap de escena en caliente ya está probado en producción: el handler `onHashChange` (App.tsx:532) usa `excalidrawAPI.updateScene({ elements, appState, captureUpdate: IMMEDIATELY })` sin recargar.

Restricciones:

- No modificar la librería publicada; solo consumir su API pública.
- No añadir dependencias nuevas (`idb-keyval`, `jotai` ya están en la app).
- No romper el arranque (`initializeScene`), la sincronización entre pestañas (`tabSync`) ni la colaboración.

## Goals / Non-Goals

**Goals:**

- CRUD completo de proyectos locales (crear, listar, renombrar, cambiar, eliminar) desde UI nativa.
- Cambio de proyecto en caliente, sin recarga de página ni pérdida de ediciones pendientes.
- Migración transparente de la escena actual del usuario a su primer proyecto.
- Cero cambios en `packages/excalidraw` (salvo, opcionalmente, strings de i18n).

**Non-Goals:**

- Sincronización de proyectos en la nube, cuentas de usuario o backend (eso es terreno de Excalidraw+).
- Carpetas/organización jerárquica, búsqueda de proyectos, miniaturas visuales.
- Colaboración multiproyecto (cambiar de proyecto dentro de una sala; en su lugar se detiene la colaboración).
- Sincronización multi-pestaña de proyectos _distintos_ (ver Riesgos).
- Papelera de reciclaje: el borrado es definitivo.

## Decisions

### D1. La funcionalidad vive en `excalidraw-app/`, no en la librería

La persistencia ya es 100% responsabilidad de la app (localStorage, IDB, Firebase, sockets). Meter gestión de proyectos en el paquete impondría opiniones de storage a todos los consumidores (Notion, Obsidian, VSCode…). La API pública del editor ya cubre todo lo necesario: `updateScene`, `addFiles`, `getName/setName`, `<Sidebar>`, `<MainMenu>`, `restoreElements/restoreAppState`.

_Alternativa considerada:_ plugin/módulo en `packages/excalidraw` — descartada por romper la separación de responsabilidades del monorepo.

### D2. Almacén IDB con el patrón `LibraryIndexedDBAdapter`

`idb-keyval` con `createStore("projects-db", "projects-store")`, replicando el patrón ya establecido en `LocalData.ts:229`:

```
projects-db / projects-store
├─ "__index__"      → [{ id, title, updatedAt }]        (lista ligera para UI)
└─ "proj_<nanoid>"  → { id, title, createdAt, updatedAt,
                        elements, appState }
```

_Alternativas consideradas:_ (a) un solo registro con todos los proyectos embebidos — descartada: obliga a cargar/serializar todo para listar y multiplica el riesgo de corrupción total; (b) Dexie o IDB crudo con índices — descartada: `idb-keyval` ya está en el bundle y basta para acceso por clave.

### D3. Doble escritura del proyecto activo en localStorage

El proyecto activo se guarda **tanto** en su registro IDB **como** en las claves tradicionales (`excalidraw`, `excalidraw-state`). Esto deja intactos:

- `initializeScene()` → el arranque siempre restaura el último proyecto activo sin leer IDB.
- `tabSync.ts` → la sincronización entre pestañas del proyecto activo funciona igual que hoy.
- La migración → la escena actual _ya es_ el primer proyecto, solo hay que registrarla en IDB.

_Alternativa considerada:_ IDB como única fuente de verdad — descartada para el MVP: exigiría reescribir `initializeScene`, `tabSync` y `importFromLocalStorage`, con alto riesgo de regresiones. Se deja como evolución futura (ver Open Questions).

### D4. Cambio en caliente con el patrón `onHashChange`

`data/projectSwitch.ts` encapsula el ciclo:

```
switchProject(targetId)
 1. ¿destino === activo?  → no-op
 2. ¿colaborando?         → collabAPI.stopCollaboration(false)
 3. LocalData.flushSave() + escritura síncrona del proyecto saliente en IDB
 4. set(localStorage, "excalidraw-active-project", targetId)
 5. leer proj_<targetId> de IDB
 6. excalidrawAPI.updateScene({
      elements: restoreElements(record.elements, null, { repairBindings: true }),
      appState: restoreAppState(record.appState, null),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY })
 7. resolver fileIds → LocalData.fileStorage.getFiles() → excalidrawAPI.addFiles()
 8. updateBrowserStateVersion(VERSION_DATA_STATE)  → avisa a otras pestañas
 9. appJotaiStore.set(activeProjectIdAtom, targetId)
```

Los pasos 5–7 replican exactamente el código probado de `onHashChange` y `loadImages`, así que el riesgo de la operación central es bajo.

### D5. El título del proyecto es `appState.name`

El editor ya tiene nombre de escena (`getName()`, `ProjectName`, usado al exportar archivos). Renombrar el proyecto activo = `updateScene({ appState: { name } })` + persistir. No se inventa un campo paralelo. Al crear proyecto se asigna el título por defecto que ya genera el editor ("Untitled-<fecha>") o uno propio vía i18n.

### D6. UI: `<Sidebar name="projects">` + ítem en `AppMainMenu`

El paquete exporta `Sidebar` con sistema de tabs, triggers y dock — el mismo patrón de la biblioteca de shapes. `ProjectsSidebar.tsx` se monta como children de `<Excalidraw>` en `App.tsx`, y `AppMainMenu` gana un `MainMenu.Item` que lo abre vía `excalidrawAPI.toggleSidebar({ name: "projects" })`. Estado en `app-jotai.ts`: `projectsListAtom` (índice) y `activeProjectIdAtom`.

_Alternativa considerada:_ desplegable en `renderTopRightUI` — descartada como UI principal (poco espacio para gestión CRUD); viable como fase posterior.

### D7. Imágenes: `files-db` compartido, GC contra la unión de proyectos

Las imágenes siguen direccionadas por `fileId` en el store existente — cero migración, cero duplicación entre proyectos. Consecuencia: `clearObsoleteFiles` ya no puede mirar solo la escena actual; debe calcular la unión de `fileId` de **todos** los proyectos del índice antes de borrar.

### D8. Qué se persiste por proyecto vs global

Por proyecto: `elements`, `appState` limpiado (incluye `name`, zoom, scroll, tema si el usuario lo cambió allí). Global (fuera del registro): username de colaboración, biblioteca, idioma. En la restauración se usa `restoreAppState(record.appState, null)` y se preservan las preferencias globales del usuario igual que hace hoy `importFromLocalStorage`.

## Risks / Trade-offs

- [Dos pestañas con proyectos distintos se pisan en localStorage] → `tabSync` asume una escena global; si pestaña A edita el proyecto 1 y la B el 2, ambas escriben `"excalidraw"` y el `storage` event las confunde. Mitigación MVP: documentar la limitación y dejar que la última pestaña enfocada gane (comportamiento actual de Excalidraw con cualquier edición concurrente). Mitigación futura: namespacing de claves por proyecto (`excalidraw:proj_<id>`) — queda como Open Question.
- [Cambiar de proyecto en plena colaboración deja estados inconsistentes] → se fuerza `stopCollaboration(false)` antes del swap (D4, paso 2). El usuario vuelve a modo local con la escena reconciliada, mismo comportamiento que al cerrar una sala.
- [Cuota de localStorage (~5MB) con doble escritura] → el proyecto activo ocupa espacio dos veces (LS + IDB). Mitigación: ya existe `localStorageQuotaExceededAtom` y aviso al usuario; la migración a "IDB como fuente única" resuelve esto a medio plazo.
- [Imágenes huérfanas al eliminar proyectos] → si se borra un proyecto, sus imágenes quedan en `files-db` hasta que el GC global (D7) las considere obsoletas por antigüedad (`lastRetrieved` > 24h) y sin referencias. Aceptable para MVP.
- [appState.openSidebar persistido puede reabrir el sidebar "projects" al restaurar] → `clearAppStateForLocalStorage` ya limpia campos transitorios; verificar en tests que restaurar un proyecto no fuerza sidebars inesperados.
- [Serialización grande por proyecto] → proyectos con miles de elementos se escriben enteros en cada save. Mitigación: es exactamente el coste actual de la app (misma escritura JSON completa); no introduce regresión.

## Migration Plan

1. **Primera ejecución tras desplegar**: al montar `App.tsx`, si IDB no tiene `__index__`, se ejecuta la migración: leer `importFromLocalStorage()`, crear `proj_<id>` con ese contenido, escribir `__index__` y `excalidraw-active-project`. Sin diálogos; el usuario ni lo nota.
2. **Despliegue**: es cambio 100% client-side en `excalidraw-app`; basta el build habitual de Vite. No hay backend nuevo.
3. **Rollback**: revertir el deploy deja las claves de localStorage intactas (la doble escritura las mantiene siempre actualizadas), así que el usuario conserva su último proyecto activo. Los registros IDB huérfanos son inofensivos.

## Open Questions

- ¿Merece la pena namespacing de localStorage por proyecto (`excalidraw:proj_<id>`) para soportar multi-pestaña multiproyecto? Coste: reescribir `tabSync` e `importFromLocalStorage`. Decidir tras el MVP.
- ¿Añadir selector rápido de proyecto en `renderTopRightUI` (junto al botón de colaboración) como atajo al sidebar?
- ¿Miniaturas (thumbnails) de proyectos en el índice? Requeriría generar previews (exportToCanvas reducido) — coste de almacenamiento y complejidad; evaluar demanda real primero.
- ¿Integrar "Duplicar proyecto" y "Exportar proyecto como .excalidraw" desde el sidebar? Encaja naturalmente con las acciones existentes del editor.
