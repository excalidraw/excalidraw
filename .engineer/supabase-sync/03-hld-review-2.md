# 03 — HLD Re-Review (focused): Supabase-backed Sync

**Verdict: APPROVE-WITH-CHANGES**

All 2 blockers and all 5 majors from `03-hld-review.md` are resolved against the real code, and the
requested UI mockup (§2.5) is present and covers the three asked-for views. The revision introduces no
new blocker or major. There are two minor items and one nit worth folding into the LLD, but none of
them gates approval.

Verification was done against real code on branch `online-sync`, not HLD prose:
`excalidraw-app/App.tsx`, `excalidraw-app/data/FileManager.ts`, `excalidraw-app/collab/Collab.tsx`,
`packages/excalidraw/appState.ts`, `excalidraw-app/app_constants.ts`.

---

## Per-item status

| ID | Status | One-line note |
|---|---|---|
| **B1** | **RESOLVED** | `renderTopRightUI` real signature is `(isMobile) => {…}` with early `return null` at `App.tsx:956`; §5.1's flow uses exactly `(isMobile)`, evaluates `isSupabaseSyncEnabled()` BEFORE the `!collabAPI` guard, renders `<SyncStatusButton>` independent of `collabAPI`. Compiles and reaches the button. |
| **B2** | **RESOLVED** | Constructor injection `{ getFiles, saveFiles, onFileStatusChange }` (`FileManager.ts:45-65`), `_getFiles` errored = `Map<FileId,true>` (`:52`), `_saveFiles` errored = `Map<FileId,BinaryFileData>` (`:56`), public `saveFiles({elements,files})` (`:92`) all match the HLD §3.4 exactly; composition (`new FileManager({…})`) matches `Collab.tsx:152-200`; all "subclass" wording removed. |
| **M1** | **RESOLVED** | §3.2 drives LWW entirely off engine-owned `version` + `dirty`; no DB-clock vs element-`updated` comparison remains; `updated_at` is display/tiebreak only. 5-row decision table is internally consistent (see audit below — no silent clobber, no lost first-login push). |
| **M2** | **RESOLVED** | §3.2 step 4 snippet mirrors the real `App.tsx:500-508` (`getFiles → addFiles → updateStaleImageStatuses`); `updateStaleImageStatuses` exists (`FileManager.ts:272-296`, sets `status:"error"`). Files declared union/append-only (§2.2, §9.6) so a local-wins push can't strip another device's bytes. |
| **M3** | **RESOLVED** | All 15 blacklisted keys are genuinely `browser:true` in `APP_STATE_STORAGE_CONF` (`appState.ts:150-256`); none wrongly excluded. Dirty-check + push payload both ignore them, so pan/zoom/selection/menu no longer push. One borderline persisted key (`activeTool`) left in — see minor m1. |
| **M4** | **RESOLVED** | `isOfflineAtom` confirmed defined at `Collab.tsx:100`; §3.7 explicitly never reads/writes it and represents offline purely as `syncStatusAtom='offline'`, owned by the sync module. No backwards dependency on the dormant collab module. |
| **M5** | **RESOLVED** | §3.5 uploads files FIRST; on any current-scene file error it does NOT advance `version` / does NOT mark synced / stays `dirty`; row written only after a clean upload; explicitly accounts for FileManager no-retry (`FileManager.ts:107`) via `fileManager.reset()` (`:212`, clears `erroredFiles_save` at `:224`). |
| **UI** | **RESOLVED** | §2.5 present; covers (1) top-right status button with 4 states + popover incl. Sync now, (2) opened MainMenu with Sync now + signed-in email/Sign out and a signed-out variant, (3) magic-link sign-in prompt. Approximate ASCII, coverage complete. |

---

## Evidence / spot-checks

- **B1.** `App.tsx:955-958` real code:
  `renderTopRightUI={(isMobile) => { if (isMobile || !collabAPI || isCollabDisabled) { return null; } … }`.
  The function takes a single `isMobile` arg (no other params), exactly as §5.1's rewrite assumes. The
  rewrite's order — `if (isMobile) return null;` → `if (isSupabaseSyncEnabled()) return <SyncStatusButton/>;`
  → `if (!collabAPI || isCollabDisabled) return null;` → collab UI — renders the button before any
  `collabAPI` guard, so it appears even with `<Collab>` unmounted (`collabAPI` permanently null). No
  compile or null-path issue.

- **B2.** `FileManager.ts` constructor (`:45-65`) and the two injected signatures (`getFiles` →
  `{loadedFiles, erroredFiles: Map<FileId,true>}` at `:50-53`; `saveFiles` →
  `({addedFiles}) => {savedFiles, erroredFiles}` both `Map<FileId,BinaryFileData>` at `:54-57`) match the
  HLD's §3.4 callback block verbatim, including the "value type is `true` here" vs "`BinaryFileData` (NOT
  `true`)" callouts. Public `saveFiles` is `({elements, files})` (`:92-98`). The reference composition in
  `Collab.tsx:152-200` confirms `new FileManager({onFileStatusChange, getFiles, saveFiles})` with
  `saveFiles: async ({addedFiles}) => …` returning both maps as `Map<FileId,BinaryFileData>` (`:178-197`).

- **M1 decision-table audit (the 5 rows in §3.2):**
  1. `cloud=null` → push (INSERT), seed version — **lossless first-login push**, keyed on row presence not
     `document.length` (matches §9.8). ✓
  2. `!dirty & cloud.version > local` → cloud wins. ✓
  3. `!dirty & ==` → no-op. ✓
  4. `!dirty & cloud.version < local` → impossible-but-no-op + log. ✓
  5. `dirty & exists (any)` → re-pull, push with `version = cloud.version + 1`; on guarded-UPDATE 0-rows
     race, re-pull and re-evaluate. **No path lets a dirty-local with a stale version silently clobber a
     newer cloud** — the re-pull-then-`cloud.version+1` always carries the latest cloud version forward,
     and files are union so no bytes are stripped. No hole found.

