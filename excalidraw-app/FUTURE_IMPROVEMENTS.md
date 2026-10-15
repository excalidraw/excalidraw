# Future improvements

Roadmap for the collections and disk-save feature. Items are grouped by theme.

## Storage and platform

- **Reveal in Explorer / Finder** via a thin desktop wrapper (Electron or Tauri) instead of manual path + `.bat`
- **Sync optional OS path** to `open-collections-folder.bat` automatically when the user saves path in settings
- **Cloud folder** support (OneDrive/Dropbox paths) with clear conflict rules
- **Per-collection sync** metadata (last synced, remote etag)

## User experience

- **Unsaved warning** when closing the Collections dialog or the tab (beyond collection switch)
- **Drag-and-drop** reorder collections; pin favorites
- **Bulk actions** — delete or export selected collections
- **Empty collection** template picker on create
- **i18n** — move UI strings into Excalidraw’s translation files for upstream merge

## Thumbnails and performance

- Generate thumbnails for IDB-only saves, not only disk Save
- Lazy-load thumbnails for long lists; revoke object URLs on dialog close consistently
- Virtualized list for 50+ collections

## Collaboration

- Define behavior when **live collaboration** is active (disable auto disk save or branch per room)
- Export collection snapshot for collab room handoff

## Testing and upstream

- Unit tests for `CollectionStore` (create, duplicate, index, autosave preference)
- Integration test with mocked File System Access API
- **Upstream PR** to [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw): app-layer only, feature flag, design review, changelog entry

Upstream may require product alignment before merge; this fork remains the reference implementation.

## Architecture (done in this fork)

- [x] Isolate storage in `data/collections/`
- [x] UI in dedicated components
- [x] Bridge hook `collections/useCollectionsAppIntegration.ts` to keep `App.tsx` thin
