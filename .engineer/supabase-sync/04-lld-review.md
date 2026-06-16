# 04-LLD Review — Supabase sync + disable collab/share

**Verdict: APPROVE-WITH-CHANGES**

The architecture is sound, honors the HLD, and the riskiest specs hold up against real code: all 21
`EPHEMERAL_APPSTATE_KEYS` exist and are `browser:true`; the `FileManager` constructor + two-different-
errored-map-value-types contract is exact; `CaptureUpdateAction.NEVER` exists and is re-exported from
`@excalidraw/excalidraw`; the SQL is valid Supabase DDL; the App.tsx line anchors are accurate (±a few
lines); the mock skeleton can satisfy every query chain the repo calls.

**But the two halves contradict each other on the central data↔UI seam.** The stitch page (04-lld.md
§3) and Part 1 describe `SyncEngine` one way; Part 2's "Consumed data-layer interfaces" block (lines
11–46) and its hook code describe it a materially *different* way. An implementer building the hook from
Part 2 would produce an engine the Part-1 engine author would not recognize. None of these are
compile-against-real-types failures (the real code is fine); they are **producer/consumer contract
mismatches between the two design halves** that will cause divergent parallel implementations. They are
all mechanical to reconcile, hence APPROVE-WITH-CHANGES rather than NEEDS-REVISION.

**Data↔UI seam (`applyRemoteScene`) consistently specified across both halves? — NO.** See B1/B2.

---

## BLOCKER

### B1. `applyRemoteScene` is specified two incompatible ways; Part 2 never implements the callback Part 1 requires
- **Where:** Part 1 §B.8 (`SyncEngineDeps.applyRemoteScene: (row: BoardRow) => Promise<void>`) +
  04-lld.md §3 ("`useSupabaseSync` implements that callback"); vs Part 2 §B.1 step 3 and the
  "Consumed interfaces" block.
- **What:** 04-lld.md §3 and Part 1 are explicit and agree with each other: the engine is constructed
  with a **`applyRemoteScene(row: BoardRow)` callback the hook provides**, and the engine *calls* it
  from inside `pullAndReconcile()` when "cloud wins" (Part 1 §B.8: `await deps.applyRemoteScene(cloud)`).
  Part 2 **does not provide this callback** anywhere. Instead Part 2 §B.1 step 2's `new SyncEngine({...})`
  passes only `{ fileManager, getScene, setStatus, boardRepository }` — **no `applyRemoteScene`** — and
  then invents a *different* mechanism in step 3: `engine.start(userId).then((applied) => { if
  (applied?.scene) excalidrawAPI.updateScene(...) })`, i.e. it expects `start()` to **return** the scene
  to apply (`Promise<{ scene: {document, app_state} }>`). Part 1's `start()` returns `Promise<void>`
  (§B.8) and applies via the injected callback, not a return value.
- **Why it's a blocker:** the producer (engine) and consumer (hook) disagree on *both* the direction of
  data flow (callback-in vs return-value-out) AND the payload type (engine passes a full `BoardRow`;
  hook's `applied.scene` is `{document, app_state}`, a `SerializedScene`, not a `BoardRow`). Built
  independently, the hook's `.then(applied => …)` will receive `undefined` (engine returns void and uses
  the callback the hook never passed), so **cloud-wins pulls silently never apply to the editor** —
  defeating SC1/SC2 and the §3.2 reconciliation. Part 2 even hedges this ("Whichever PART 1 chooses…")
  — that ambiguity is the bug: PART 1 *did* choose (`applyRemoteScene` callback), and PART 2 must
  conform, not offer an alternative.
