# 03 — HLD Review: Supabase-backed Sync

**Verdict: APPROVE-WITH-CHANGES**

The design is well-grounded, line-anchors are largely accurate, and the core architecture
(local-first + fire-and-forget cloud replication, one-row LWW, blob document + Storage files,
flag-gated dormancy of collab/share) is the right shape for the stated single-session product.
However there are **2 blockers** and **5 majors** that will cause incorrect behavior or wasted
implementation effort if not fixed before LLD/coding. Most are integration-contract mismatches and
LWW correctness holes, not architecture problems.

Counts: **2 blocker, 5 major, 6 minor, 4 nit.**

---

## BLOCKERS

### B1. `renderTopRightUI` returns `null` when `collabAPI` is null — SyncStatusButton will never render with the flag on
**Location:** HLD §5 table row "LiveCollaborationTrigger in renderTopRightUI"; real code `App.tsx:955-958`.
**Issue:** The HLD says:
> "The `if (isMobile || !collabAPI || isCollabDisabled)` guard stays; we add the flag branch."
But the real guard is:
```ts
renderTopRightUI={(isMobile) => {
  if (isMobile || !collabAPI || isCollabDisabled) {
    return null;
  }
  ...
```
With the flag on, the HLD also unmounts `<Collab>` (§5 row "`<Collab>` render", `App.tsx:1038-1040`),
which means `collabAPIAtom` is **never set** (it is only set in `Collab.componentDidMount`,
`Collab.tsx:243`), so `collabAPI` stays `null`. The guard therefore returns `null` *before* reaching
any branch that could render `<SyncStatusButton/>`. As written, the two §5 decisions contradict each
other: you cannot both "render `<SyncStatusButton/>` in its place" here AND keep this guard AND unmount
Collab. The Sync button (a DoD item, SC3) would never appear.
**Fix:** Restructure the early-return so the flag path is evaluated independently of `collabAPI`:
```ts
renderTopRightUI={(isMobile) => {
  if (isMobile) return null;
  if (isSupabaseSyncEnabled()) {
    return <div className="excalidraw-ui-top-right"><SyncStatusButton .../></div>;
  }
  if (!collabAPI || isCollabDisabled) return null;
  return (/* existing collab UI */);
}}
```
Call this out explicitly in the LLD; the current §5 phrasing ("the guard stays") is wrong.

