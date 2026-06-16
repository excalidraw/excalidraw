# 04 — Low-Level Design, PART 2: UI + App.tsx wiring + disable + tests

_Status: LLD (part 2 of 2). Owns: UI components, the `useSupabaseSync` hook, all `App.tsx` /
menu / welcome-screen / data-layer wiring edits, the disable strategy, and the test plan + mock
skeleton. The data layer (SQL, `boardRepository`, `supabaseFiles`, `syncEngine`, `client.ts`,
`featureFlags.ts`, `auth.ts`, `sessionAtom.ts`) is specced by PART 1; this doc **consumes** its
interfaces as declared in the HLD and never re-specs their internals._

Line refs verified against branch `online-sync` on 2026-06-15. Treat as anchors (±a few lines).

## Consumed data-layer interfaces (from PART 1 / HLD — do NOT re-spec)

```ts
// client.ts
getSupabaseClient(): SupabaseClient | null
// featureFlags.ts
isSupabaseSyncEnabled(): boolean
// auth.ts
signInWithMagicLink(email: string): Promise<{ error: Error | null }>
signOut(): Promise<void>
getSession(): Promise<Session | null>
onAuthStateChange(cb: (session: Session | null) => void): { unsubscribe(): void }
// sessionAtom.ts (jotai)
sessionAtom: Atom<Session | null>
userIdAtom: Atom<string | null>          // derived: session?.user.id ?? null
useInitSupabaseSession(): void            // mounts getSession()+onAuthStateChange listener
// syncEngine.ts  — syncStatusAtom owned here (incl. 'offline'), NOT in collab/
syncStatusAtom: Atom<{ status: 'idle'|'syncing'|'synced'|'error'|'offline';
                       lastSyncedAt: number | null; error: string | null }>
class SyncEngine {
  constructor(deps: { boardRepository; fileManager: FileManager; setStatus; getScene });
  notifyChange(els, appState, files): void   // fire-and-forget, debounced
  syncNow(): Promise<void>                    // cancels debounce, immediate flush
  start(userId: string): Promise<void>        // pull+reconcile, arm listeners
  stop(): void
  flush(): Promise<void>                       // flush if dirty; ignores LocalData.isSavePaused()
  dispose(): void
}
// boardRepository.ts
serializeScene(elements, appState): { document; app_state }
pullBoard(userId): Promise<BoardRow | null>
pushBoard(userId, scene, expectedVersion): Promise<{ version; updated_at }>
// supabaseFiles.ts
createSupabaseFileCallbacks(client, userId):
  { getFiles; saveFiles; onFileStatusChange }   // shape matches FileManager ctor
```

**Note on `notifyChange` ownership:** the HLD has the engine own the debounce and `notifyChange`.
The hook exposes `syncNow`; `App.tsx`'s `onChange` calls the engine's `notifyChange` via a ref held
by the hook (see §C-1). The hook reads `getScene` from `excalidrawAPI` so the engine never imports
React.

---

## B (UI). Per-file interface specs (UI + hook)

### B.1 `excalidraw-app/data/supabase/useSupabaseSync.ts` — the hook

**Path:** `excalidraw-app/data/supabase/useSupabaseSync.ts`
**Purpose:** Thin React adapter that owns one `SyncEngine` instance (in a `useRef`), wires it to
the editor + auth atoms + flag, runs the pull-on-login effect, applies pulled scene/files to the
editor, mirrors engine status into `syncStatusAtom`, and flushes on unload/unmount. Contains **no**
debounce/status/retry logic itself (that is the engine — HLD §1.2).

**Verified upstream facts that shape this hook:**
- `useExcalidrawAPI()` returns `ExcalidrawImperativeAPI | null`
  (`packages/excalidraw/components/App.tsx:558,586`). So the param type is `… | null`.
- Apply API: `excalidrawAPI.updateScene({ elements, appState, captureUpdate })`
  (`types.ts:952`). The capture enum is **`CaptureUpdateAction`**, imported from
  `@excalidraw/excalidraw` (`packages/excalidraw/index.tsx:366`). For a background login-pull use
  **`CaptureUpdateAction.NEVER`** (mirrors the tab-sync apply at `App.tsx:574`; the user-initiated
  hashchange apply uses `.IMMEDIATELY` at `App.tsx:552`).
- `excalidrawAPI.addFiles(data: BinaryFileData[]) => void` (`types.ts:974`).
- The post-pull file step must mirror `App.tsx:496-509` exactly (the local initial-load path):
  build `fileIds` via a reduce over `isInitializedImageElement(element) ? acc.concat(element.fileId)`
  (this is the follow-up to pin — see §C-1 note), then `getFiles → addFiles → updateStaleImageStatuses`.
- `updateStaleImageStatuses({ excalidrawAPI, erroredFiles: Map<FileId, true>, elements })` is
  imported from `./data/FileManager` (`FileManager.ts:272-296`); it internally uses
  `CaptureUpdateAction.NEVER`.

**Signature:**

```ts
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { FileManager } from "../FileManager";

export interface UseSupabaseSyncResult {
  status: "idle" | "syncing" | "synced" | "error" | "offline";
  lastSyncedAt: number | null;
  /** flush the pending debounce + push immediately (button / menu "Sync now") */
  syncNow: () => Promise<void>;
  /** called from App.tsx onChange; no-op when flag off / signed-out */
  notifyChange: (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => void;
}

export const useSupabaseSync = (opts: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  fileManager: FileManager | null;   // the composed Supabase FileManager (null when flag off)
}): UseSupabaseSyncResult;
```

**Imports:** `useEffect`, `useRef`, `useCallback` from `react`; `useAtomValue`, `useSetAtom` from
`../../app-jotai`; `CaptureUpdateAction` from `@excalidraw/excalidraw`; `restoreElements`,
`restoreAppState` from `@excalidraw/excalidraw/data/restore`; `isInitializedImageElement` from
`@excalidraw/element`; `updateStaleImageStatuses` from `../FileManager`; `EVENT` from
`@excalidraw/common`; `isSupabaseSyncEnabled` from `./featureFlags`; `SyncEngine`,
`syncStatusAtom` from `./syncEngine`; `userIdAtom` from `./sessionAtom`; `useInitSupabaseSession`
from `./sessionAtom`; types from `@excalidraw/element/types` + `@excalidraw/excalidraw/types`.

