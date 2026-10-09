## Excalidraw Core Library

This package is the embeddable React whiteboard editor published to npm as `@excalidraw/excalidraw`. It is the npm-consumable core: embedding hosts drop in `<Excalidraw>` and receive a fully functional drawing canvas. The excalidraw.com web app (`excalidraw-app/`) is a separate consumer that wraps this library. See `packages/excalidraw/README.md` for the public API reference.

### Public API Surface

`packages/excalidraw/index.tsx` is the sole public entry point. It exports:

- **`<Excalidraw>`** — the main `React.memo`-wrapped component (exported as `Excalidraw`)
- **`ExcalidrawAPIProvider`** — a context provider that lets hooks (`useExcalidrawAPI`, `useExcalidrawStateValue`, `useOnExcalidrawStateChange`) work outside the `<Excalidraw>` tree
- Composable UI slots: `MainMenu`, `Footer`, `WelcomeScreen`, `LiveCollaborationTrigger`, `Sidebar`, `Button`, `CommandPalette`, `Stats`
- Element utilities: `getNonDeletedElements`, `getCommonBounds`, `mutateElement`, `newElementWith`, `bumpVersion`
- Export helpers: `exportToCanvas`, `exportToBlob`, `exportToSvg`, `serializeAsJSON`, `loadFromBlob`
- Data helpers: `restoreElements`, `reconcileElements`
- Constants: `FONT_FAMILY`, `THEME`, `MIME_TYPES`, `ROUNDNESS`
- React hooks: `useExcalidrawAPI`, `useExcalidrawStateValue`, `useOnExcalidrawStateChange`

The component fills its parent's full width/height — the parent element must have non-zero dimensions.

### React Props Contract

Key props from `ExcalidrawProps` in `packages/excalidraw/types.ts`:

| Prop | Purpose |
|------|---------|
| `initialData` | Starting elements, appState, files, libraryItems |
| `onChange(elements, appState, files)` | Fires on every change; primary sync hook |
| `onIncrement(event)` | Fine-grained delta events (`DurableIncrement` \| `EphemeralIncrement`) |
| `onExcalidrawAPI(api)` | Receive the imperative handle on mount |
| `isCollaborating` | Enables collaboration UI chrome |
| `onPointerUpdate({pointer, button, pointersMap})` | Remote cursor broadcast hook |
| `viewModeEnabled` | Read-only view |
| `zenModeEnabled` | Hide toolbars |
| `theme` | `"light"` \| `"dark"` \| `undefined` (auto) |
| `langCode` | BCP-47 locale code (defaults to `"en"`) |
| `UIOptions` | Show/hide specific canvas actions and tools |
| `renderTopLeftUI` / `renderTopRightUI` | Inject custom UI into toolbar corners |
| `onLinkOpen(element, event)` | Intercept hyperlink clicks on elements |
| `validateEmbeddable(url)` | Allow/deny iframe embeds |
| `generateIdForFile(file)` | Custom file ID generation |

### Imperative API

`ExcalidrawImperativeAPI` (defined in `packages/excalidraw/types.ts`) is obtained via `onExcalidrawAPI` or `useExcalidrawAPI()`. Methods include:

- `updateScene(sceneData)` — set elements/appState/files; primary way to drive the scene from outside
- `applyDeltas(deltas)` — apply collaborative incremental deltas
- `getSceneElements()` / `getAppState()` / `getFiles()` — read current state
- `resetScene()` — wipe everything
- `scrollToContent()` — pan/zoom to fit visible elements
- `setActiveTool(tool)` — switch the active tool programmatically
- `refresh()` — force a re-render without state change
- `updateFrameRendering(opts)` — toggle frame clipping
- Event subscriptions: `onChange`, `onIncrement`, `onPointerDown`, `onPointerUp`, `onScrollChange`, `onStateChange`, `onEvent`

### Data Model

**ExcalidrawElement** is the core domain object. Every drawn shape is a plain JavaScript object (never a class instance) with a stable `id`. The type hierarchy lives in `@excalidraw/element` (`packages/element/src/types.ts`):