### B2. The `FileManager` "subclass" plan misstates the real contract; subclassing is the wrong integration
**Location:** HLD §1.1 (`SupabaseFileManager.ts` row), §3.4; real code `FileManager.ts:45-65`, `92-180`; reference impl `Collab.tsx:152-200`.
**Issue:** Two problems.
1. **Subclassing is not how this works and not needed.** `FileManager` is a concrete class whose
   storage I/O is *injected via the constructor* (`{ getFiles, saveFiles, onFileStatusChange }`), and
   the public methods (`saveFiles`, `getFiles`) contain the dedup/tracking logic you want to keep.
   `LocalFileManager` only subclasses to add `clearObsoleteFiles` — it does **not** override
   `getFiles`/`saveFiles`. The reference path, Collab (`Collab.tsx:152`), uses plain **composition**:
   `new FileManager({ getFiles: …firebase…, saveFiles: …firebase… })`. The HLD's own §1.1 surface
   (`createSupabaseFileManager(userId): FileManager` "passes getFiles/saveFiles/onFileStatusChange")
   is the correct composition approach, but the prose elsewhere ("A `FileManager` subclass whose
   `getFiles`/`saveFiles` hit Supabase", "Implemented as a `FileManager` (subclass or factory)")
   invites an LLD author to override the public methods and break dedup/status tracking. Lock it to
   **factory/composition**, drop "subclass".
2. **§3.4 conflates the public method with the injected callback.** The HLD writes
   `saveFiles({ addedFiles })` as if that is the `SupabaseFileManager` method. It is not: the *public*
   `FileManager.saveFiles` signature is `({ elements, files })` (`FileManager.ts:92`); `{ addedFiles }`
   is the signature of the *injected `_saveFiles` callback* (`FileManager.ts:54`, and what Collab
   supplies at `Collab.tsx:162`). The thing the design must implement is the injected callback
   `async ({ addedFiles }) => ({ savedFiles, erroredFiles })`, where **both** returned maps are
   `Map<FileId, BinaryFileData>` (note: `saveFiles` errored map is `Map<FileId, BinaryFileData>`,
   whereas `getFiles` errored map is `Map<FileId, true>` — easy to get wrong).
**Fix:** Re-specify §3.4 as: "Construct `new FileManager({ getFiles, saveFiles, onFileStatusChange })`
where the two callbacks do Supabase Storage I/O." Give the exact injected-callback signatures and the
two different errored-map value types. Caller invokes `fileManager.saveFiles({ elements, files })`
(the public method) — matching `LocalData._save` (`LocalData.ts:127`). Remove all "subclass" wording.

---

## MAJOR

### M1. LWW by `updated_at` has a clock-source hole: the trigger-maintained `updated_at` is a **DB clock**, but the "local dirty" mtime is a **client clock** — they are not comparable
**Location:** HLD §2.1 (`updated_at` "updated by trigger on write"), §3.2 step 3 ("compare cloud `updated_at` against the local scene's effective mtime (max element `updated`…)").
**Issue:** §2.1 deliberately makes `updated_at` server-authoritative ("so clients can't lie about it").
But §3.2 then compares that server timestamp against `max(element.updated)` — element `updated`
(`packages/element/src/types.ts:78`) is stamped with the **editing client's** `Date.now()`. Cross-device
clock skew (or just the round-trip latency between when an edit happened locally and when the previous
push's DB `now()` was recorded) makes this comparison non-deterministic and can silently pick the wrong
winner — including **clobbering newer local edits**. "max element updated" is also wrong as a freshness
proxy: deleting elements *lowers* the max, and `getNonDeletedElements` drops the just-deleted ones, so a
delete-only edit may not advance the mtime at all.
**Fix:** Do not compare DB time to element time. Drive LWW entirely off the `version` integer the engine
controls: persist `{ version }` in `localMeta` for the last *pulled-or-pushed* state; mark the scene
"dirty" with a simple boolean flag set on `notifyChange` and cleared on successful push (the HLD already
half-proposes this in §3.2 step 1: "if there are unpushed changes, local is dirty"). Then: cloud wins iff
`cloud.version > localMeta.version && !dirty`; if `dirty`, local wins and re-pushes with
`version = cloud.version + 1` (re-pull first per §3.5). Keep `updated_at` for display/tiebreak only, not
for the dirty-vs-cloud decision. This removes the cross-clock comparison entirely and is *simpler*.

### M2. "Local newer but cloud has files the local lost" — pushing a local-wins scene can orphan/drop images, and pull-applies a scene whose files may not be fetched
**Location:** HLD §3.2 step 4 ("Then `loadImages`-equivalent fetches missing files"), §3.4 (integration paragraph).
**Issue:** The reconciliation only reasons about `document`/`app_state`; it never reasons about file
*completeness* across the two sides. Two concrete holes:
1. **Local-wins push** overwrites the cloud row's `document`. If the local scene references image
   `fileId`s whose bytes were never uploaded from *this* device (e.g. the image arrived on device A,
   user opens device B which pulled the row but the LWW then picks B's local as "newer"), the engine
   pushes a document that points at Storage objects that exist, fine — but if local is missing files
   that only existed in cloud and the local document dropped them, nothing reconciles that. The
   one-row blob model means a "newer" partial scene **replaces** a complete one.
2. **Pull-applies before files load.** §3.2 step 4 does `updateScene(...)` then "fetches missing files".
   Between those, image elements render as broken/loading. The existing `loadImages`
   (`App.tsx:496-509`) already handles this for local, but the HLD's pull path is a *new* code path
   that must replicate the `addFiles` + `updateStaleImageStatuses` sequence (`App.tsx:500-508`) — the
   HLD says "loadImages-equivalent" but never specifies it runs `updateStaleImageStatuses` so missing
   images get `status:"error"` instead of spinning forever.
**Fix:** (a) Explicitly state files are **append-only/union** across sync (never delete on push; GC is
deferred per §9.6), so a local-wins push cannot remove another device's uploaded bytes — they remain in
Storage and are re-referenced if the element reappears. (b) Specify the post-pull file step concretely:
`supabaseFileManager.getFiles(fileIds).then(({loadedFiles, erroredFiles}) => { excalidrawAPI.addFiles(loadedFiles); updateStaleImageStatuses({...}); })`, mirroring `App.tsx:500-508`, so missing
objects resolve to `error` status rather than hanging.

### M3. Pushing the full `browser` appState subset will fire a cloud upsert on pan / zoom / selection / menu-open — the 2s debounce coalesces bursts but not idle UI churn
**Location:** HLD §2.3 (persist the `browser` subset) + its own Note; §3.3 (push on `onChange`); real `onChange` `App.tsx:677`; subset config `appState.ts:150-256`.
**Issue:** `onChange` fires for *any* appState change, and the `browser` subset includes `scrollX`,
`scrollY`, `zoom`, `selectedElementIds`, `openMenu`, `openSidebar`, `cursorButton`,
`selectedLinearElement`, etc. (verified `appState.ts:219-245`). So merely panning, zooming, selecting,
or opening a menu marks the scene dirty and, 2s later, triggers a **network upsert of the whole
document** even though no element changed. On a multi-device setup this also means device A's pan
silently bumps `version` and can make device B's pull think the cloud is "newer" for a no-op change.
The HLD's Note acknowledges "The LLD may choose to strip ephemeral keys… that's a tuning decision" —
but for a network-sync product this is a correctness/cost decision, not tuning, and it interacts with
the `version`-based LWW (M1).
**Fix:** Decide now (not "LLD may"): for the **push** payload and the **dirty** check, strip ephemeral
keys (`scrollX/Y`, `zoom`, `selectedElementIds`, `selectedGroupIds`, `previousSelectedElementIds`,
`openMenu`, `openSidebar`, `cursorButton`, `selectedLinearElement`, `editingGroupId`). Better: compute
dirtiness from the **elements + persisted-non-ephemeral appState** only, so pure viewport/selection
changes do not trigger a push or bump `version`. Keep persisting the broad subset on read if you want
cross-device theme/name, but gate *uploads* on meaningful change.

### M4. Engine owning `online`/`offline` and writing `isOfflineAtom` re-couples the "disabled" collab module back into the always-on sync path
**Location:** HLD §3.7 ("the engine owns its own online/offline listeners… and also writes `isOfflineAtom` for the existing offline banner"); real `isOfflineAtom` is exported from `collab/Collab.tsx:100`, imported by `App.tsx:99`.
**Issue:** `isOfflineAtom` is **defined inside `collab/Collab.tsx`**, the very module the feature is
trying to render dormant. Having the always-on SyncEngine import and write an atom owned by the collab
module is a backwards dependency and a maintenance trap (delete/move collab later → sync breaks). Also,
with Collab unmounted, the existing offline *banner* at `App.tsx:1021` is gated on
`isCollaborating && isOffline` — `isCollaborating` is false under the flag, so that banner never shows
regardless; writing `isOfflineAtom` from the engine to drive "the existing offline banner" is therefore
partly moot.
**Fix:** Move `isOfflineAtom` to a neutral module (`app-jotai.ts` or a new `excalidraw-app/data/sync`
atoms file) and re-export from Collab for back-compat, OR have the engine own its **own** offline/status
state in `syncStatusAtom` ('offline') and not touch `isOfflineAtom` at all. Render offline state through
`SyncStatusButton`, not the collab-gated banner. Pick one; the HLD currently implies a cross-module write
that fights the dormancy goal (principle §0.2).

### M5. Storage-upload-then-row-write ordering can leave the row referencing objects that failed to upload (and vice-versa) — the design notes the GC case but not this atomicity gap
**Location:** HLD §3.3 ("first `await fileManager.saveFiles(...)`, then `await pushBoard(...)`"), §8c ("two round-trips… which the engine already sequences").
**Issue:** The sequence is files-first then row. If `saveFiles` partially errors (some objects fail),
the design still proceeds to push a `document` that references the failed `fileId`s (the FileManager
puts them in `erroredFiles` but `saveFiles`'s public method returns and does not throw —
`FileManager.ts:115-137`). The row then points at missing Storage objects; on another device, pull +
`getFiles` returns those as errored (broken images) with no signal to retry the upload, because the
local FileManager has marked them in `erroredFiles_save` and **won't retry** (see the explicit comment
`FileManager.ts:107` "if errored during save, won't retry due to this check"). So a transient upload
failure can permanently strand an image reference in the synced row.
**Fix:** Specify push semantics: if `saveFiles` returns any `erroredFiles`, either (a) abort the
`pushBoard` and set status `error` (so the document and its files stay consistent and the next
`notifyChange` retries — but note FileManager won't re-add errored files unless their `version`
changes, so you may need `fileManager.reset()` of the errored set before retry), or (b) push the row
but record the missing fileIds and surface a non-fatal warning + schedule a re-upload. State which. At
minimum the LLD must address that `FileManager` does not auto-retry errored saves.

---

## MINOR

### m1. `version`-guarded conditional upsert vs `unique(user_id)` + `upsert` are in tension
**Location:** HLD §2.1 (`unique (user_id)`, "version incremented client-side in the upsert payload"), §3.5 (`update … where user_id=:uid and version=:expectedVersion`).
**Issue:** Supabase `upsert` (insert-on-conflict) cannot express a `WHERE version = :expected` guard;
that requires a plain `UPDATE … WHERE` (which returns 0 rows when stale) plus a separate INSERT path for
first write. The HLD uses "upsert" and "conditional update" interchangeably. For first-login (no row) you
need INSERT; for subsequent you need guarded UPDATE. A single `.upsert()` call will silently overwrite
regardless of version, defeating §3.5.
**Fix:** Specify two paths: INSERT when `localMeta` has no `version` (first push), guarded
`UPDATE … WHERE user_id AND version = expected` otherwise, with the "0 rows → re-pull" branch. Or accept
unconditional upsert + accepted-race (the HLD's own "v1 may simplify" fallback) and **drop** §3.5's guard
language to avoid implying a guarantee that isn't there.

### m2. Two-debounce design is sound, not redundant — but the interaction with `LocalData.isSavePaused()` is unaddressed
**Location:** HLD §0.1, §3.3; real `LocalData.isSavePaused()` returns true when `document.hidden` (`LocalData.ts:164`).
**Issue:** The two debounces (300ms local, 2000ms cloud) target different stores and are **not**
redundant — the critique's "redundant?" is answered: no. But `onChange` only calls `LocalData.save` when
`!isSavePaused()`. If the design mirrors that guard for `notifyChange`, then while `document.hidden`
(tab backgrounded) no sync is armed — which is fine — but the HLD's flush-on-blur/visibility (§3.8) fires
exactly when `document.hidden` becomes true. Ensure `notifyChange`/flush is **not** gated by
`isSavePaused()` (which would no-op the flush). State the relationship explicitly.
**Fix:** Note that the engine's notify/flush is independent of `LocalData.isSavePaused()`; only
`LocalData.save` is gated by it.

### m3. `restoreElements` is applied to `document` on pull, but `document` stores **non-deleted** elements only — fine, but undo-history/version semantics on apply should be stated
**Location:** HLD §2.1 (`document` = "non-deleted only"), §3.2 step 4 (`updateScene({ captureUpdate: IMMEDIATELY })`).
**Issue:** Applying a pulled scene with `CaptureUpdateAction.IMMEDIATELY` creates an undo entry, so a
login-pull becomes undoable, which can produce surprising UX (Ctrl-Z reverts to the pre-pull local
scene). The hashchange path uses `IMMEDIATELY` (`App.tsx:552`) but that is a user-initiated nav. A
background login-pull may warrant `CaptureUpdateAction.NEVER` (like the tabSync apply at
`App.tsx:574`).
**Fix:** Specify the `captureUpdate` mode for the pull-apply deliberately; recommend `NEVER` for
background login-pulls to avoid polluting undo history.

### m4. `localMeta` storage key not added to `STORAGE_KEYS`
**Location:** HLD §3.2 step 1 ("new key … `LOCAL_STORAGE_SUPABASE_META`"); real `STORAGE_KEYS` `app_constants.ts:39-53`.
**Issue:** Mentioned in prose but not in the anchor map or §6; easy to miss. The `STORAGE_KEYS` object is
`as const` and consumed widely.
**Fix:** Add the key to `STORAGE_KEYS` in `app_constants.ts` and list it as an edit site.

### m5. `getFiles` errored-map type and `BinaryFileData` reconstruction fields
**Location:** HLD §3.4 (`getFiles` returns `{ loadedFiles, erroredFiles: Map<FileId,true> }`, reconstruct `{ id, dataURL, mimeType, created }`).
**Issue:** Correct on the map type. But `BinaryFileData` also carries `lastRetrieved` (used by
`LocalFileManager.clearObsoleteFiles`, `LocalData.ts:62`) and an optional `version` used by FileManager
dedup (`FileManager.ts:88-90`). Reconstructing without `version` makes every pulled file dedup as
version `1`, which is usually fine but means a later local edit to that image (version 2) will re-upload —
acceptable, just note it.
**Fix:** Note the reconstructed `version`/`lastRetrieved` handling; set `lastRetrieved: Date.now()` on
read like the local manager does (`LocalData.ts:184`).

### m6. Test mock for a chainable Supabase client is feasible but the HLD's `.maybeSingle()` chain must match real query shapes
**Location:** HLD §7 mock shape.
**Issue:** A chainable stub is feasible (each method returns the same object; terminal methods return a
thenable). Feasibility confirmed against the existing firebase/socket mocks (`collab.test.tsx:30-64`).
One caveat: the engine will use different chains for select (`.select().eq().maybeSingle()`), guarded
update (`.update().eq().eq().select()`), and insert. A single flat stub that ignores call order works for
asserting *what* was called but can't distinguish *which* terminal resolved — fine for these unit tests.
No change required; just be aware the helper must let each test set per-method return values.
**Fix:** None; informational. Recommend `createSupabaseMock()` returns per-method `vi.fn()`s the test can
program, as the HLD already suggests.

---

## NITS

### n1. Anchor for command-palette "Live Collaboration" predicate
**Location:** HLD §5 row "Command palette 'Live Collaboration'".
**Issue:** The item at `App.tsx:1069-1087` has **no `predicate` field today** (verified). The HLD's
`predicate: () => !isSupabaseSyncEnabled()` is an *addition*, which is correct — just note it's added,
not modified. "Stop Session" (`1088-1109`) already has `predicate: () => !!collabAPI?.isCollaborating()`
and "Share" (`1110-1129`) has `predicate: true` — both as the HLD states. Accurate.

### n2. Security: anon-key/RLS intent is correct; confirm no service-role key
**Location:** HLD §2.4, §6.
**Issue:** RLS intent (`auth.uid() = user_id` on all four verbs, `with check` on insert/update; Storage
`(storage.foldername(name))[1] = auth.uid()::text`) is correct and standard. Anon key in client is fine
(it is public; RLS is the boundary). Confirmed the design uses only `VITE_APP_SUPABASE_ANON_KEY` and no
`SERVICE_ROLE` key anywhere — good; keep it that way (a service-role key in a Vite client bundle would be
a critical leak). One add: the Storage policy should also constrain `bucket_id = 'scene-files'` in each
policy (the HLD says "RLS on storage.objects for this bucket_id" — make sure the `bucket_id` predicate is
in the `USING`/`WITH CHECK`, not just narrative).

### n3. `.env.example` location
**Location:** HLD §6.1.
**Issue:** Confirmed `.env.development`/`.env.production` live at repo root and `envDir: "../"`
(`vite.config.mts:13,23`) exposes `VITE_APP_*` with no `define` allowlist — so the three new vars need no
build-config change. Accurate. `.env.example` at repo root is the right spot.

### n4. `isCollaborating` initial value + `is-collaborating` root class
**Location:** HLD §5 row "isCollaborating initial value" (`App.tsx:408-410`).
**Issue:** Verified: `useAtomWithInitialValue(isCollaboratingAtom, () => isCollaborationLink(...))`.
Forcing `false` under the flag is correct and sufficient to keep the collab root class and the
offline-collab banner (`App.tsx:1021`) dark. Accurate.

---

## What the HLD got right (for the record)
- Line anchors spot-checked: `onChange` 677-727, `LocalData.save` 689, collab branch 682-684,
  `clearAppStateForLocalStorage` at `appState.ts:283`, `initializeScene` hash parse 226-229 / collab
  branch 327-359, `renderTopRightUI` 955-978, `<Collab>` 1038-1040, `<ShareDialog>` 1042-1057, command
  palette 1069-1129, `AppMainMenu` LiveCollab gate 31-36, `FileManager` constructor 45-65, env loading.
  All accurate.
- Neutralizing `getCollaborationLinkData` **at the consumer** (`App.tsx:248`) rather than mutating the
  parser is the right call, and verified safe: **no existing test references `getCollaborationLinkData`,
  `isCollaborationLink`, or `#room=`** (grep clean), and the existing `collab.test.tsx` runs flag-off and
  drives collab via `window.collab.startCollaboration(null)` — unaffected. R3 holds.
- `updateScene({ elements, appState, captureUpdate })` is a valid `SceneData` patch (`types.ts:717-722`);
  the apply-via-`updateScene` approach matches hashchange/tabSync. Correct.
- Composition-via-constructor for files matches the Collab reference (`Collab.tsx:152`) once B2's wording
  is fixed.
- One-row blob + Storage-per-file, no Realtime, flag-gated dormancy: all appropriately scoped and
  justified; over-engineering is largely avoided. The SyncEngine-class + thin-hook split is reasonable and
  matches the LocalData (framework-free class) / Collab (imperative→atom) grain — not gold-plated.
  `featureFlags.ts` + `sessionAtom.ts` + `auth.ts` as three small modules is fine granularity (mirrors how
  the repo already separates `app-jotai`, `localStorage`, `firebase`); not fragmented enough to flag.