**Behavior:**

1. **Boot auth listener:** call `useInitSupabaseSession()` unconditionally at the top (it internally
   no-ops when the flag is off / client null). Read `const userId = useAtomValue(userIdAtom)` and
   `const syncStatus = useAtomValue(syncStatusAtom)`.

2. **Create the engine once** (guarded by flag + `fileManager`):
   ```ts
   const engineRef = useRef<SyncEngine | null>(null);
   useEffect(() => {
     if (!isSupabaseSyncEnabled() || !fileManager || !excalidrawAPI) return;
     engineRef.current = new SyncEngine({
       fileManager,
       getScene: () => ({
         elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
         appState: excalidrawAPI.getAppState(),
         files: excalidrawAPI.getFiles(),
       }),
       setStatus: setSyncStatus,             // setter for syncStatusAtom
       boardRepository,                       // imported module
     });
     return () => engineRef.current?.dispose();
   }, [excalidrawAPI, fileManager]);
   ```

3. **Pull-on-login / stop-on-logout effect** (depends on `userId`):
   ```ts
   useEffect(() => {
     const engine = engineRef.current;
     if (!engine) return;
     if (userId) {
       engine.start(userId).then((applied) => {
         // engine.start runs pullBoard + the §3.2 version table; when "cloud wins"
         // it returns the row to apply (or applies via a callback). Apply here:
         if (applied?.scene && excalidrawAPI) {
           excalidrawAPI.updateScene({
             elements: restoreElements(applied.scene.document, null, { repairBindings: true }),
             appState: restoreAppState(applied.scene.app_state, null),
             captureUpdate: CaptureUpdateAction.NEVER,        // background pull → no undo entry
           });
           applyPulledFiles(applied.scene.document);          // step 4 below
         }
       });
     } else {
       engine.stop();
     }
   }, [userId, excalidrawAPI]);
   ```
   > Apply-ownership note: PART 1's engine performs the *decision* (version table). The DOM-mutating
   > `updateScene` + file load live **here** in the hook because they need the React-scoped
   > `excalidrawAPI`. The engine returns "apply this scene" (or invokes an injected `onApply`
   > callback passed in step 2). Whichever PART 1 chooses, the hook owns the `updateScene` call so
   > the engine stays framework-free (HLD §1.2). If PART 1 instead injects `onApply`, this effect
   > passes `applyPulledScene` as that callback and the `.then` body collapses into it.

4. **`applyPulledFiles(document)` helper** (mirrors `App.tsx:496-509` precisely — the follow-up
   `isInitializedImageElement` reduce is pinned here):
   ```ts
   const applyPulledFiles = (document: readonly OrderedExcalidrawElement[]) => {
     if (!excalidrawAPI || !fileManager) return;
     const fileIds = document.reduce((acc, element) => {
       if (isInitializedImageElement(element)) {
         return acc.concat(element.fileId);
       }
       return acc;
     }, [] as FileId[]);
     if (!fileIds.length) return;
     fileManager.getFiles(fileIds).then(({ loadedFiles, erroredFiles }) => {
       if (loadedFiles.length) excalidrawAPI.addFiles(loadedFiles);
       updateStaleImageStatuses({
         excalidrawAPI,
         erroredFiles,                                       // Map<FileId, true>
         elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
       });
     });
   };
   ```

5. **Flush-on-unload effect** (mirrors the events `LocalData.flushSave` uses at `App.tsx:618-674`):
   ```ts
   useEffect(() => {
     if (!isSupabaseSyncEnabled()) return;
     const flush = () => engineRef.current?.flush();
     const onVisibility = () => { if (document.hidden) flush(); };
     window.addEventListener(EVENT.BEFORE_UNLOAD, flush);
     document.addEventListener("visibilitychange", onVisibility);
     window.addEventListener(EVENT.BLUR, flush);
     return () => {
       window.removeEventListener(EVENT.BEFORE_UNLOAD, flush);
       document.removeEventListener("visibilitychange", onVisibility);
       window.removeEventListener(EVENT.BLUR, flush);
       flush();                                              // flush on hook unmount too
     };
   }, []);
   ```
   `engine.flush()` is independent of `LocalData.isSavePaused()` (HLD §3.8, m2-review); the network
   flush on `beforeunload` is best-effort by spec.

6. **Return:**
   ```ts
   const notifyChange = useCallback((els, appState, files) => {
     engineRef.current?.notifyChange(els, appState, files);
   }, []);
   const syncNow = useCallback(async () => { await engineRef.current?.syncNow(); }, []);
   return { status: syncStatus.status, lastSyncedAt: syncStatus.lastSyncedAt, syncNow, notifyChange };
   ```

---

### B.2 `excalidraw-app/components/SyncStatusButton.tsx`

**Path:** `excalidraw-app/components/SyncStatusButton.tsx`
**Purpose:** The top-right pill that replaces `LiveCollaborationTrigger`, rendering the 4 sync
states (HLD §2.5) + a click-popover with "Sync now", last-synced time, and (signed-out) a "Sign in
to sync" affordance. Reads nothing from atoms itself — it is a **controlled** component fed by
`App.tsx` (which subscribes to `syncStatusAtom` via the hook). This keeps it trivially testable.

**Primitives to reuse (verified available + already used by `excalidraw-app/share/ShareDialog.tsx`):**
- `Button` from `@excalidraw/excalidraw/components/Button` (`Button.tsx:26`) — same primitive
  `LiveCollaborationTrigger` uses (`live-collaboration/LiveCollaborationTrigger.tsx:6`). Use it for
  the pill so styling/focus matches the toolbar.
- `Popover` from `@excalidraw/excalidraw/components/Popover` (`Popover.tsx:23`, supports
  `onCloseRequest`, `fitInViewport`) for the dropdown; or `Island` for the panel chrome.
- Icons from `@excalidraw/excalidraw/components/icons` (e.g. a check / spinner / warning / sync
  glyph; reuse existing `share`-style exports or add small inline SVGs in a local icons const).

**Props:**

```ts
export interface SyncStatusButtonProps {
  status: "idle" | "syncing" | "synced" | "error" | "offline";
  lastSyncedAt: number | null;
  error?: string | null;          // shown in popover only in 'error' state
  onSyncNow: () => void;
  isSignedIn: boolean;
  onRequestSignIn: () => void;     // opens SignInDialog (App.tsx owns the open state)
}

export const SyncStatusButton: React.FC<SyncStatusButtonProps>;
```

