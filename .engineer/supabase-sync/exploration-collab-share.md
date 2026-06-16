# Exploration: Collaboration, Share Links, and Persistence

_Captured by Explore agent during INIT. Line numbers approximate (codebase at branch `online-sync`)._

## 1. Live Collaboration (`excalidraw-app/collab/`)

**Primary files:** `collab/Collab.tsx`, `collab/Portal.tsx`

- `Collab` is a **class component** instantiated in `App.tsx` (~line 1038-1040), rendered conditionally on `!isCollabDisabled`.
- **`CollabAPI` interface** (Collab.tsx ~114-126):
  - `isCollaborating(): boolean`
  - `startCollaboration(roomLinkData)`
  - `stopCollaboration(keepRemoteState?)`
  - `syncElements(elements)` — broadcasts scene changes
  - `onPointerUpdate` — cursor sync
  - `fetchImageFilesFromFirebase()`
- **Portal** (`Portal.tsx`) uses `socket.io-client`. Emits `WS_EVENTS.SERVER_VOLATILE` / `WS_EVENTS.SERVER`; listens `init-room`, `new-user`, `room-user-change`. Room format `#room={roomId},{roomKey}`.
- **UI trigger:** `LiveCollaborationTrigger` rendered in `renderTopRightUI` (App.tsx ~969-972). Opens ShareDialog with type `collaborationOnly`.
- **State atoms:** `collabAPIAtom`, `isCollaboratingAtom`, `isOfflineAtom`.

## 2. Shareable Links (`excalidraw-app/share/` + `data/index.ts`)

**Primary files:** `share/ShareDialog.tsx`, `share/QRCode.tsx`, `data/index.ts`

- **URL patterns:** collab room `#room={roomId},{roomKey}`; share link `#json={id},{encryptionKey}`; external `#url={encodedUrl}` (data/index.ts ~131, 226-229).
- **Generation:** `exportToBackend()` (data/index.ts ~248-299) compresses+encrypts scene, POSTs to `VITE_APP_BACKEND_V2_POST`, stores files in Firebase Storage `/files/shareLinks/{id}`, returns `#json={id},{key}`.
- **Import:** `importFromBackend()` (data/index.ts ~202-242) fetches from `VITE_APP_BACKEND_V2_GET`, decrypts.
- **ShareDialog state:** `shareDialogStateAtom` (ShareDialog.tsx ~32-34). Opened from App.tsx ~971-972, 1082-1085, 1127. ShareDialog rendered unconditionally (App.tsx ~1042), accepts `collabAPI` + `onExportToBackend`.

## 3. Persistence Layer (`excalidraw-app/data/`)

| Component | Storage | What | Key file |
|---|---|---|---|
| Scene elements | localStorage `excalidraw` | NonDeleted elements[] | LocalData.ts |
| App state | localStorage `excalidraw-state` | AppState | LocalData.ts |
| Binary files | IndexedDB (idb-keyval, store `files-db`/`files-store`) | BinaryFileData | LocalData.ts ~49,169-227 |
| Collab username | localStorage | username | localStorage.ts ~11-21 |
| Collab room data | Firebase Firestore | encrypted elements | firebase.ts ~87-116 |
| Share-link files | Firebase Storage `/files/shareLinks/{id}` | files | firebase.ts ~145+ |

- **Save:** `LocalData.save()` (LocalData.ts ~137-147) called on every `onChange`, **debounced 300ms** (`SAVE_TO_LOCAL_STORAGE_TIMEOUT`). Paused during collaboration via `pauseSave("collaboration")`. Flush on blur/unload (`LocalData.flushSave()`).
- **Load:** `initializeScene()` (App.tsx ~215-371): imports localStorage first, checks collab link via `getCollaborationLinkData()`, confirms override for external scene, starts collab if room link.
- **Data shapes:**
  ```
  localStorage["excalidraw"]       = JSON.stringify(NonDeletedExcalidrawElement[])
  localStorage["excalidraw-state"] = JSON.stringify(AppState)
  IndexedDB files-store[fileId]    = { id, mimeType, created, lastRetrieved, dataURL/data }
  ```

## 4. App.tsx Integration Points

| Line (approx) | What |
|---|---|
| 96-100 | Collab imports: `collabAPIAtom, isCollaboratingAtom, isOfflineAtom` |
| 407-410 | read collabAPI; `isCollaborating` initialized from URL via `isCollaborationLink()` |
| 523-530 | initial load hook → `initializeScene(collabAPI)` |
| 559-616 | `syncData` debounce — cross-tab sync when NOT collaborating |
| 677-727 | **onChange hot path** → `collabAPI.syncElements(elements)` (~683) + `LocalData.save()` (~689) |
| 733-771 | `onExportToBackend` → `exportToBackend()` (share link) |
| 790-793 | `onCollabDialogOpen` → shareDialogState `collaborationOnly` |
| 914 | `isCollaborating` prop passed to `<Excalidraw>` |
| 955-978 | `renderTopRightUI` → `LiveCollaborationTrigger` + CollabError |
| 1038-1040 | `<Collab>` rendered conditionally (`!isCollabDisabled`) |
| 1042-1057 | `<ShareDialog>` rendered unconditionally |

## 5. Environment & Config

- **Firebase:** `import.meta.env.VITE_APP_FIREBASE_CONFIG` (firebase.ts ~46) — JSON string parsed to init Firebase (Firestore + Storage).
- **Backend share URLs:** `VITE_APP_BACKEND_V2_GET`, `VITE_APP_BACKEND_V2_POST` (data/index.ts ~65-66).
- **Other:** `VITE_APP_DISABLE_PREVENT_UNLOAD` (test), `VITE_APP_PLUS_LP`, `VITE_APP_PLUS_APP`.
- Env access pattern: `import.meta.env.VITE_*`.

## Tight-coupling risks for disabling collab/share

1. `onChange` (App.tsx ~682-684) checks `collabAPI?.isCollaborating()` — must be guarded/removed.
2. `initializeScene()` (App.tsx ~527-530) heavily depends on collab link detection.
3. ShareDialog always mounted (App.tsx ~1042); export-to-backend flow needs removal/stubbing.
4. `isCollaborating` className on root div (App.tsx ~906-908).
5. Firebase is shared by BOTH collab and share links — handle carefully.
6. Portal socket lifecycle coupled to Collab lifecycle.

## Implications for Supabase sync work
1. Remove ShareDialog triggers / LiveCollaborationTrigger.
2. Replace `collabAPI?.syncElements()` path with Supabase push.
3. Keep `LocalData` (localStorage + IndexedDB) as the local source of truth; add Supabase replication on save + pull on load.
4. Keep `importFromLocalStorage`.
5. Remove Portal/WebSocket usage.
6. Decide fate of Firebase (file storage) vs Supabase Storage for binary files.