- **Fix:** Make Part 2's hook construct the engine with the `applyRemoteScene` callback Part 1 defines,
  and delete the `start().then(applied => …)` apply path. Concretely, the hook's step-2 `new
  SyncEngine({...})` must include:
  ```ts
  applyRemoteScene: async (row: BoardRow) => {
    if (!excalidrawAPI) return;
    excalidrawAPI.updateScene({
      elements: restoreElements(row.document, null, { repairBindings: true }),
      appState: restoreAppState(row.app_state, null),
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    applyPulledFiles(row.document);
  }
  ```
  and step 3 becomes simply `userId ? engine.start(userId) : engine.stop()` (no `.then` apply). Note the
  callback takes a `BoardRow` (has `.document`/`.app_state`), matching Part 1.

### B2. Part 2's `SyncEngine` constructor + method signatures contradict Part 1's
- **Where:** Part 2 "Consumed data-layer interfaces" (lines 30–38) and §B.1 step 2; vs Part 1 §B.8
  `SyncEngineDeps`.
- **What:** Three concrete mismatches in the constructor/method contract:
  1. **deps list.** Part 1: `{ client, getUserId, fileManager, getScene, setStatus, applyRemoteScene }`
     (6 deps). Part 2 line 31 and step 2: `{ boardRepository, fileManager, setStatus, getScene }`. Part 2
     **omits `client`, `getUserId`, and `applyRemoteScene`**, and **adds `boardRepository`** (a module
     Part 1's engine imports directly via `import { pullBoard, pushBoard, … } from "./boardRepository"`,
     §B.8 Imports — it is *not* injected). So the hook would inject a dep the engine doesn't accept, and
     fail to inject three the engine requires.
  2. **`client`/`getUserId` unprovided.** Part 1's engine needs a `SupabaseClient` and a `getUserId: ()
     => string | null` (it reads `userIdAtom` imperatively and passes `client`+`userId` into
     `pullBoard`/`pushBoard`). Part 2's hook never passes either. The hook *can* provide them
     (`getSupabaseClient()` and `() => appJotaiStore.get(userIdAtom)`), but as written it doesn't —
     leaving the engine unable to make any Supabase call.
  3. **`notifyChange` arity.** Part 1 §B.8: `notifyChange(): void` (no args — engine pulls the scene via
     `getScene()` it was constructed with). Part 2 lines 34 & §B.1 step 6: `notifyChange(els, appState,
     files): void` (3 args). Both halves can't be right. Since Part 1's engine already holds `getScene`,
     the args are redundant; pick one. (04-lld.md §3 note sides with "the engine own the debounce and
     notifyChange … via a ref held by the hook" but doesn't resolve arity.)
- **Why it's a blocker:** parallel tasks (engine task vs hook task in 05-tasks.md) will compile against
  incompatible signatures; the `new SyncEngine({...})` call site won't typecheck against the engine's
  declared `SyncEngineDeps`, and `yarn test:typecheck` (the gate the LLD itself mandates) will fail.
- **Fix:** Declare **Part 1 §B.8 `SyncEngineDeps` as the single source of truth** and correct Part 2's
  "Consumed interfaces" block + step-2 construction to match it exactly:
  ```ts
  engineRef.current = new SyncEngine({
    client,                                   // from getSupabaseClient()
    getUserId: () => appJotaiStore.get(userIdAtom),
    fileManager,
    getScene: () => ({ elements: …, appState: …, files: … }),
    setStatus: setSyncStatus,
    applyRemoteScene,                          // per B1
  });
  ```
  Drop `boardRepository` from the injected deps (engine imports it). Standardize `notifyChange()` to
  **no args** (Part 1) and have the hook's `onChange` adapter call `engineRef.current?.notifyChange()`
  (the engine reads the scene itself). If the no-arg form is chosen, Part 2's
  `notifyChange(els,appState,files)` in `UseSupabaseSyncResult` and §C-1(b)
  `supabaseSync.notifyChange(elements, appState, files)` must also drop their args.

---

## MAJOR

### M1. Part 2's "Consumed interfaces" mis-states three more Part-1 signatures
- **Where:** Part 2 lines 13–46 vs Part 1 §B.3/§B.6/§B.7.
- **What:**
  - **`signOut`/`onAuthStateChange` return shapes.** Part 2 line 21: `signOut(): Promise<void>`; Part 1
    §B.3: `signOut(): Promise<{ error: AuthError | null }>`. Part 2 line 22: `onAuthStateChange(cb):
    { unsubscribe(): void }`; Part 1 §B.3: `onAuthStateChange(cb): () => void` (returns an unsubscribe
    **function**, not an object). Also Part 2's `cb` is `(session) => …` while Part 1's is `(event,
    session) => …`.
  - **`pushBoard`/`pullBoard` arity + return.** Part 2 lines 41–42: `pullBoard(userId)`,
    `pushBoard(userId, scene, expectedVersion): Promise<{version; updated_at}>`. Part 1 §B.6:
    `pullBoard(client, userId)`, `pushBoard(client, userId, scene, expectedVersion):
    Promise<PushResult>` where `PushResult = {ok:true; version; updatedAt} | {ok:false; conflict:true}`.
    Part 2 omits the `client` arg and flattens the discriminated-union return to a bare
    `{version, updated_at}` — losing the conflict signal the engine branches on.
  - **`createSupabaseFileCallbacks` return shape.** Part 2 lines 44–45 claims it returns `{ getFiles;
    saveFiles; onFileStatusChange }`. Part 1 §B.7 returns only `{ getFiles; saveFiles }`
    (`SupabaseFileCallbacks`); `onFileStatusChange` is added separately by `createSupabaseFileManager`.
- **Why major not blocker:** these are consumed by the hook/UI, and §A note in Part 2 says it "consumes
  interfaces as declared in the HLD and never re-specs their internals" — so Part 1 wins by the doc's own
  rule. But the mis-statements will still mislead an implementer reading Part 2 in isolation (e.g.
  calling `signOut().then()` expecting void, or destructuring `{version}` off a `PushResult` that may be
  `{ok:false}`).
- **Fix:** Replace Part 2's "Consumed interfaces" block with a verbatim copy (or direct reference) of the
  Part 1 §B export signatures, including the `client` first-arg on repo fns and the `PushResult` union.

### M2. App.tsx FileManager is constructed two ways across the doc set
- **Where:** Part 2 §C-1(a): `new FileManager(createSupabaseFileCallbacks(client, userId))`. Part 1 §B.7
  exports `createSupabaseFileManager(client, userId): FileManager` that *already* does
  `new FileManager({ onFileStatusChange: …, ...createSupabaseFileCallbacks(...) })`.
- **What:** Part 2 calls `new FileManager(createSupabaseFileCallbacks(...))` directly — which **omits
  `onFileStatusChange`**, so `FileStatusStore` is never driven and the export-wait / image-status UI
  (which Part 1 §B.7 and HLD §3.2 step 4 rely on via `updateStaleImageStatuses` + `onFileStatusChange`)
  silently breaks. Part 1 provides the correct convenience factory precisely to avoid this, but Part 2
  doesn't use it.
- **Why major:** functional regression (broken image status / stale-image handling on pull), not a
  compile error (`createSupabaseFileCallbacks` alone is a valid `FileManager` ctor arg).
- **Fix:** In §C-1(a) use `supabaseFileManager = useMemo(() => { … return createSupabaseFileManager(client,
  userId); }, [userId])` (import `createSupabaseFileManager` instead of `createSupabaseFileCallbacks` +
  `FileManager`). Or, if constructing inline, include `onFileStatusChange:
  FileStatusStore.updateStatuses.bind(FileStatusStore)`.

### M3. `useSupabaseSync` needs `syncStatusAtom`'s setter + `boardRepository`/`client`/`appJotaiStore` imports it doesn't list
- **Where:** Part 2 §B.1 step 2 uses `setStatus: setSyncStatus` and `boardRepository`; the Imports list
  (lines 106–112) imports `syncStatusAtom` and `userIdAtom` but **not** `appJotaiStore`, not
  `getSupabaseClient`, and the body never derives `setSyncStatus` (it reads `syncStatus` via
  `useAtomValue` but a *setter* — `useSetAtom(syncStatusAtom)` — is needed for `setStatus`).
- **What:** After fixing B2 (engine needs `client` + `getUserId`), the hook must additionally import
  `getSupabaseClient` from `./client` and `appJotaiStore` from `../../app-jotai` (for the imperative
  `getUserId`), and must add `const setSyncStatus = useSetAtom(syncStatusAtom)`. None are in the listed
  imports/body.
- **Why major:** without the setter the engine's status transitions never reach the atom → the
  `SyncStatusButton` never updates (defeats SC3/§3.1). Without `client`/`appJotaiStore` the engine can't
  be constructed per the corrected B2.
- **Fix:** Add to §B.1 imports: `getSupabaseClient` from `./client`, `appJotaiStore` from
  `../../app-jotai`; add `const setSyncStatus = useSetAtom(syncStatusAtom)` in the body; obtain `client`
  via `getSupabaseClient()` (guard null) before `new SyncEngine`.

---

## MINOR

### m1. `signInWithMagicLink` return type mismatch in Part 2 (`Error` vs `AuthError`)
- Part 2 line 19: `signInWithMagicLink(email): Promise<{ error: Error | null }>`; Part 1 §B.3:
  `Promise<{ error: AuthError | null }>`. `AuthError extends Error`, so the SignInDialog's
  `setError(error.message)` works either way, but the declared types differ. Align Part 2 to `AuthError`.

### m2. SQL: `gen_random_uuid()` and `pgcrypto` — confirm availability, no precedent in repo
- Part 1 §A uses `gen_random_uuid()`. There are **no existing migrations** in `supabase/migrations/`
  (the dir doesn't yet exist) to confirm the convention. On Supabase/Postgres 13+ `gen_random_uuid()` is
  in core `pgcrypto`, enabled by default on hosted Supabase — so `supabase db push` will succeed. This is
  fine as-is; just flagging there's no in-repo precedent. Optional hardening: prepend
  `create extension if not exists pgcrypto;` (or use `uuid-ossp`'s `uuid_generate_v4()`), though
  unnecessary on hosted Supabase. No change required.

### m3. SQL: storage RLS `update` policy is correct but worth a note on `name` column
- Part 1 §A `scene_files_*` policies use `(storage.foldername(name))[1] = auth.uid()::text`. This is the
  documented Supabase idiom and valid; `storage.foldername()` returns `text[]`, `[1]` is the first
  segment (Postgres arrays are 1-indexed), matching the `${userId}/${fileId}` path in §B.7. RLS is
  enabled implicitly on `storage.objects` by Supabase (the migration doesn't — and shouldn't —
  `alter table storage.objects enable row level security`, which would require owner privileges). Correct
  as written. No change.

### m4. `CaptureUpdateAction` called an "enum"; it is a `const` object
- 04-lld.md §6 and Part 2 §B.1 call `CaptureUpdateAction` an "enum exported from @excalidraw/excalidraw".
  It is actually `export const CaptureUpdateAction = {…} as const` (`packages/element/src/store.ts:38`),
  re-exported at `index.tsx:366`. `.NEVER` and `.IMMEDIATELY` members exist and the usage
  (`captureUpdate: CaptureUpdateAction.NEVER`) is correct. Purely a wording nit; no code impact.

### m5. Anchor drift: `<Collab>`/`<ShareDialog>` render gate
- Part 2 §C-4 cites `<Collab>` at `App.tsx:1038-1040` and `<ShareDialog>` at `:1042`; actual is
  ~1037–1039 and ~1042 on `online-sync`. Within the doc's stated "±a few lines" tolerance; the BEFORE
  snippets match the real code exactly. No change needed; implementers should match on the code snippet,
  not the line number.

### m6. Part 2's `notifyChange` "no-op when flag off / signed-out" relies on engine guard not shown in hook
- Part 2 §C-1(b) wraps the notify call in `if (isSupabaseSyncEnabled())` AND the hook's `notifyChange`
  is `engineRef.current?.notifyChange(...)`. When flag is off, `engineRef.current` is null (step 2
  early-returns), so it no-ops correctly. Consistent — just confirming the double-guard is intentional
  and harmless. No change.

---

## NITS

### n1. `signInWithEmail` alias optionality
- Part 1 offers `signInWithEmail` as an optional alias; 04-lld.md §5 says "UI imports
  `signInWithMagicLink`" and Part 2 §B.3 imports `signInWithMagicLink`. Consistent. The alias is dead
  code unless something imports it; consider dropping it to avoid an unused export lint hit under
  `test:code` (max-warnings=0). Minor.

### n2. `MainMenu.Item disabled` prop uncertainty
- Part 2 §C-5(b) hedges "if `disabled` absent in this version, render with a greyed className". Worth a
  60-second confirmation against `packages/excalidraw` MainMenu before implementation so the task isn't
  blocked mid-flight, but the fallback is specified, so not blocking.

---

## Spot-check results (for the record)

| Check | Result |
|---|---|
| All 21 `EPHEMERAL_APPSTATE_KEYS` exist + `browser:true` | **PASS** — verified each at `appState.ts:150-256` (scrollX 220, scrollY 221, zoom 242, scrolledOutside 219, shouldCacheIgnoreZoom 231, selectedElementIds 222, selectedGroupIds 224, previousSelectedElementIds 217, selectedLinearElement 245, editingGroupId 180, openMenu 213, openSidebar 215, cursorButton 176, lastPointerDownWith 207, stats 232, activeTool 181, preferredSelectionTool 182, zenModeEnabled 241, objectsSnapModeEnabled 248, penMode 183, penDetected 184). No invented keys. |
| `clearAppStateForLocalStorage` signature | **PASS** — `appState.ts:283`, returns `browser` subset. |
| FileManager ctor + errored-map value types | **PASS** — ctor `FileManager.ts:45-65`; `_getFiles` errored `Map<FileId,true>` (50-53); `_saveFiles` errored `Map<FileId,BinaryFileData>` (54-57); public `saveFiles({elements,files})` 92; `getFiles` 139; no-retry latch comment 107; `reset()` 212-225. All exact. |
| `new FileManager({...})` is real usage + Collab mirror | **PASS** — `Collab.tsx:152-200` matches Part 1's described composition incl. `addedFiles.get(id)` reduce for both maps. |
| SQL valid Supabase | **PASS** — RLS enabled before policies; `gen_random_uuid()` core-available; `storage.foldername(name)[1]` idiom correct; no syntax errors; idempotent guards present. (See m2/m3.) |
| `CaptureUpdateAction.NEVER` exported from `@excalidraw/excalidraw` | **PASS** — `index.tsx:366` re-exports from `@excalidraw/element` (`store.ts:38`, `.NEVER` at :56). (const object, not enum — m4.) |
| App.tsx anchors (renderTopRightUI single-arg + early-return, onChange, menu call sites, isCollaborating init, Collab/ShareDialog, command palette) | **PASS** — `renderTopRightUI={(isMobile) => { if (isMobile||!collabAPI||isCollabDisabled) return null }` at :955; onChange :677; `isCollabEnabled={!isCollabDisabled}` :989/:995; isCollaborating init :408; LiveCollab cmd item no predicate, Share `predicate:true`. AppMainMenu `isCollabEnabled` prop at :21. |
| Mock skeleton satisfies repo's query chains | **PASS** — `.from().select().eq().maybeSingle()`, `.from().insert().select().single()`, `.from().update().eq().eq().select().maybeSingle()`, `.storage.from().upload()/.download()`, `.auth.*` all covered; builder is thenable + has `single`/`maybeSingle`. |
| Element/restore imports (`getNonDeletedElements`, `isInitializedImageElement`, `restoreElements`, `restoreAppState`) | **PASS** — `getNonDeletedElements` `element/src/index.ts:48`; `isInitializedImageElement` `typeChecks.ts:34` (re-exported via `export *`); `restoreElements` `restore.ts:764`, `restoreAppState` :1013. ExcalidrawImperativeAPI `updateScene`/`addFiles`/`getFiles`/`getAppState`/`getSceneElementsIncludingDeleted` all present in `types.ts`. |