**Behavior:**
- Maps `status` → `{ icon, labelKey, className }`:
  | status   | glyph | label             | className modifier |
  |----------|-------|-------------------|--------------------|
  | idle     | ✓ / – | "Synced" / hidden | `--idle`           |
  | syncing  | ◴ spin| "Syncing…"        | `--syncing`        |
  | synced   | ✓     | "Synced"          | `--synced`         |
  | error    | ⚠     | "Sync error"      | `--error` (red)    |
  | offline  | ⦸     | "Offline"         | `--offline` (grey) |
  When `!isSignedIn`, override label → "Sign in to sync" and clicking the pill (or its item) calls
  `onRequestSignIn` instead of `onSyncNow`.
- Click toggles a local `useState(open)`; renders `<Popover onCloseRequest={() => setOpen(false)}>`
  anchored under the pill containing:
  - `Last synced: HH:MM` derived from `lastSyncedAt` (omit if null). Use a small local
    `formatTime(lastSyncedAt)` (`new Date(ms).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})`).
  - a `↻ Sync now` button → `onSyncNow()` then `setOpen(false)`; disabled when `!isSignedIn` or
    `status === 'syncing'`.
  - the `error` string (only when `status === 'error'`).
  - when `!isSignedIn`: a `🔑 Sign in to sync` row → `onRequestSignIn()`.
- Renders inside the existing `<div className="excalidraw-ui-top-right">` wrapper (so it occupies the
  same slot the collab trigger did — see §C-3).

**Imports:** `clsx`; `useState` from react; `Button` + `Popover` (+ optional `Island`) from the
package; `useI18n` or `t` from `@excalidraw/excalidraw/i18n` for labels; local `./SyncStatusButton.scss`.

---

### B.3 Auth UI — `excalidraw-app/components/SignInDialog.tsx` + MainMenu items

**Decision (state it clearly): BOTH, with a clean split.**
- A standalone **`SignInDialog.tsx`** owns the magic-link email form (reused by both the
  `SyncStatusButton` "Sign in to sync" affordance and the MainMenu item).
- **MainMenu items** (specced in §C-2) provide: a `Sync now` item, and an auth row that is either
  "user email + Sign out" (signed-in) or "Sign in to sync" (signed-out, opens `SignInDialog`).
- `App.tsx` owns a single `const [signInOpen, setSignInOpen] = useState(false)` and passes
  `onRequestSignIn={() => setSignInOpen(true)}` to both the button and the menu, and renders
  `<SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />` once.

**Path:** `excalidraw-app/components/SignInDialog.tsx`
**Purpose:** Minimal email magic-link sign-in modal (HLD §2.5 mockup 3, §4). Modeled directly on
`excalidraw-app/share/ShareDialog.tsx`, which already imports `Dialog`, `FilledButton`, `TextField`
from the package (`ShareDialog.tsx:3-5`).

**Props:**

```ts
export const SignInDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}>;
```

**Behavior:**
- When `!open`, render nothing.
- `useState` for `email`, `sending`, `sent`, `error`.
- Layout (via `Dialog`):
  ```
  <Dialog size="small" onCloseRequest={onClose} title={t("…signIn.title")}>  // "Sign in to sync"
    <p>We'll email you a magic link.</p>
    <TextField label="Email" placeholder="you@example.com"
               value={email} onChange={setEmail} onKeyDown={enter→submit} />
    <FilledButton label="Send magic link" onClick={submit} status={sending ? "loading" : undefined}/>
    {sent && <p>✓ Check your inbox to finish signing in.</p>}
    {error && <p className="error">{error}</p>}
  </Dialog>
  ```
- `submit()`: `setSending(true); const { error } = await signInWithMagicLink(email);` →
  on success `setSent(true)`, on failure `setError(error.message)`, finally `setSending(false)`.
  After `sent`, keep the dialog open showing the confirmation (user closes manually). On auth state
  flipping to signed-in (via `sessionAtom`), `App.tsx` can auto-close (optional).

**Verified primitive prop shapes:**
- `Dialog`: `{ children; size?; onCloseRequest(); title: ReactNode | false }`
  (`Dialog.tsx:24-29`).
- `TextField`: `{ onChange?(value:string); onKeyDown?; label?; placeholder? } & ({value}|{defaultValue})`
  (`TextField.tsx:17-32`). Use the `value`-controlled variant.
- `FilledButton`: used with `label` / `onClick` (`ShareDialog.tsx:126+`).

**Imports:** `Dialog`, `FilledButton`, `TextField` from `@excalidraw/excalidraw/components/*`;
`useState` from react; `t`/`useI18n` from `@excalidraw/excalidraw/i18n`; `KEYS` from
`@excalidraw/common` (Enter-to-submit, as ShareDialog does); `signInWithMagicLink` from
`../data/supabase/auth`.

---

### B.4 `excalidraw-app/components/SyncStatusButton.scss` (small)

A few rules co-located with the component (mirroring `ShareDialog.scss` / `LiveCollaborationTrigger.scss`
placement). Class root `.excalidraw-sync-status-button` with `--synced/--syncing/--error/--offline`
modifiers (color the icon: green/neutral/red/grey), a `.spin` keyframe for the syncing glyph, and a
`.excalidraw-sync-status-popover` panel (padding, separator, `Sync now` row hover). No design system
tokens are required; reuse `var(--color-...)` vars already in the app scss.

---

## C. Exact edit specs for existing files

All edits below are **gated by `isSupabaseSyncEnabled()`** so flag-off behavior is byte-for-byte
today's app. Add the import once near the other `./data` imports in `App.tsx`:

```ts
import { isSupabaseSyncEnabled } from "./data/supabase/featureFlags";
import { getSupabaseClient } from "./data/supabase/client";
import { createSupabaseFileCallbacks } from "./data/supabase/supabaseFiles";
import { useSupabaseSync } from "./data/supabase/useSupabaseSync";
import { FileManager } from "./data/FileManager";
import { SyncStatusButton } from "./components/SyncStatusButton";
import { SignInDialog } from "./components/SignInDialog";
import { userIdAtom, sessionAtom } from "./data/supabase/sessionAtom";
```

