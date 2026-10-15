## What This App Is

The `excalidraw-app/` directory is the production excalidraw.com web application. It wraps the `@excalidraw/excalidraw` React library with real-time collaboration, multi-tier local persistence, encrypted share links, Excalidraw+ cloud integration, and AI features. The Vite build target is `excalidraw-app/build/`.

## App Entry and Routing

`excalidraw-app/index.tsx` registers the service worker (via `vite-plugin-pwa`) and mounts `ExcalidrawApp` from `excalidraw-app/App.tsx`. The top-level `ExcalidrawApp` has a special route: if `window.location.pathname === "/excalidraw-plus-export"` it renders `ExcalidrawPlusIframeExport` (a hidden iframe bridge to Excalidraw+) instead of the full editor. All other paths render the standard editor wrapped in a Jotai `Provider` with a single shared store (`appJotaiStore`).

## Scene Initialization

`initializeScene` in `excalidraw-app/App.tsx` resolves which scene to display, in priority order:

1. **Collaboration room link** (`#room=<roomId>,<roomKey>`) — joins or starts a live session via `collabAPI.startCollaboration`.
2. **JSON backend snapshot** (`#json=<id>,<key>`) — fetches encrypted scene from the share backend (`VITE_APP_BACKEND_V2_GET_URL`) and decrypts it client-side.
3. **External URL** (`#url=<encodedUrl>`) — fetches and imports an excalidraw file from an arbitrary URL.
4. **Local state** — restored from localStorage keys `excalidraw` (elements) and `excalidraw-state` (appState).

When an external scene is loaded and the user already has local work, a confirmation dialog prompts before overwriting. Collab room links never trigger this prompt — they do not override localStorage.

## Collaboration

The `Collab` class in `excalidraw-app/collab/Collab.tsx` orchestrates live collaboration:

- **Session creation**: generates a room ID (10 random bytes, hex-encoded) and an AES-GCM encryption key (22-char base64url via `generateEncryptionKey`). The live URL becomes `#room=<roomId>,<roomKey>`.
- **Socket.IO connection**: connects to `VITE_APP_WS_SERVER_URL`. On socket connection failure, falls back to loading the scene directly from Firebase Firestore.
- **End-to-end encryption**: every WebSocket message is encrypted with the room key via Web Crypto AES-GCM before being sent. The server never sees plaintext scene data. Peers decrypt with the key from the URL hash (never sent to the server as the hash is local-only).
- **`Portal`** (`excalidraw-app/collab/Portal.tsx`) manages the socket I/O layer. It broadcasts five subtypes: `SCENE_INIT` (sent to new joiners), `SCENE_UPDATE` (incremental), `MOUSE_LOCATION` (volatile, ~30 fps), `IDLE_STATUS` (volatile), `USER_VISIBLE_SCENE_BOUNDS` (volatile, used for user-follow viewport sync).
- **Bandwidth optimization**: UPDATE messages send only elements with a version newer than the last broadcast. A full scene re-sync fires every 20 seconds (`SYNC_FULL_SCENE_INTERVAL_MS = 20000`) as a safeguard against message drops.
- **Persistence during collab**: room state is also saved to Firebase Firestore in a `scenes/<roomId>` document (encrypted). This ensures late joiners and page reloads can fetch the latest scene even if no peer is online. localStorage saving is paused while collaborating (`LocalData.pauseSave("collaboration")`).
- **Element reconciliation**: incoming remote elements are merged with local state via `reconcileElements` (conflict resolution by version/updated timestamp), then version-bumped via `bumpElementVersions`.
- **Image files in collab**: stored encrypted in Firebase Storage at `/files/rooms/<roomId>/`; the `FileManager` tracks fetch/save state per file ID to avoid redundant requests.
- **Idle detection**: pointer-move events reset an idle timeout; AWAY/IDLE/ACTIVE states are broadcast so the UI shows collaborator presence.

## Persistence Layers

| Data | Storage | Keys / Store | Flush timing |
|---|---|---|---|
| Elements + appState | localStorage | `excalidraw`, `excalidraw-state` | 300 ms debounce |
| Binary files (images) | IndexedDB | `files-db / files-store` via `idb-keyval` | debounced with elements |
| Library | IndexedDB | `excalidraw-library-db` | on change |
| TTD chat history | IndexedDB | `excalidraw-ttd-chats-db` | on chat change |
| Collab username | localStorage | `excalidraw-collab` | immediate |
| Theme preference | localStorage | `excalidraw-theme` | immediate |

Saving is blocked when `document.hidden` is true (prevents spurious writes on tab switch).

Image files unused for more than 24 hours that are no longer on the canvas are deleted from IDB on fresh load (`LocalData.fileStorage.clearObsoleteFiles`).

### Multi-tab Sync

