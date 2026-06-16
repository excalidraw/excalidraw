# 04 — Low-Level Design (Supabase sync; disable collab + share)

This LLD was produced in two parallel halves and stitched here:
- **Part 1 — Data/backend layer:** [`04-lld-part1-data.md`](./04-lld-part1-data.md) — SQL migration (§A), data-layer
  file interfaces (§B-data), finalized `EPHEMERAL_APPSTATE_KEYS` (§D), data error handling (§E), build order (§G).
- **Part 2 — UI / App.tsx wiring / tests:** [`04-lld-part2-ui-tests.md`](./04-lld-part2-ui-tests.md) — UI + hook
  interfaces (§B-ui), exact edit specs for existing files (§C), test strategy + mock skeleton + exact commands (§F),
  build order (§G).

Read both in full before implementing. This page records the **cross-cutting reconciliation** between the two halves
and the **divergences from the HLD** that implementers must honor.

---

## ⚖️ NORMATIVE Engine ↔ Hook contract (resolves LLD-review B1, B2, M1, M2, M3)

The combined-LLD review found the two halves describe the engine↔hook seam differently. **Part 1's
data-layer signatures are AUTHORITATIVE.** Where Part 2 (§B-ui / §C) disagrees, follow THIS section.
Implementers MUST build to these exact signatures.