### C-1. `App.tsx` — construct FileManager + mount hook; `onChange`

**(a) Construct the Supabase FileManager + mount the hook.** Inside `ExcalidrawWrapper`, after
`const excalidrawAPI = useExcalidrawAPI();` (`App.tsx:374`) and the atom reads (`:406-411`):

```ts
// NEW — build once; null when flag off / no session yet
const userId = useAtomValue(userIdAtom);
const session = useAtomValue(sessionAtom);
const supabaseFileManager = useMemo(() => {
  if (!isSupabaseSyncEnabled()) return null;
  const client = getSupabaseClient();
  if (!client || !userId) return null;
  return new FileManager(createSupabaseFileCallbacks(client, userId));
}, [userId]);

const supabaseSync = useSupabaseSync({ excalidrawAPI, fileManager: supabaseFileManager });
const [signInOpen, setSignInOpen] = useState(false);
const syncStatusValue = useAtomValue(syncStatusAtom);   // for the button props
```
(`useMemo` must be added to the `react` import on `App.tsx:36`.)

**(b) `onChange` (`App.tsx:677-727`).** Current head:
```ts
// BEFORE (App.tsx:682-689)
if (collabAPI?.isCollaborating()) {
  collabAPI.syncElements(elements);
}
if (!LocalData.isSavePaused()) {
  LocalData.save(elements, appState, files, () => { /* file status */ });
}
```
```ts
// AFTER — collab branch is dead under the flag (collabAPI stays null, §C-5); add the sync call
if (collabAPI?.isCollaborating()) {        // unchanged; never true when flag on
  collabAPI.syncElements(elements);
}
if (!LocalData.isSavePaused()) {
  LocalData.save(elements, appState, files, () => { /* unchanged */ });
}
if (isSupabaseSyncEnabled()) {
  supabaseSync.notifyChange(elements, appState, files);   // NEW — fire-and-forget, NOT gated by isSavePaused
}
```
Guard: the new line is inside `if (isSupabaseSyncEnabled())`; flag-off ⇒ identical. `notifyChange`
itself no-ops when signed-out / offline-marks per the engine (HLD §3.3).

> Follow-up pinned (M2): the `isInitializedImageElement` reduce that builds `fileIds` for the
> post-pull file load lives in `useSupabaseSync.applyPulledFiles` (§B.1 step 4), copied verbatim
> from the local-load reduce at `App.tsx:463-469` so behavior matches the IDB path.

### C-2. `App.tsx` — `initializeScene` / `getCollaborationLinkData` under flag

`getCollaborationLinkData(window.location.href)` is called inside `initializeScene`
(`App.tsx:248`, per anchor map) and its result drives the collab branch at `App.tsx:327-359`.
Two-layer neutralization (belt + suspenders):

```ts
// AFTER — inside initializeScene, where roomLinkData is derived (~App.tsx:248)
const roomLinkData = isSupabaseSyncEnabled()
  ? null                                  // NEW: flag on ⇒ never treat as external collab scene
  : getCollaborationLinkData(window.location.href);
```
With `roomLinkData === null`, the `roomLinkData && opts.collabAPI` branch (`:327-359`) is never
entered, so `initializeScene` returns the local scene (`{ scene, isExternalScene:false }`) exactly
as for a no-hash load. (`data/index.ts` also hardens this — §C-6.) Also gate the `#json=` /`#url=`
import branches (`App.tsx:226-229 / 259-325`) behind `!isSupabaseSyncEnabled()` so dormant share
imports never run (HLD §5.2).

### C-3. `App.tsx` — `renderTopRightUI` (B1 restructure)

**Confirmed real signature:** `renderTopRightUI={(isMobile) => { … }}` — the callback receives
**only `isMobile`** (no second arg). Current guard (`App.tsx:955-958`):
```ts
// BEFORE
renderTopRightUI={(isMobile) => {
  if (isMobile || !collabAPI || isCollabDisabled) {   // ← flag-on: collabAPI is ALWAYS null → returns
    return null;
  }
  return ( <div className="excalidraw-ui-top-right"> … LiveCollaborationTrigger … </div> );
}}
```
```ts
// AFTER — evaluate the flag BEFORE the !collabAPI check (B1, HLD §5.1)
renderTopRightUI={(isMobile) => {
  if (isMobile) {
    return null;
  }
  if (isSupabaseSyncEnabled()) {
    return (
      <div className="excalidraw-ui-top-right">
        <SyncStatusButton
          status={syncStatusValue.status}
          lastSyncedAt={syncStatusValue.lastSyncedAt}
          error={syncStatusValue.error}
          onSyncNow={supabaseSync.syncNow}
          isSignedIn={!!userId}
          onRequestSignIn={() => setSignInOpen(true)}
        />
      </div>
    );
  }
  if (!collabAPI || isCollabDisabled) {     // original guard, now after the flag branch
    return null;
  }
  return ( <div className="excalidraw-ui-top-right"> … existing collab UI unchanged … </div> );
}}
```
This is the load-bearing B1 fix: because `<Collab>` is unmounted under the flag (§C-5),
`collabAPIAtom` is never set (`Collab.tsx:243`), so the old combined guard would `return null`
forever and the button would never render. Splitting `isMobile` out and putting the flag branch
**before** `!collabAPI` guarantees the button renders whenever the flag is on (DoD / SC3 / B1
regression test in §F).

### C-4. `App.tsx` — render `<SignInDialog>` + gate `<Collab>` / `<ShareDialog>` / command palette

**Mount the dialog** once near the other dialogs (e.g. beside `<ShareDialog>` at `App.tsx:1042`):
```ts
{isSupabaseSyncEnabled() && (
  <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
)}
```

**`<Collab>` gate (`App.tsx:1038-1040`):**
```ts
// BEFORE
{excalidrawAPI && !isCollabDisabled && (<Collab excalidrawAPI={excalidrawAPI} />)}
// AFTER
{excalidrawAPI && !isCollabDisabled && !isSupabaseSyncEnabled() && (
  <Collab excalidrawAPI={excalidrawAPI} />
)}
```

**`<ShareDialog>` (`App.tsx:1042-1057`)** — confirmed render takes `{ collabAPI, onExportToBackend }`
(`ShareDialog.tsx:267`). Wrap so it does not render under the flag:
```ts
// AFTER
{!isSupabaseSyncEnabled() && (
  <ShareDialog collabAPI={collabAPI} onExportToBackend={async () => { /* unchanged */ }} />
)}
```