- Shapes: rectangle, diamond, ellipse
- Linear: arrow, line (multi-point with optional bezier)
- Text (standalone or bound inside a container shape)
- Image (references `BinaryFiles` by FileId)
- Frame / MagicFrame (grouping containers)
- Embeddable / Iframe
- FreeDraw (freehand strokes)
- Selection (transient, never serialized)

All elements share a base with: `id`, `x/y`, `width/height`, `angle` (in radians), `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`, `roughness`, `opacity`, `seed` (RoughJS determinism), `version`, `versionNonce`, `index` (FractionalIndex), `isDeleted`, `groupIds`, `frameId`, `boundElements`, `updated`, `link`, `locked`, `customData`.

Elements are **treated as immutable outside the store** — external code uses `mutateElement()` (exported) or returns new objects from actions. The `version` increments on every change; `versionNonce` is a random value per change enabling conflict resolution in collaboration.

**AppState** (`packages/excalidraw/types.ts`, 70+ properties, initialized in `packages/excalidraw/appState.ts`) captures all transient UI and interaction state: tool selection, zoom/scroll, current item styling defaults, selection sets, resize/rotate flags, collaboration cursors, snap lines, grid config, and more. It is never persisted directly to disk — only `elements` and `files` are canonical.

**BinaryFiles** (`Record<FileId, BinaryFileData>`) stores image content as base64 dataURLs, associated with the canvas (not individual elements). Image elements reference files by `FileId`.

### Component Architecture

`packages/excalidraw/components/App.tsx` is the main orchestrator (~414 KB). It:

- Wires together the Store, History, scene, actions, and UI
- Manages three canvas layers:
  1. **StaticCanvas** — background shapes, rendered via `packages/excalidraw/renderer/staticScene.ts`, throttled to the frame rate
  2. **InteractiveCanvas** — selection boxes, transform handles, snap lines, remote cursors, binding highlights, rendered via `packages/excalidraw/renderer/interactiveScene.ts`
  3. **NewElementCanvas** — live preview of the element being drawn, via `packages/excalidraw/renderer/renderNewElementScene.ts`
- Handles pointer events (down/move/up), keyboard shortcuts, gesture (pinch-zoom)
- Calls `packages/excalidraw/scene/Renderer.ts` to filter visible elements by viewport

`packages/excalidraw/components/InitializeApp.tsx` handles language loading and theme setup before the editor mounts.

### State Management

Three cooperating layers:

1. **Store** (in `@excalidraw/element`): Holds the authoritative element array. On every commit it produces a `StoreIncrement` — either `DurableIncrement` (undoable, includes element and appState deltas) or `EphemeralIncrement` (pointer moves, not undoable). The `CaptureUpdateAction` enum (`IMMEDIATELY`, `EVENTUALLY`, `NEVER`) controls when a change reaches history.

2. **History** (`packages/excalidraw/history.ts`): Maintains undo/redo stacks of `HistoryDelta` objects. Each delta is the inverse of a `StoreDelta`, so undo/redo replays changes from `DurableIncrement` events. Changes that only touch invisible or ephemeral state are filtered out.

3. **Jotai atoms** (`packages/excalidraw/editor-jotai.ts`): Local reactive atoms for UI state not covered by AppState (e.g., i18n strings, search query). `EditorJotaiProvider` and `editorJotaiStore` are exported for use by host apps.

### Actions System

Every user-facing operation (copy, paste, zoom, align, flip, z-index, undo, properties panel changes) is encoded as an action in `packages/excalidraw/actions/`. Each action is defined with `register()` (from `packages/excalidraw/actions/register.ts`) and includes:

- `name: ActionName` — unique identifier
- `label` / `icon` — for UI generation
- `predicate(elements, appState, appProps, app)` — whether the action is active/visible
- `perform(elements, appState, formData, app)` → `ActionResult` — executes the change and returns `{elements, appState, files, captureUpdate}`
- Optional `PanelComponent` — React component rendered in the properties panel
- Optional `keyTest` — keyboard shortcut binding

`packages/excalidraw/actions/manager.tsx` auto-generates UI from registered actions. `packages/excalidraw/actions/types.ts` defines `ActionName`, `ActionSource` (`"ui"` | `"keyboard"` | `"contextMenu"` | `"api"` | `"commandPalette"`), and `ActionResult`.

### Element Domain Rules