**(B2) `SyncEngine` construction — authoritative deps (from Part 1 §B):**
```ts
export interface SyncEngineDeps {
  client: SupabaseClient;                          // from getSupabaseClient() (non-null; engine only created when signed in + flag on)
  getUserId: () => string | null;                  // reads userIdAtom imperatively (appJotaiStore.get)
  fileManager: FileManager;                         // the composed Supabase FileManager (see M2 below)
  getScene: () => { elements: readonly OrderedExcalidrawElement[]; appState: Partial<AppState>; files: BinaryFiles };
  setStatus: (next: SyncStatusState) => void;       // hook wires this to appJotaiStore.set(syncStatusAtom, next)
  applyRemoteScene: (row: BoardRow) => Promise<void>; // hook supplies this (see B1)
}
class SyncEngine {
  constructor(deps: SyncEngineDeps);
  start(userId: string): Promise<void>;  // runs the initial pull+reconcile; applies via deps.applyRemoteScene
  stop(): void;
  notifyChange(): void;                   // NO ARGS — engine pulls current scene via deps.getScene()
  syncNow(): Promise<void>;
  flush(): Promise<void>;
  dispose(): void;
}
```
- The engine imports `boardRepository` functions **directly** (`pullBoard`, `pushBoard`, `serializeScene`).
  Do **NOT** inject a `boardRepository` object (Part 2 §C-1 showed that — it's wrong).
- `notifyChange()` takes **no args** (Part 2's `notifyChange(elements, appState, files)` is wrong; the engine
  reads `deps.getScene()`).

**(B1) `applyRemoteScene` — the hook IMPLEMENTS it; the engine CALLS it.** The engine never returns a scene
for the hook to apply. Delete any `engine.start().then(applied => …apply…)` pattern (Part 2 had this). The hook
passes a callback at construction:
```ts
// inside useSupabaseSync:
const applyRemoteScene = useCallback(async (row: BoardRow) => {
  if (!excalidrawAPI) return;
  excalidrawAPI.updateScene({
    elements: restoreElements(row.document, null),
    appState: restoreAppState(row.app_state, excalidrawAPI.getAppState()),
    captureUpdate: CaptureUpdateAction.NEVER,            // const object member, re-exported from @excalidraw/excalidraw
  });
  // files: mirror App.tsx ~463-469 + ~500-508
  const fileIds = row.document.reduce<FileId[]>((acc, el) =>
    (!el.isDeleted && isInitializedImageElement(el)) ? [...acc, el.fileId] : acc, []);
  const { loadedFiles } = await fileManager.getFiles(fileIds);
  if (loadedFiles.length) excalidrawAPI.addFiles(loadedFiles);
  updateStaleImageStatuses({ excalidrawAPI, erroredFiles: /* from getFiles */, elements: excalidrawAPI.getSceneElementsIncludingDeleted() });
}, [excalidrawAPI, fileManager]);
const engine = useMemo(() => new SyncEngine({ client, getUserId, fileManager, getScene, setStatus, applyRemoteScene }), [...]);
```

**(M2) FileManager construction — use `createSupabaseFileManager(client, userId)` (Part 1 §B), NOT a bare
`new FileManager(createSupabaseFileCallbacks(...))`.** The factory wires `onFileStatusChange` to
`FileStatusStore.updateStatuses` so image-loading status renders correctly. Part 2 §C-1 omitted this.

**(M3) The hook MUST own the status setter + imports.** `useSupabaseSync` needs:
`const setStatus = useSetAtom(syncStatusAtom)` (or `appJotaiStore.set(syncStatusAtom, …)`), plus imports of
`getSupabaseClient`, `appJotaiStore`, `userIdAtom`, `restoreElements`/`restoreAppState`, `CaptureUpdateAction`,
`isInitializedImageElement`, `updateStaleImageStatuses`. Without the setter the SyncStatusButton never updates.

**(M1) Consumed-interface signatures the hook/UI must use VERBATIM (from Part 1):**
- `pullBoard(client, userId) => Promise<BoardRow | null>`
- `pushBoard(client, userId, scene, expectedVersion) => Promise<PushResult>` where
  `PushResult = { ok: true; version: number } | { ok: false; conflict: true }` — keep the union; do not flatten.
- `createSupabaseFileCallbacks(client, userId) => { getFiles, saveFiles }` (and `createSupabaseFileManager(client, userId) => FileManager`).
- `signInWithMagicLink(email) => Promise<{ error: AuthError | null }>`; `signOut() => Promise<{ error }>`;
  `onAuthStateChange(cb) => { data: { subscription } }` (call `.subscription.unsubscribe()` on cleanup).

> These five fixes are **doc reconciliations only** — the architecture is unchanged. The implementer of the hook
> task (and the engine task) must treat Part 1 as the contract and this section as the tie-breaker.

---

## Reconciliation & ground-truth corrections (BOTH halves agree)

1. **`STORAGE_KEYS` is in `excalidraw-app/app_constants.ts` (~lines 39–53), NOT `data/localStorage.ts`.**
   Both new constants — `LOCAL_STORAGE_SUPABASE_META` (`"excalidraw-supabase-meta"`, stores `{version, lastSyncedAt}`)
   and `SUPABASE_SYNC_DEBOUNCE_MS` (2000) — go in `app_constants.ts`. (HLD/earlier prompts said `localStorage.ts`.)

2. **`@supabase/supabase-js`**: absent from `excalidraw-app/package.json` but already resolved in `node_modules`
   (v2.45.4, hoisted at repo root). Imports + tests work today. **Still add an explicit `"@supabase/supabase-js": "^2.45.0"`**
   to `excalidraw-app/package.json` for correctness/reproducibility. (Tests can run before the explicit add because it's hoisted.)

3. **Data↔UI seam (the one important contract between halves):** `SyncEngine` is framework-free and MUST NOT touch
   `excalidrawAPI`. Applying a pulled board (HLD §3.2 steps 3–4: `updateScene` + `getFiles`→`addFiles`→
   `updateStaleImageStatuses`) is injected into the engine as a `deps.applyRemoteScene(row)` callback. **`useSupabaseSync`
   implements that callback.** Part 1 specs the engine expecting `applyRemoteScene`; Part 2 specs the hook providing it.

4. **`renderTopRightUI(isMobile)` takes a SINGLE arg** and early-returns `null` when `collabAPI` is falsy
   (App.tsx ~955–958). Because the Supabase path unmounts `<Collab>` (so `collabAPIAtom` is never set), the B1 fix is
   mandatory: when `isSupabaseSyncEnabled()`, render `<SyncStatusButton/>` **before** the `!collabAPI` early-return.

5. **`signInWithMagicLink(email)` is the canonical auth wrapper name** (HLD §1.1 called it `signInWithEmail`; Part 1
   exports `signInWithMagicLink` with an optional `signInWithEmail` alias). **UI imports `signInWithMagicLink`.**

6. **`CaptureUpdateAction`** (enum exported from `@excalidraw/excalidraw`) is the real scene-apply control:
   `CaptureUpdateAction.NEVER` for the pull-apply (don't pollute undo history); `.IMMEDIATELY` for user-initiated.

7. **`AppMainMenu` already takes `isCollabEnabled`** (prop, ~line 21) and `AppWelcomeScreen` similarly. So hiding the
   Live-Collaboration item needs **no edit to the menu item itself** — just fold the flag into the call site:
   `isCollabEnabled={!isCollabDisabled && !isSupabaseSyncEnabled()}` (App.tsx ~989, ~995). New Sync-now + auth items are
   added inside `AppMainMenu`.

8. **FileManager no-retry (load-bearing):** the public `saveFiles` will NOT retry a previously-errored file unless
   `fileManager.reset()` is called first (FileManager.ts ~107). The push pipeline MUST `reset()` before a retry push.

9. **FileManager errored-map value types differ** (confirmed): injected `_getFiles` erroredFiles is `Map<FileId, true>`;
   `_saveFiles` erroredFiles is `Map<FileId, BinaryFileData>`. `supabaseFiles.ts` matches both.

10. **`dataURL ↔ Blob`**: no existing shared util fits (only the compress+encrypt `encodeFilesForUpload` path). Part 1
    specs a small local util inside `supabaseFiles.ts`. `BinaryFileData` fields to reconstruct on download:
    `{ id, mimeType, dataURL, created, lastRetrieved }`.

11. **Test infra:** runner is **vitest**; test scripts live at the **ROOT** `package.json` (`test`, `test:typecheck`,
    `test:code`, `test:update`), not `excalidraw-app/package.json`. `import.meta.env` is readable in tests; flip the
    feature flag per-test with `vi.stubEnv`. Module mocks follow the existing `vi.mock(...)` style in
    `excalidraw-app/tests/collab.test.tsx`.

12. **Shared-file edit ownership (avoid collisions):** `excalidraw-app/app_constants.ts` and
    `excalidraw-app/package.json` are each touched by both halves' concerns → **each must be edited by exactly ONE task**
    (assigned in 05-tasks.md) to avoid merge conflicts between parallel implementation tasks.

---

## Finalized ephemeral appState decision (from §D)

Tool/mode UI state — `activeTool`, `preferredSelectionTool`, `zenModeEnabled`, `objectsSnapModeEnabled`, `penMode`,
`penDetected` — is treated as **EPHEMERAL** (excluded from the cloud `document`/`app_state` payload AND from the
dirty-check) alongside viewport/selection/menu keys. Rationale: switching tools or toggling zen/snap is local UI
intent, not document content; pushing it would cause spurious cloud writes and cross-device "tool jumps."
Document-flavored prefs are KEPT: `theme`, `name`, grid settings, `currentItem*`, `viewBackgroundColor`,
`lockedMultiSelections`. The exact exported `EPHEMERAL_APPSTATE_KEYS` constant is in Part 1 §D (copy-pasteable).

---

## Test commands (authoritative — used by implementers and in REGRESSION)

```bash
yarn test:typecheck                                  # TS typecheck (must stay green)
yarn vitest run excalidraw-app/tests/<file>          # single new test file
yarn vitest run                                      # full suite (regression vs baseline: 1403 passed)
yarn test:code                                       # lint
yarn test:update                                     # update snapshots (only when a change legitimately alters one)
```

See Part 2 §F for the full per-file test list and the reusable `@supabase/supabase-js` mock skeleton.

---

## Combined build order (informs task breakdown in 05-tasks.md)

1. **Config/foundation:** `package.json` dep, `vite-env.d.ts` typings, `app_constants.ts` keys, `featureFlags.ts`,
   `client.ts`.
2. **SQL migration** (`supabase/migrations/0001_init_boards.sql`) — independent; can land in parallel.
3. **Types + repo + files:** `ephemeralAppState.ts`, `boardRepository.ts`, `supabaseFiles.ts`.
4. **Atoms + auth:** `syncStatusAtom.ts`, `sessionAtom.ts`, `auth.ts`.
5. **Engine:** `syncEngine.ts` (depends on repo + files + atoms).
6. **Hook:** `useSupabaseSync.ts` (depends on engine + repo + files + session; provides `applyRemoteScene`).
7. **UI:** `SyncStatusButton.tsx` (+scss), `SignInDialog.tsx`.
8. **App wiring:** App.tsx (FileManager construct + hook mount + onChange notify + renderTopRightUI B1 + initial data).
9. **Disable edits (flag-gated):** App.tsx (`getCollaborationLinkData`/initializeScene), `data/index.ts`,
   `AppMainMenu.tsx` (+ call site), `AppWelcomeScreen.tsx` (call site).
10. **Tests:** data-layer tests → engine test → hook/UI tests → disable-verification test.
11. **Docs/env:** `.env.example`, setup README.

---

_Detailed contracts, full SQL, the ephemeral-keys constant, the mock skeleton, and every before/after edit sketch live
in the two part files linked at the top._