**`onCollabDialogOpen` (`App.tsx:790-793`):** make it a no-op under the flag (callers also gated):
```ts
const onCollabDialogOpen = useCallback(() => {
  if (isSupabaseSyncEnabled()) return;
  setShareDialogState({ isOpen: true, type: "collaborationOnly" });
}, [setShareDialogState]);
```

**`isCollaborating` initial value (`App.tsx:408-410`):**
```ts
const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
  return isSupabaseSyncEnabled() ? false : isCollaborationLink(window.location.href);
});
```

**Command palette (`App.tsx:1069-1129`):** add predicates (today: LiveCollab has *no* predicate;
Share has `predicate: true`):
- "Live Collaboration" item (`:1069-1087`): add `predicate: () => !isSupabaseSyncEnabled()`.
- "Stop Session" (`:1088-1109`): already `predicate: () => !!collabAPI?.isCollaborating()` (naturally
  false when Collab unmounted). Optionally extend to `() => !isSupabaseSyncEnabled() && !!collabAPI?.isCollaborating()`.
- "Share" (`:1110-1129`): change `predicate: true` → `predicate: () => !isSupabaseSyncEnabled()`.

### C-5. `AppMainMenu.tsx` — hide LiveCollaboration, add Sync-now + auth items

**Confirmed:** `AppMainMenu` **does** take an `isCollabEnabled: boolean` prop (`AppMainMenu.tsx:21`),
gating `<MainMenu.DefaultItems.LiveCollaborationTrigger>` at `:31-36`. Call site is `App.tsx:986-992`
with `isCollabEnabled={!isCollabDisabled}` (`:989`).

**(a) Call-site change (`App.tsx:989`):**
```ts
// BEFORE
isCollabEnabled={!isCollabDisabled}
// AFTER
isCollabEnabled={!isCollabDisabled && !isSupabaseSyncEnabled()}
```
Pass new props for the auth/sync items:
```ts
<AppMainMenu
  onCollabDialogOpen={onCollabDialogOpen}
  isCollaborating={isCollaborating}
  isCollabEnabled={!isCollabDisabled && !isSupabaseSyncEnabled()}
  theme={appTheme}
  refresh={() => forceRefresh((prev) => !prev)}
  // NEW (flag-gated render inside the component):
  isSupabaseSyncEnabled={isSupabaseSyncEnabled()}
  isSignedIn={!!userId}
  userEmail={session?.user?.email ?? null}
  onSyncNow={supabaseSync.syncNow}
  onRequestSignIn={() => setSignInOpen(true)}
  onSignOut={() => signOut()}   // import signOut from ./data/supabase/auth at the App.tsx call or pass through
/>
```

**(b) `AppMainMenu.tsx` prop type + items.** Extend the props type:
```ts
export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  // NEW:
  isSupabaseSyncEnabled?: boolean;
  isSignedIn?: boolean;
  userEmail?: string | null;
  onSyncNow?: () => void;
  onRequestSignIn?: () => void;
  onSignOut?: () => void;
}> = React.memo((props) => { … });
```
The `LiveCollaborationTrigger` item already disappears via the `isCollabEnabled` change in (a) — no
edit to lines 31-36 needed. Add a new block (after `<MainMenu.Separator />` at `:41`, before the
Excalidraw+ link, mirroring HLD §2.5 mockup 2). Use `MainMenu.Item` (icons from
`@excalidraw/excalidraw/components/icons`):
```tsx
{props.isSupabaseSyncEnabled && (
  <>
    <MainMenu.Item icon={syncIcon} onSelect={() => props.onSyncNow?.()}
                   disabled={!props.isSignedIn}>
      Sync now
    </MainMenu.Item>
    {props.isSignedIn ? (
      <>
        <MainMenu.Item icon={userIcon} onSelect={() => {}}>{props.userEmail}</MainMenu.Item>
        <MainMenu.Item icon={logoutIcon} onSelect={() => props.onSignOut?.()}>Sign out</MainMenu.Item>
      </>
    ) : (
      <MainMenu.Item icon={loginIcon} onSelect={() => props.onRequestSignIn?.()}>
        Sign in to sync
      </MainMenu.Item>
    )}
    <MainMenu.Separator />
  </>
)}
```
(`MainMenu.Item` `disabled` prop is standard; if absent in this version, render the item with
`onSelect={() => props.isSignedIn && props.onSyncNow?.()}` and a greyed className instead.) The
existing Excalidraw+ "Sign in/Sign up" `ItemLink` (`:52-60`) may optionally be hidden under the flag
to avoid two "sign in" affordances (`{!props.isSupabaseSyncEnabled && <MainMenu.ItemLink …>}`).
**Guard:** the whole block is inside `props.isSupabaseSyncEnabled`; flag-off renders today's menu
exactly. `loginIcon` is already imported (`AppMainMenu.tsx:1-5`); add `syncIcon`/`userIcon`/`logoutIcon`
(or reuse existing glyph exports).

### C-6. `AppWelcomeScreen.tsx` — hide collab CTA under flag

**Confirmed:** the collab CTA is gated by `props.isCollabEnabled` already
(`AppWelcomeScreen.tsx:62-66`). No code change inside the component is required — the call site
(`App.tsx:993-996`) just needs the same flag fold-in:
```ts
// BEFORE (App.tsx:995)
<AppWelcomeScreen onCollabDialogOpen={onCollabDialogOpen} isCollabEnabled={!isCollabDisabled} />
// AFTER
<AppWelcomeScreen
  onCollabDialogOpen={onCollabDialogOpen}
  isCollabEnabled={!isCollabDisabled && !isSupabaseSyncEnabled()}
/>
```
This hides `WelcomeScreen.Center.MenuItemLiveCollaborationTrigger`. Flag-off ⇒ unchanged.

### C-7. `data/index.ts` — `getCollaborationLinkData` returns null under flag