`excalidraw-app/data/tabSync.ts` stores timestamps in localStorage keys `version-dataState` and `version-files`. When a tab regains focus, it compares its in-memory version to the stored one. If the storage is newer (edited by another tab), the tab pulls fresh state and updates the scene without recording a history step (`CaptureUpdateAction.NEVER`).

## Share Links (Encrypted Snapshots)

`exportToBackend` in `excalidraw-app/data/index.ts` creates a shareable link:

1. Generates a fresh AES encryption key.
2. Compresses and encrypts the scene JSON.
3. POSTs the ciphertext to `VITE_APP_BACKEND_V2_POST_URL`; receives a scene `id`.
4. Uploads image files (compressed + encrypted) to Firebase Storage at `/files/shareLinks/<id>/`.
5. Returns a URL with fragment `#json=<id>,<encryptionKey>` — the key is only ever in the hash, never sent to the server.

Legacy share links used a fixed IV; `importFromBackend` falls back to the legacy decoder if the new format fails.

## Excalidraw+ Integration

Two integration paths connect excalidraw.com to the paid Excalidraw+ product:

**Export to Excalidraw+** (`excalidraw-app/components/ExportToExcalidrawPlus.tsx`): encrypts the scene, uploads it to Firebase Storage at `/migrations/scenes/<nanoid>/`, then opens `VITE_APP_PLUS_APP/import?excalidraw=<id>,<key>` in a new tab.

**Iframe bridge** (`excalidraw-app/ExcalidrawPlusIframeExport.tsx`, route `/excalidraw-plus-export`): Excalidraw+ embeds excalidraw.com in a hidden iframe and sends `REQUEST_SCENE` postMessages with a JWT signed by `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` (RSASSA-PKCS1-v1_5 / SHA-256). The iframe verifies the JWT using `crypto.subtle`, then reads elements and appState from localStorage and files from IDB and posts them back to the Excalidraw+ origin.

Signed-in users are detected by the presence of the `excplus-auth` cookie (`isExcalidrawPlusSignedUser`). This drives UI differences: the promo banner, command palette entries, and sign-in vs sign-up links.

## AI Features

`excalidraw-app/components/AI.tsx` wires two features against `VITE_APP_AI_BACKEND`:

- **Text-to-diagram** (TTD): streaming chat at `/v1/ai/text-to-diagram/chat-streaming`. Conversation history is persisted across sessions in IndexedDB via `TTDIndexedDBAdapter`.
- **Diagram-to-code**: exports the selected frame as a JPEG, sends it along with extracted text labels to `/v1/ai/diagram-to-code/generate`, renders the returned HTML in an iframe inside the editor.

Both features show rate-limit messaging (HTTP 429) with a link to Excalidraw+ for higher quotas.

## Theme and Language

Theme persists as `"light"`, `"dark"`, or `"system"` in localStorage (`excalidraw-theme`). System mode tracks the `prefers-color-scheme` media query live. Language is auto-detected by `i18next-browser-languagedetector` on first load and reconciled against the list of supported locales; the detected code is stored by the core library.

## PWA

`excalidraw-app/vite.config.mts` configures Workbox via `vite-plugin-pwa`. The app supports:
- Installability via `BeforeInstallPromptEvent` (captured before React mounts to avoid missing the browser event).
- `.excalidraw` file association via `file_handlers` in the Web App Manifest.
- **Web Share Target**: receives shared `.excalidraw` / `.json` files at `/web-share-target` (PWA POST endpoint).
- Runtime caching: fonts (CacheFirst 90 days), locales (CacheFirst 30 days), JS chunks (CacheFirst 90 days).

## Error Monitoring

Sentry (`@sentry/browser`) is active on `excalidraw.com` and `staging.excalidraw.com` / `vercel.app`. It captures `console.error` calls (via `captureConsoleIntegration`), attaches feature flags, and strips URL fragments before sending events. Several known benign errors are suppressed: IDB-closing errors, `QuotaExceededError`, dynamic import failures from stale service workers, and a Safari-specific `window.__pad` error.

## Key Environment Variables

- `VITE_APP_WS_SERVER_URL` — Socket.IO collaboration server URL
- `VITE_APP_BACKEND_V2_GET_URL` / `VITE_APP_BACKEND_V2_POST_URL` — share-link backend
- `VITE_APP_FIREBASE_CONFIG` — JSON Firebase config (Firestore + Storage)
- `VITE_APP_AI_BACKEND` — AI features backend
- `VITE_APP_PLUS_APP` / `VITE_APP_PLUS_LP` — Excalidraw+ app and landing page origins
- `VITE_APP_PLUS_EXPORT_PUBLIC_KEY` — RSA public key for verifying iframe JWT
- `VITE_APP_GIT_SHA` — build-time SHA injected for Sentry release tracking
- `VITE_APP_DISABLE_SENTRY` / `VITE_APP_DISABLE_PREVENT_UNLOAD` — dev override flags
- `VITE_APP_PORT` — dev server port (default 3000)