**Fractional Indexing** — Elements are ordered by `index: FractionalIndex | null` (lexicographic string comparison), not array position. This allows inserting between any two elements without renumbering, and is essential for conflict-free ordering in multiplayer. Index validity after local operations is maintained in `@excalidraw/element` (`packages/element/src/fractionalIndex.ts` — `syncMovedIndices` / `syncInvalidIndices`).

**Arrow Binding** — Arrow/line endpoints bind to shapes via `FixedPointBinding`. When a shape moves, `updateBoundElements()` cascades position updates to all arrows attached to it. Binding is detected via `getHoveredElementForBinding()` during drag.

**Text Binding** — Text elements may be bound inside container shapes (`containerId`). The text auto-wraps and the container auto-resizes to fit. `editingTextElement` in AppState tracks which text is being edited inline.

**Grouping** — `groupIds` is an ordered array; nested groups are supported. `selectedGroupIds` and `editingGroupId` in AppState track the current drill-down level. Double-clicking a group enters group-editing mode.

**Frames** — Frame elements act as named containers. Child elements reference their frame via `frameId`. Frames clip their children on export and during frame-rendering mode. `packages/excalidraw/scene/export.ts` handles frame-aware export.

**Element versioning for reconciliation** — During collaboration, `packages/excalidraw/data/reconcile.ts` merges incoming element arrays against local state, choosing the higher-version element and using `versionNonce` to break ties.

### Collaboration Integration

The library is collaboration-agnostic — it provides the hooks, the host implements the transport:

1. User action → Store commits → `onIncrement(DurableIncrement)` fires with element+appState deltas → host sends to server
2. Remote update arrives → host calls `api.applyDeltas(deltas)` or `api.updateScene({elements: reconcileElements(...)})`
3. Remote cursors: host calls `api.updateScene({appState: {collaborators: new Map([...]) }})` to render other users' pointers
4. `onPointerUpdate` prop broadcasts the local user's cursor position and tool state to the transport layer

`isCollaborating={true}` unlocks collaboration-specific UI (multiplayer presence, "live collaboration" button).

### Export System

- `exportToCanvas(elements, appState, files, opts)` — renders to an `HTMLCanvasElement`
- `exportToBlob(...)` — resolves to a PNG/JPEG `Blob`
- `exportToSvg(...)` — returns an `SVGSVGElement`, using `packages/excalidraw/renderer/staticSvgScene.ts` for faithful SVG output
- `serializeAsJSON(elements, appState, files)` — produces the `.excalidraw` JSON format
- `loadFromBlob(blob, ...)` — deserializes a `.excalidraw` or `.png` file (PNGs embed JSON in metadata)
- `packages/excalidraw/data/encryption.ts` supports encrypted export/import
- `packages/excalidraw/data/restore.ts` handles schema migration when loading older files

### Internationalization

`packages/excalidraw/i18n.ts` supports 40+ languages. A `languages` array lists each locale with code, label, and optional RTL flag. `setLanguage(lang)` async-loads the locale JSON from `packages/excalidraw/locales/` and sets `document.documentElement.dir`/`lang`. The `t(key)` function resolves nested dot-notation keys with English fallback. Translation completeness thresholds are tracked in a percentages file in the locales directory. See `packages/excalidraw/locales/README.md` for contribution instructions.

### Rendering Pipeline (Summary)

```
User event → App.tsx event handler
  → action.perform() → ActionResult
  → store.commit(elements, appState) → StoreIncrement
  → History records DurableIncrement
  → onChange / onIncrement callbacks fire
  → StaticCanvas re-renders (throttled, RoughJS for shapes)
  → InteractiveCanvas re-renders (selections, handles, cursors)
```

Only elements intersecting the current viewport are sent to the renderers (filtered by `packages/excalidraw/scene/Renderer.ts`). The static canvas output is cached across zoom changes via a `shouldCacheIgnoreZoom` flag.

### Existing Documentation

- `packages/excalidraw/README.md` — public API reference (props, imperative API, utilities)
- `packages/excalidraw/locales/README.md` — how to add or update translations
- `dev-docs/docs/@excalidraw/excalidraw/api/utils/utils-intro.md` — utility function reference
- `CONTRIBUTING.md` — monorepo setup and contribution workflow
- `.github/copilot-instructions.md` — project coding standards