**Confirmed (`data/index.ts:138-146`):**
```ts
// BEFORE
export const getCollaborationLinkData = (link: string) => {
  const hash = new URL(link).hash;
  const match = hash.match(RE_COLLAB_LINK);
  if (match && match[2].length !== 22) { window.alert(t("alerts.invalidEncryptionKey")); return null; }
  return match ? { roomId: match[1], roomKey: match[2] } : null;
};
```
```ts
// AFTER — hard-neutralize at the parser too (defense in depth with §C-2)
import { isSupabaseSyncEnabled } from "./supabase/featureFlags";   // add import
export const getCollaborationLinkData = (link: string) => {
  if (isSupabaseSyncEnabled()) {
    return null;
  }
  const hash = new URL(link).hash;
  const match = hash.match(RE_COLLAB_LINK);
  if (match && match[2].length !== 22) { window.alert(t("alerts.invalidEncryptionKey")); return null; }
  return match ? { roomId: match[1], roomKey: match[2] } : null;
};
```
(Leave `isCollaborationLink` unchanged — it is only used for the `is-collaborating` class init,
which §C-4 forces to `false` under the flag. Neutralizing both the consumer and the producer means
the `#room=` test in §F passes regardless of which path is exercised.)

### C-8. `vite-env.d.ts` — add 3 typings

**Confirmed `ImportMetaEnv` (`vite-env.d.ts:4-45`).** Add inside the interface (e.g. after
`VITE_APP_GIT_SHA` at `:39`):
```ts
  // Supabase sync (additive; sync + collab-disable gated by the feature flag)
  VITE_APP_SUPABASE_URL: string;
  VITE_APP_SUPABASE_ANON_KEY: string;        // anon/public key ONLY — never a service-role key
  VITE_APP_FEATURE_SUPABASE_SYNC: string;    // "true" to enable
```
No `vite.config.mts` change needed: `loadEnv(mode, "../")` + `envDir: "../"` (`vite.config.mts:13,23`)
already expose all `VITE_APP_*` to `import.meta.env`; there is no `define` allowlist.

### C-9. `app_constants.ts` — STORAGE_KEYS + debounce constant

**Confirmed `STORAGE_KEYS as const` (`app_constants.ts:39-53`); `SAVE_TO_LOCAL_STORAGE_TIMEOUT`
(`:2`).** (The prompt says `localStorage.ts`, but `STORAGE_KEYS` actually lives in `app_constants.ts`
and `localStorage.ts` imports it (`localStorage.ts:9`) — add to `app_constants.ts`.)
Add inside `STORAGE_KEYS` (e.g. after `VERSION_FILES` at `:46`):
```ts
  LOCAL_STORAGE_SUPABASE_META: "excalidraw-supabase-meta",   // persists localMeta { version }
```
And a time constant near `SAVE_TO_LOCAL_STORAGE_TIMEOUT` (`:2`):
```ts
export const SUPABASE_SYNC_DEBOUNCE_MS = 2000;   // network push debounce (vs 300ms localStorage)
```
(These two are *consumed* by the PART-1 engine; listed here because they are concrete edits to a
shared file the UI side touches. Coordinate so only one PR adds each line.)

### C-10. `excalidraw-app/package.json` — add dependency

**Confirmed deps block (`excalidraw-app/package.json:28-41`); no Supabase dep present.** Add:
```json
"@supabase/supabase-js": "^2.45.0",
```
(alphabetically near `@sentry/browser`). Then `yarn install` to refresh the lockfile.

---

## F. Test strategy + EXACT commands

**Runner = `vitest`** (confirmed: root `package.json` scripts — `test:app: "vitest"`,
`test:typecheck: "tsc"`, `test:code: "eslint …"`, `test:update: "vitest --update --watch=false"`).
Config: `vitest.config.mts` (`environment: "jsdom"`, `globals: true`, `setupFiles: ["./setupTests.ts"]`).
`import.meta.env.VITE_APP_*` is readable in tests (Vite injects it); to flip the flag per-test use
`vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true")` in `beforeEach` + `vi.unstubAllEnvs()` in
`afterEach` (vitest built-in). Tests live under `excalidraw-app/tests/` (existing: `collab.test.tsx`,
`MobileMenu.test.tsx`, `LanguageList.test.tsx`); data-layer unit tests may be colocated as
`*.test.ts` next to the module. The mock style mirrors `tests/collab.test.tsx:30-64`
(`vi.mock("../../excalidraw-app/data/firebase.ts", …)` + `vi.mock("socket.io-client", …)`).

### Test files + assertions

| File (path) | Asserts |
|---|---|
| `excalidraw-app/data/supabase/boardRepository.test.ts` | `serializeScene` strips ephemeral keys (no `scrollX/scrollY/zoom/selectedElementIds/…` in `app_state`) and drops deleted elements from `document`; `app_state` equals `stripEphemeral(clearAppStateForLocalStorage(...))`. `pushBoard` first-push uses `.insert(...)`; subsequent push issues guarded `.update({version: expected+1}).eq('user_id').eq('version', expected).select().maybeSingle()`. Conflict path: terminal resolves `{ data: null }` (0 rows) ⇒ caller re-pull signalled. `pullBoard` maps a row → `{ document, app_state, version, updated_at }`; `null` row ⇒ `null`. |
| `excalidraw-app/data/supabase/supabaseFiles.test.ts` | injected `saveFiles({ addedFiles })` calls `client.storage.from('scene-files').upload('${userId}/${fileId}', …, { upsert:true })` (assert exact path) and returns `savedFiles`/`erroredFiles` as `Map<FileId, BinaryFileData>`. `getFiles([id])` calls `.storage.from().download('${userId}/${id}')`, reconstructs `BinaryFileData` `{ id, dataURL, mimeType, created, lastRetrieved }` (assert `lastRetrieved` set), and returns `erroredFiles` as `Map<FileId, true>` for a missing/`error` download. |
| `excalidraw-app/data/supabase/syncEngine.test.ts` (**fake timers**) | `notifyChange` with a meaningful change debounces `SUPABASE_SYNC_DEBOUNCE_MS` → exactly one push; pan/zoom/selection-only change ⇒ no debounce armed, no push (M3). File-upload error keeps `dirty`, status `error`, **no version bump**, boards row **not** written, and `fileManager.reset()` called before retry (M5). `syncNow()` cancels debounce + flushes immediately. Offline (`navigator.onLine=false` / network-class error) ⇒ status `offline`, no network call, dirty retained. Version table: cloud-newer + not-dirty ⇒ cloud applied; dirty ⇒ local re-push `version+1`; null cloud ⇒ insert. |
| `excalidraw-app/tests/supabase-sync.test.tsx` (App-level + hook) | Flag **on**: render `<ExcalidrawApp/>`; assert `SyncStatusButton` IS in DOM. Drive a login (set `sessionAtom` via the mocked `onAuthStateChange` / `appJotaiStore.set(sessionAtom, …)`); assert the pull path calls `excalidrawAPI.updateScene` (spy), `addFiles`, and `updateStaleImageStatuses` (via the stale-image element status flipping to `error` for a missing file). Flag **off**: `SyncStatusButton` NOT rendered (and `LiveCollaborationTrigger` present as today). |
| `excalidraw-app/tests/disable.test.tsx` | Flag **on**: `getCollaborationLinkData("…#room=a,b")` returns `null`; with a `#room=` href, render `<ExcalidrawApp/>` → no `LiveCollaborationTrigger` in DOM, `is-collaborating` class absent, Share command predicate is `false`, `<Collab>`'s `socket.io-client` constructor never invoked, `getCollaborationLinkData`/`importFromBackend` not called for `#room=`/`#json=`. Existing `collab.test.tsx` runs flag **off** and stays green (R3). |