- **M2.** Real local pattern at `App.tsx:496-516` (`isInitialLoad` branch) is
  `LocalData.fileStorage.getFiles(fileIds).then(({loadedFiles, erroredFiles}) => { if (loadedFiles.length)
  addFiles(loadedFiles); updateStaleImageStatuses({excalidrawAPI, erroredFiles, elements: …}); })` — the
  HLD §3.2 step-4 snippet reproduces this faithfully (including the `loadedFiles.length` guard and the
  `getSceneElementsIncludingDeleted()` arg). `updateStaleImageStatuses` (`FileManager.ts:272-296`) flips
  errored image elements to `status:"error"` with `captureUpdate:NEVER`, so missing objects don't spin.

- **M3.** Every blacklisted key verified `browser:true`: `scrollX:220`, `scrollY:221`, `zoom:242`,
  `scrolledOutside:219`, `shouldCacheIgnoreZoom:231`, `selectedElementIds:222`, `selectedGroupIds:224`,
  `previousSelectedElementIds:217`, `selectedLinearElement:245`, `editingGroupId:180`, `openMenu:213`,
  `openSidebar:215`, `cursorButton:176`, `lastPointerDownWith:207`, `stats:232`. None is `browser:false`
  (i.e. none wrongly excluded — excluding a non-persisted key would be harmless anyway). The revision adds
  4 keys beyond the original review's list (`scrolledOutside`, `shouldCacheIgnoreZoom`,
  `lastPointerDownWith`, `stats`) — a strict improvement. `clearAppStateForLocalStorage` confirmed at
  `appState.ts:283`.

- **M4.** `isOfflineAtom` at `Collab.tsx:100`. It is imported/read by the app at `App.tsx:99` / `:786`
  (pre-existing collab-app code, unrelated to the sync engine). §3.7 commits to never touching it from the
  sync path — satisfied.

- **M5.** `FileManager.ts:107` no-retry comment ("if errored during save, won't retry due to this check")
  and `reset()` at `:212` (clears `erroredFiles_save` at `:224`) both exist; §3.5 cites both and calls
  `reset()` before retry. The public `saveFiles` returns `erroredFiles` rather than throwing
  (`:115-137`), and §3.5 inspects the returned map. Correct.

- **UI.** §2.5 lines 252-350: four top-right states (synced/syncing/error/offline), a popover with
  "Sync now" + last-synced + error detail, the opened MainMenu (signed-in and signed-out variants with
  Sync now + email + Sign out), and the magic-link prompt with email field + "Send magic link" +
  confirmation. All three requested views present.

---

## New findings (none blocking)

### m1 (minor — pre-existing concern, not a regression). `activeTool` (and a few preference toggles) left out of the ephemeral blacklist will push on tool switches
**Location:** HLD §2.3 blacklist (lines 216-221); real `appState.ts:181` (`activeTool: {browser:true}`).
**Issue:** `activeTool` is `browser:true` and therefore part of the persisted `app_state` and the dirty
computation, but it is transient UI state — selecting the rectangle/arrow/eraser tool (no element change)
would mark the board dirty and, 2s later, trigger a full-document upsert + `version` bump, the exact
class of "idle UI churn" M3 set out to eliminate. `zenModeEnabled` (`:241`), `objectsSnapModeEnabled`
(`:248`), `penMode` (`:183`) are similar borderline cases. These are defensible as "working state that
follows the user," so this is a tuning call, not a correctness break — but it slightly undercuts the M3
goal and interacts with the version-LWW (a tool switch on device A can make device B's pull see a "newer"
cloud for a no-op).
**Fix:** Either add `activeTool` (and optionally `preferredSelectionTool`) to the ephemeral blacklist, OR
state explicitly in §2.3 that tool/zen/snap toggles are intentionally synced and accept the resulting
pushes. One sentence in the LLD settles it.

### m2 (minor). §3.2 step-4 snippet drops the `loadedFiles.length` guard inconsistency is fine, but `fileIds` collection source should be pinned
**Location:** HLD §3.2 step 4 (lines 417-432).
**Issue:** The snippet says "collect image `fileId`s from the applied scene" then calls
`fileManager.getFiles(fileIds)`, but unlike the real `App.tsx:463-469` it doesn't show the
`isInitializedImageElement`-filtered reduce that produces `fileIds`. Cosmetic, but an LLD author copying
the block needs that filter (a raw `getFiles` over all elements would pass non-image ids).
**Fix:** In the LLD, reuse the exact `reduce(... isInitializedImageElement ...)` from `App.tsx:463-469` to
build `fileIds`. No design change.

### n1 (nit). Anchor-map line for the offline banner cites `App.tsx:1021`; the `isOfflineAtom` read is at `:786`
**Location:** HLD appendix anchor map (line 909) and §3.7.
**Issue:** The banner *render* gate (`isCollaborating && isOffline`) and the `useAtomValue(isOfflineAtom)`
read (`App.tsx:786`) are a few lines apart from the cited `:1021`. The HLD's substantive claim (the banner
is dead under the flag because `isCollaborating` is forced false) is correct regardless; only the anchor
is loose. No action required beyond an optional anchor tidy.

---

## Bottom line
The revision clears the bar set by `03-hld-review.md`: B1, B2, M1–M5 are all genuinely resolved against
the real code, and the UI mockup is present and complete. No new blocker or major was introduced. Fold m1
(decide `activeTool`'s sync status) and m2 (pin the `fileIds` reduce) into the LLD; n1 is optional. Cleared
for LLD.