### Reusable `@supabase/supabase-js` mock skeleton (copy-paste; configurable per test)

Mirrors the `tests/collab.test.tsx` `vi.mock` style. Put the factory in a shared helper
(`excalidraw-app/tests/helpers/supabaseMock.ts`) and `vi.mock` in each test file.

```ts
// excalidraw-app/tests/helpers/supabaseMock.ts
import { vi } from "vitest";

/** A chainable Postgrest-style query builder. Every method returns the builder;
 *  the builder is itself awaitable (thenable) and resolves to { data, error }.
 *  Set the terminal result per-test via `builder.__resolve({ data, error })`. */
export const createQueryBuilder = (initial: { data: any; error: any } = { data: null, error: null }) => {
  let result = initial;
  const builder: any = {
    __resolve: (r: { data: any; error: any }) => { result = r; return builder; },
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    // make the builder awaitable for chains that don't end in single()/maybeSingle()
    then: (onF: any, onR: any) => Promise.resolve(result).then(onF, onR),
  };
  return builder;
};

export const createSupabaseMock = (overrides: {
  fromResult?: { data: any; error: any };
  uploadResult?: { data: any; error: any };
  downloadResult?: { data: any; error: any };   // data: Blob | null
  session?: any;
} = {}) => {
  const queryBuilder = createQueryBuilder(overrides.fromResult ?? { data: null, error: null });

  const storageBucket = {
    upload: vi.fn(() => Promise.resolve(overrides.uploadResult ?? { data: { path: "x" }, error: null })),
    download: vi.fn(() => Promise.resolve(overrides.downloadResult ?? { data: new Blob([""]), error: null })),
    remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
    list: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };

  let authCb: ((event: string, session: any) => void) | null = null;
  const mockClient = {
    from: vi.fn(() => queryBuilder),
    storage: { from: vi.fn(() => storageBucket) },
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: overrides.session ?? null }, error: null }),
      ),
      onAuthStateChange: vi.fn((cb: any) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
    },
    // test helpers:
    __queryBuilder: queryBuilder,
    __storageBucket: storageBucket,
    __emitAuth: (event: string, session: any) => authCb?.(event, session),
  };
  return mockClient;
};

// Singleton handle so tests can reach into the same client createClient() returns.
export let __supabaseMock = createSupabaseMock();
export const __resetSupabaseMock = (o?: Parameters<typeof createSupabaseMock>[0]) =>
  (__supabaseMock = createSupabaseMock(o));
```

Per-test wiring (top of each `*.test.ts(x)`):

```ts
import { __supabaseMock, __resetSupabaseMock } from "./helpers/supabaseMock";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => __supabaseMock,           // returns the current singleton
}));

beforeEach(() => {
  vi.stubEnv("VITE_APP_FEATURE_SUPABASE_SYNC", "true");
  vi.stubEnv("VITE_APP_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("VITE_APP_SUPABASE_ANON_KEY", "anon-test-key");
  __resetSupabaseMock();
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

// program a response in a test:
// __supabaseMock.__queryBuilder.__resolve({ data: { id, document: [], app_state: {}, version: 3 }, error: null });
// assert: expect(__supabaseMock.storage.from).toHaveBeenCalledWith("scene-files");
// assert: expect(__supabaseMock.__storageBucket.upload).toHaveBeenCalledWith(`${userId}/${fileId}`, expect.anything(), expect.objectContaining({ upsert: true }));
// drive auth: act(() => __supabaseMock.__emitAuth("SIGNED_IN", { user: { id: "u1", email: "a@b.co" } }));
```

> If `client.ts` memoizes `createClient` across tests, ensure the mock returns the live singleton
> (as above) and reset it in `beforeEach`; if the memo is module-level, add `vi.resetModules()` in
> `beforeEach` for the data-layer unit tests so each test gets a fresh `getSupabaseClient()`.

### EXACT commands

```bash
yarn test:typecheck                                   # tsc — type check everything
yarn vitest run excalidraw-app/tests/supabase-sync.test.tsx   # single file
yarn vitest run excalidraw-app/data/supabase/syncEngine.test.ts
yarn vitest run                                       # whole suite, once (no watch)
yarn test:code                                        # eslint (max-warnings=0)
yarn test:update                                      # update snapshots (vitest --update --watch=false)
```

---

## G. Build order (UI/wiring/tests) — relative to the data layer (lands first)

1. **(data layer first — PART 1):** `featureFlags.ts`, `client.ts`, `auth.ts`, `sessionAtom.ts`,
   `boardRepository.ts`, `supabaseFiles.ts`, `syncEngine.ts` + their unit tests; plus the shared
   constant edits `app_constants.ts` (`STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META`,
   `SUPABASE_SYNC_DEBOUNCE_MS`) and the `excalidraw-app/package.json` dep. **Blocks everything below.**
2. **Env + types:** `vite-env.d.ts` (3 typings) + root `.env.example` doc. (No `vite.config.mts`
   change.) — independent, do early so `import.meta.env` typechecks.
3. **`useSupabaseSync.ts`** — depends on `syncEngine`, `sessionAtom`, `supabaseFiles`,
   `boardRepository`, flag. Land with `useSupabaseSync.test.tsx`/the App-level pull test.
4. **`SyncStatusButton.tsx` (+ `.scss`)** — pure presentational; depends only on the status union.
   Unit-snapshot the 4 states.
5. **`SignInDialog.tsx`** — depends on `auth.signInWithMagicLink`. Independent of the engine.
6. **`AppMainMenu.tsx`** prop+items, **`AppWelcomeScreen.tsx`** call-site fold-in.
7. **`data/index.ts`** `getCollaborationLinkData` guard.
8. **`App.tsx` wiring (the big one):** imports; FileManager `useMemo`; `useSupabaseSync` mount;
   `onChange` notify; `renderTopRightUI` B1 restructure; `<Collab>`/`<ShareDialog>`/`onCollabDialogOpen`/
   `isCollaborating` init/command-palette guards; `<SignInDialog>` mount; `<AppMainMenu>`/`<AppWelcomeScreen>`
   prop pass-through. Land with `disable.test.tsx` + the App-level `supabase-sync.test.tsx`.
9. **Full regression:** `yarn test:typecheck`, `yarn vitest run`, `yarn test:code`; flag defaults
   off so the existing suite/snapshots (incl. `collab.test.tsx`) stay green.

---

## Summary (returned to caller)

UI/wiring files specced: `data/supabase/useSupabaseSync.ts` (owns SyncEngine in a ref; pull-on-login
→ `updateScene({captureUpdate: CaptureUpdateAction.NEVER})` + `addFiles` + `updateStaleImageStatuses`,
the `isInitializedImageElement` fileId reduce copied from App.tsx:463-469; flush on beforeunload/blur/
visibilitychange/unmount); `components/SyncStatusButton.tsx` (controlled; 4 states + Popover "Sync now"/
last-synced/sign-in; reuses package `Button`+`Popover`); `components/SignInDialog.tsx` (magic-link form
reusing `Dialog`+`TextField`+`FilledButton`, exactly as `share/ShareDialog.tsx` already does); plus a
small `SyncStatusButton.scss`. Auth decision: BOTH a `SignInDialog` AND MainMenu items (App owns one
`signInOpen` state).

App.tsx edit sites (verified anchors): imports (~`:96-115`); FileManager `useMemo` + hook mount after
`:374`; `onChange` notify after `:689`; `initializeScene` roomLinkData null-out at `:248`;
**`renderTopRightUI` B1 restructure at `:955-958`** (split `isMobile` out, flag branch BEFORE
`!collabAPI`); `<Collab>` gate `:1038`; `<ShareDialog>` gate `:1042`; `onCollabDialogOpen` `:790`;
`isCollaborating` init `:408`; command palette `:1069/1110`; `<SignInDialog>` mount near `:1042`;
`<AppMainMenu>`/`<AppWelcomeScreen>` prop fold-in `:986-996`. Other files: `AppMainMenu.tsx` (props
+items; LiveCollab item already gated by `isCollabEnabled`), `AppWelcomeScreen.tsx` (call-site only),
`data/index.ts:138` (`getCollaborationLinkData` → null), `vite-env.d.ts:39` (3 typings),
`app_constants.ts:39-53` (`STORAGE_KEYS` + `SUPABASE_SYNC_DEBOUNCE_MS`), `excalidraw-app/package.json`
(`@supabase/supabase-js ^2.45.0`).

Tests: `boardRepository.test.ts`, `supabaseFiles.test.ts`, `syncEngine.test.ts` (fake timers),
`tests/supabase-sync.test.tsx`, `tests/disable.test.tsx`. Full configurable `@supabase/supabase-js`
mock skeleton provided (chainable builder with update/insert/select/eq/single/maybeSingle as vi.fns,
thenable terminal; `storage.from()` upload/download; `auth` getSession/onAuthStateChange/signInWithOtp/
signOut), mirroring the `collab.test.tsx` `vi.mock` style; flag flipped per-test via `vi.stubEnv`.
Commands: `yarn test:typecheck`; `yarn vitest run <file>`; `yarn vitest run`; `yarn test:code`;
`yarn test:update`.

Where REAL code diverged from HLD assumptions:
1. **`renderTopRightUI` receives ONLY `isMobile`** (one arg) — confirmed `App.tsx:955`; the B1
   restructure is correct and necessary (flag-on ⇒ `collabAPI` always null ⇒ old combined guard
   returns before the button). ✔ matches HLD §5.1.
2. **`updateScene`/captureUpdate API name is `CaptureUpdateAction`** (enum), imported from
   `@excalidraw/excalidraw` (`index.tsx:366`); `.NEVER` for background pulls (App.tsx:574 / FileManager:294),
   `.IMMEDIATELY` for user-initiated (App.tsx:552). ✔ matches HLD.
3. **`AppMainMenu` DOES take `isCollabEnabled`** (`AppMainMenu.tsx:21`), gating the LiveCollab item
   at `:31-36`; passed from `App.tsx:989`. So the item is hidden purely via the call-site flag fold-in
   — no edit to lines 31-36. ✔ matches HLD §5.2. Same pattern in `AppWelcomeScreen.tsx:62`.
4. **Test scripts are at ROOT `package.json`, not `excalidraw-app/package.json`** (which has no test
   scripts). Runner is `vitest` (jsdom, `setupTests.ts`, `globals:true`). The prompt's commands all
   work. `import.meta.env` is available in tests; flip the flag with `vi.stubEnv`.
5. **`STORAGE_KEYS` lives in `app_constants.ts:39-53`, not `localStorage.ts`** (which only imports it).
   The new key + `SUPABASE_SYNC_DEBOUNCE_MS` go in `app_constants.ts`. (Prompt said `localStorage.ts`.)
6. **`useExcalidrawAPI()` returns `ExcalidrawImperativeAPI | null`** (`App.tsx:586`,
   `ExcalidrawAPIContext` typed `… | null` at `:558-559`) — so the hook param is correctly nullable.
7. UI primitives confirmed present and ALREADY used by `excalidraw-app/share/ShareDialog.tsx`
   (`Dialog`/`FilledButton`/`TextField` from `@excalidraw/excalidraw/components/*`), so `SignInDialog`
   has a direct, in-repo model. `Button`/`Popover`/`Island` also available for `SyncStatusButton`.
