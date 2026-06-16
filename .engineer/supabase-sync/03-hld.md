# 03 — High-Level Design: Supabase-backed Sync

_Status: HLD (revised). Architecture + decisions, not full code. Line references verified against
branch `online-sync` on 2026-06-15; treat them as anchors (±a few lines as the file evolves)._

This design adds authenticated, per-user cloud sync of the user's single working scene to a
hosted Supabase project, and neutralizes live collaboration + shareable links behind a feature
flag. Local storage (`LocalData`: localStorage + IndexedDB) remains the offline source of truth;
Supabase replication is layered on top.

---

## Revision history

This is revision 2, produced to satisfy `03-hld-review.md` (APPROVE-WITH-CHANGES: 2 blockers, 5
majors). All blockers and majors are resolved and a UI mockup section was added. The module
breakdown, schema, the local-first fire-and-forget principle, flag-gated dormancy, and the
alternatives section are preserved.

| ID | Title | Resolution (see section) |
|---|---|---|
| **B1** | `renderTopRightUI` early-returns `null` when `collabAPI` is null | §5: restructured control flow — the flag path renders `SyncStatusButton` **before** the `!collabAPI` check; never early-returns on missing collabAPI when sync is on. |
| **B2** | FileManager is composition, not subclass; method/callback signatures were conflated | §1.1, §3.4: re-specified as `new FileManager({ getFiles, saveFiles, onFileStatusChange })`; exact injected-callback signatures + the two different errored-map value types given; all "subclass" wording removed. |
| **M1** | LWW compared DB-clock `updated_at` to client-clock element `updated` | §2.1, §3.2: conflict resolution driven entirely off engine-owned monotonic `version` + a local `dirty` flag; `updated_at` is display/tiebreak only. Decision table added. |
| **M2** | Reconciliation ignored file completeness; post-pull file apply underspecified | §3.2, §3.4: files are union/append-only across sync; post-pull step explicitly runs `fileManager.getFiles → addFiles → updateStaleImageStatuses` (App.tsx:500-508 pattern). |
| **M3** | Pushing the full `browser` appState fired upserts on pan/zoom/selection | §2.3, §3.3: defined the exact ephemeral-key blacklist; dirty-check + push payload ignore those keys so viewport/selection changes never mark the board dirty. |
| **M4** | Engine wrote `isOfflineAtom` (owned by dormant collab module) | §3.7: engine no longer touches `isOfflineAtom`; offline is represented purely via `syncStatusAtom = 'offline'`, owned by the sync module. |
| **M5** | Files-then-row ordering could strand image refs (FileManager has no auto-retry) | §3.3, §3.5: upload files FIRST; if any file in the current scene errors, do NOT advance synced version / do NOT mark synced (stay dirty → retry), surface `status='error'`; boards row written only after a clean file upload. |
| **+UI** | (user request) ASCII UI mockup | New **§2.5 — UI Mockup** (top-right sync button states, MainMenu auth + Sync now, sign-in prompt). |

Folded-in minors/nits: `STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META` added (m4), `captureUpdate`
mode for pull-apply specified as `NEVER` (m3-review), INSERT-vs-guarded-UPDATE split (m1-review),
`isSavePaused()` independence noted (m2-review), `version`/`lastRetrieved` reconstruction noted
(m5-review), Storage policy `bucket_id` predicate called out (n2), confirmed **anon key only, no
service-role key** in the client (n2).

---

## 0. Guiding principles

1. **Local-first, cloud-replicated.** `LocalData.save` (300ms debounce) stays the immediate,
   synchronous persistence path. Supabase push is a *separate, slower, fire-and-forget*
   replication that never blocks `onChange` or the editor.
2. **Additive + revertible.** No deletion of collab/share/firebase code, no dependency removal.
   Everything new is gated by `VITE_APP_FEATURE_SUPABASE_SYNC`; flag off ⇒ today's app, byte for
   byte (modulo a few `if (flag)` guards). The sync module must never import from the dormant
   `collab/` module (see M4 / §3.7).
3. **One sync unit = one row.** The user's working scene is a single `boards` row keyed by
   `user_id`. Schema is shaped so a future "multiple named boards" feature only adds a `name`
   column + a `board_id` selector — no migration of the sync engine.
4. **LWW, single active session, engine-owned `version`.** No CRDT/OT. Conflict resolution is
   driven off a **monotonic integer `version`** the sync engine controls plus a local **dirty**
   flag — never off comparing a DB clock to a client clock (M1). Concurrent multi-tab/multi-device
   editing is explicitly out of scope (existing `tabSync` keeps tabs on one device coherent through
   localStorage).

---

## 1. Component architecture

New code lives under `excalidraw-app/data/supabase/`. Auth/sync surface to the UI via **jotai
atoms** in `app-jotai`-style modules (matching how `collabAPIAtom` already works). Per M4, the
sync module owns **all** of its own atoms (status, session, offline-is-a-status) and does **not**
read or write any atom defined in `collab/Collab.tsx`.

```
                          ┌────────────────────────────────────────────────────────┐
                          │                    excalidraw-app/App.tsx                │
                          │  (ExcalidrawWrapper — functional comp, jotai atoms)      │
                          │                                                          │
                          │  onChange ─┐   initializeScene ─┐   render: MainMenu,     │
                          │            │                    │   renderTopRightUI,     │
                          │            │                    │   <SyncStatusButton/>   │
                          └────────────┼────────────────────┼──────────────────────-─┘
                                       │                    │
                  (debounced push)     │                    │  (pull on load/login)
                                       ▼                    ▼
   ┌───────────────────────────────────────────────────────────────────────────────┐
   │                    excalidraw-app/data/supabase/                                │
   │                                                                                 │
   │  syncEngine.ts ◀──────── useSupabaseSync() (hook: wires engine to React/atoms)  │
   │   (imperative, framework-free orchestrator: debounce, status, flush, online)    │
   │        │            │                  │                                        │
   │        ▼            ▼                  ▼                                        │
   │  boardRepository  fileManager (composed   session/auth (atoms + listeners)      │
   │   .ts (scene row)  FileManager instance)   auth.ts + sessionAtom                │
   │        │            │                  │                                        │
   │        └────────────┴──────────────────┴───────────► client.ts (singleton)     │
   │                                                       featureFlags.ts           │
   │  syncStatusAtom (incl. 'offline')  — owned here, NOT in collab/                 │
   └───────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                         @supabase/supabase-js  ──►  Hosted Supabase
                                                      (Postgres `boards` + Storage `scene-files`)
```

### 1.1 Module responsibilities

| Module | Responsibility | Key public surface (high level) | Depends on |
|---|---|---|---|
| `client.ts` | Lazily create + memoize a single `SupabaseClient`. Reads env. Returns `null` when sync disabled or env missing. Uses **anon key only** (no service-role key anywhere — n2). | `getSupabaseClient(): SupabaseClient \| null` | `@supabase/supabase-js`, `featureFlags.ts`, `import.meta.env` |
| `featureFlags.ts` | One-liner helper(s) for reading the flag app-wide so call sites don't sprinkle `import.meta.env`. | `isSupabaseSyncEnabled(): boolean` | `import.meta.env` |
| `auth.ts` | Wrap Supabase Auth: sign-in (email magic link), sign-out, current session getter, subscribe to auth changes. | `signInWithEmail(email)`, `signOut()`, `getSession()`, `onAuthStateChange(cb)` | `client.ts` |
| `sessionAtom.ts` (atoms) | Jotai atoms holding `Session \| null` / derived `userId \| null`; one effect subscribes `onAuthStateChange` and writes the atom. | `sessionAtom`, `userIdAtom` (derived), `useInitSupabaseAuth()` (mounts listener) | `app-jotai`, `auth.ts` |
| `boardRepository.ts` | All `boards`-table I/O. Serialize/deserialize the scene ↔ row. Version-guarded write (§3.5). | `pullBoard(userId): Promise<BoardRow \| null>`, `pushBoard(userId, scene, expectedVersion): Promise<{version, updated_at}>`, `serializeScene(elements, appState)`, `deserializeToInitialData(row)` | `client.ts` |
| `fileManager` (instance) | A **composed** `FileManager` (`new FileManager({...})`, NOT a subclass) whose injected `getFiles`/`saveFiles` callbacks hit Supabase Storage. The public dedup/tracking stays in `FileManager`. | factory `createSupabaseFileManager(userId): FileManager` returning `new FileManager({ getFiles, saveFiles, onFileStatusChange })` | `client.ts`, `FileManager`, `FileStatusStore` |
| `syncEngine.ts` | Framework-free orchestrator: holds status, owns a *second* debounce for pushes, exposes `notifyChange/flush/start/stop/syncNow`, handles online/offline + auth gating, owns the **dirty** flag and **localMeta** `{version}`, wires repository + file manager. | `SyncEngine` class (see §3); `syncStatusAtom` (incl. `'offline'`) lives alongside | `boardRepository`, `fileManager`, `sessionAtom`, `app-jotai` |
| `useSupabaseSync.ts` | **Thin React hook** that adapts the engine to `App.tsx`: reads `excalidrawAPI`, `sessionAtom`, flag; instantiates/owns one `SyncEngine`; returns `{ notifyChange, syncNow, status }`; runs pull-on-login effect; flush-on-unload. | `useSupabaseSync(excalidrawAPI): { notifyChange(els,app,files), syncNow(), status }` | `syncEngine`, `sessionAtom`, atoms |
| UI: `SyncStatusButton.tsx` | The "Sync now" control + status pill rendered in `renderTopRightUI` where `LiveCollaborationTrigger` was. Reads `syncStatusAtom`. Renders offline state itself (M4). | `<SyncStatusButton onSyncNow=… />` | `syncStatusAtom`, icons |
| UI: `SupabaseAuthMenu.tsx` (or items inside `AppMainMenu`) | Sign-in (email entry) / sign-out items + "Sync now" item in `MainMenu`. | menu items reading `sessionAtom` | `auth.ts`, `sessionAtom` |
| `supabase/migrations/*.sql` | `boards` table, RLS, Storage bucket + policies. | DDL only | — |

### 1.2 Sync orchestration: **hook (`useSupabaseSync`) wrapping an imperative engine** — RECOMMENDED

**Decision:** A small **React hook** (`useSupabaseSync`) that *owns* a **plain imperative
`SyncEngine` instance** (held in a `useRef`). The engine contains all the real logic (debounce
timer, status state machine, online/offline, the dirty flag, the actual `pull`/`push` calls); the
hook is the adapter that:
- creates the engine once (`useRef`), tears it down on unmount;
- subscribes the engine to `sessionAtom` changes (login ⇒ pull; logout ⇒ stop + clear);
- exposes `notifyChange` to be called from `onChange`, and `syncNow` for the button;
- mirrors engine status into `syncStatusAtom` so UI components re-render.

**Why this split, not "pure hook" and not "pure controller":**
- `App.tsx`'s `ExcalidrawWrapper` is a functional component already orchestrating lifecycle via
  `useEffect`/`useRef`/jotai (see the big effect at `App.tsx:522-650`, `onChange` at
  `App.tsx:677`). A hook drops in idiomatically next to those and gives clean
  mount/unmount/flush-on-unload semantics.
- But the *core* logic (debounce, retry, status transitions, offline state, dirty flag) must be
  unit-testable **without React**, mirroring how `LocalData` is a framework-free class today.
  Putting that in a plain `SyncEngine` class lets tests drive `engine.notifyChange()` /
  `engine.flush()` directly with a mocked client and fake timers — no `render()` needed for the
  data-layer SCs (SC1–SC4).
- This also matches the existing codebase grain: `Collab` is an imperative class that publishes a
  `CollabAPI` into an atom (`Collab.tsx:230-243`); `LocalData` is a static class. We're consistent
  with both.

**Alternatives rejected** (full list in §8a): a pure `useSupabaseSync` hook with all logic inline
(hard to unit test, re-creates closures, debounce state tangled with render); a fully imperative
singleton controller with no hook (awkward to bind to `excalidrawAPI`/atoms which are React-scoped,
and to flush on unmount).

---

## 2. Data model

### 2.1 `boards` table

One row per user (this deployment). `document` holds the canonical scene; `app_state` is the
persisted UI subset (non-ephemeral only — §2.3); the **conflict key is the engine-owned `version`
integer**. `updated_at` is kept for display/tiebreak only, never for the dirty-vs-cloud decision
(M1).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, `default gen_random_uuid()` | board identity (future multi-board key) |
| `user_id` | `uuid` not null, FK → `auth.users(id)` | owner; RLS pivot |
| `name` | `text` default `'Untitled'` | future multi-board UI; ignored for now |
| `document` | `jsonb` not null default `'[]'` | the scene **elements array** (`OrderedExcalidrawElement[]`), non-deleted only — the exact shape `localStorage["excalidraw"]` holds today |
| `app_state` | `jsonb` not null default `'{}'` | persisted **non-ephemeral** appState subset (see §2.3) |
| `version` | `integer` not null default `0` | **the LWW key.** Monotonic, engine-controlled; bumped on every successful push via a guarded `UPDATE` (§3.5). |
| `created_at` | `timestamptz` not null default `now()` | |
| `updated_at` | `timestamptz` not null default `now()` | **display/tiebreak only**; maintained by a `before update` trigger so clients can't lie. Never compared against client-side element `updated` (M1). |

Constraints/indexes:
- `unique (user_id)` for the single-board deployment (drop/relax when multi-board lands; replace
  with `unique (user_id, name)`).
- Index on `user_id` (implied by the unique constraint).
- `updated_at` maintained by a `before update` trigger (`moddatetime` or a tiny custom function).
- **`version` semantics (M1):** the engine persists, in localStorage, the `version` of the
  last-pulled-or-pushed state (`localMeta.version`, see §3.2 / m4). On push it sends a guarded
  `UPDATE ... SET version = :expected + 1 WHERE user_id = :uid AND version = :expected` (§3.5). The
  returned new `version` is stored back into `localMeta`. No client ever invents a `version` from a
  clock.

**We do NOT normalize per-element.** Elements stay as one `jsonb` blob (rationale in §8b).

### 2.2 Storage bucket

- **Bucket name:** `scene-files` (private; `public = false`).
- **Object path convention:** `scene-files/{user_id}/{fileId}` (one object per Excalidraw
  `BinaryFileData`, keyed by the editor's `fileId`). `user_id` as the leading path segment is what
  the Storage RLS policy matches on (`storage.foldername(name)[1] = auth.uid()::text`).
- **Files are union / append-only across sync (M2).** A push never deletes a Storage object. A
  "local wins" push therefore cannot remove bytes another device uploaded — they stay in Storage
  and are re-referenced if the element reappears. GC of truly orphaned objects is deferred (§9.6).
- **Object body:** the file's `dataURL` bytes. Two viable encodings; LLD picks one and unit-tests
  the round-trip:
  - (a) store the raw decoded bytes with `content-type` = the file's `mimeType` (smaller, CDN-
    friendly), reconstruct `dataURL` on read; **recommended**.
  - (b) reuse `encodeFilesForUpload` (compress+encrypt, as Firebase path does) and store the
    encoded buffer. More code reuse, but encryption keying per-user is extra design; defer.
- Metadata (`mimeType`, `created`) is recoverable from the object's content-type + `created_at`;
  no separate files table needed for v1.

### 2.3 Serialization boundary + the appState ephemeral blacklist (M3)

The scene's three parts and their canonical persisted forms **already exist** in the codebase:

| Part | Source at runtime | Persisted form | Authoritative helper |
|---|---|---|---|
| elements | `excalidrawAPI.getSceneElementsIncludingDeleted()` | non-deleted `OrderedExcalidrawElement[]` | `getNonDeletedElements(...)` — same call `saveDataStateToLocalStorage` uses (`LocalData.ts:92`) |
| appState | `excalidrawAPI.getAppState()` | the `browser: true` subset **minus the ephemeral blacklist below** | `clearAppStateForLocalStorage(appState)` (`packages/excalidraw/appState.ts:283`) then strip ephemeral keys |
| files | `excalidrawAPI.getFiles()` (a `BinaryFiles` map) | one Storage object per referenced image `fileId` | composed `fileManager` (§3.4) |

`boardRepository.serializeScene` is therefore:
`document = JSON-able getNonDeletedElements(elements)`, `app_state =
stripEphemeral(clearAppStateForLocalStorage(appState))`. We start from the same `browser` subset
the app round-trips locally, then **remove ephemeral keys** before upload.

**Ephemeral-key blacklist (the cloud must NOT carry these, and they must NOT count toward
dirtiness — M3):** verified against `APP_STATE_STORAGE_CONF` (`appState.ts:150-256`), the following
keys are `browser:true` but are pure viewport/selection/UI-transient state:

```
scrollX, scrollY, zoom, scrolledOutside, shouldCacheIgnoreZoom,
selectedElementIds, selectedGroupIds, previousSelectedElementIds,
selectedLinearElement, editingGroupId,
openMenu, openSidebar, cursorButton, lastPointerDownWith, stats
```

These are stripped from `app_state` before upload AND excluded from the dirty computation (§3.3),
so a pan / zoom / selection / menu-open does **not** mark the board dirty and does **not** trigger
a network upsert or bump `version`. Cross-device theme/name/current-item styles are still carried
(they are `browser:true` and **not** in the blacklist), so "boards follow the user" is preserved.

> Reference point: the editor also defines a leaner `server` subset
> (`clearAppStateForDatabase`, `appState.ts:291`) containing only `gridSize/gridStep/
> gridModeEnabled/viewBackgroundColor/lockedMultiSelections`. We deliberately persist **more** than
> that (theme, name, current-item styles) because the product goal is cross-device working-state
> restore — but we persist **less** than the raw `browser` subset by removing the ephemeral keys
> above. On read, `restoreAppState` fills any missing keys from defaults, so dropping ephemerals is
> safe.

This guarantees the cloud row carries a stable, meaningful subset; the `restoreElements` /
`restoreAppState` path on read (`App.tsx:548-551`) works unchanged.

### 2.4 RLS policy intent

- **Table `boards`:** enable RLS; four policies (`select/insert/update/delete`) all with
  `using (auth.uid() = user_id)` and `with check (auth.uid() = user_id)`. Net: an authenticated
  user reads/writes only their own row; the `anon` role with a JWT can never touch another user's
  board.
- **Bucket `scene-files`:** RLS on `storage.objects` for this bucket; each of the four policies
  must include **both** predicates `bucket_id = 'scene-files'` **and**
  `(storage.foldername(name))[1] = auth.uid()::text` in `USING`/`WITH CHECK` (n2). Net: a user can
  only read/write objects under their own `{user_id}/` prefix in this bucket.
- **No service-role key (n2):** the client uses only `VITE_APP_SUPABASE_ANON_KEY`. A service-role
  key in a Vite bundle would bypass RLS and is a critical leak; the design forbids it.

### 2.5 UI Mockup

Approximate ASCII only — conveys layout/placement, not pixel design. Three areas: (1) the
top-right sync status button (replacing the live-collaboration button), (2) the MainMenu
(hamburger) with auth + "Sync now", (3) the minimal sign-in prompt.

**(1) Top-right area — `SyncStatusButton` replaces `LiveCollaborationTrigger`** (rendered in
`renderTopRightUI`, §5/B1). Four states:

```
   ┌──────────── canvas top-right corner ────────────┐
   │                                                  │
   │                          ┌───────────────────┐   │   state: SYNCED
   │                          │  ✓  Synced        ▾│   │   (steady; click ▾ → "Sync now")
   │                          └───────────────────┘   │
   │                                                  │
   │                          ┌───────────────────┐   │   state: SYNCING
   │                          │  ◴  Syncing…      ▾│   │   (spinner; transient)
   │                          └───────────────────┘   │
   │                                                  │
   │                          ┌───────────────────┐   │   state: ERROR
   │                          │  ⚠  Sync error    ▾│   │   (red; tooltip carries message,
   │                          └───────────────────┘   │    e.g. "permission denied")
   │                                                  │
   │                          ┌───────────────────┐   │   state: OFFLINE
   │                          │  ⦸  Offline       ▾│   │   (grey; offline shown HERE,
   │                          └───────────────────┘   │    not via collab banner — M4)
   └──────────────────────────────────────────────────┘
```

Clicking the button (or its ▾) reveals a tiny popover with **Sync now** and, when signed-out, a
"Sign in to sync" affordance:

```
   ┌───────────────────┐
   │  ⚠  Sync error    ▾│
   └─────────┬─────────┘
             ▼
   ┌─────────────────────────────┐
   │  Last synced: 12:04          │
   │  ───────────────────────────│
   │  ↻  Sync now                 │
   │  ⚠  permission denied        │   ← error detail (only in error state)
   └─────────────────────────────┘
```

**(2) MainMenu (hamburger) opened — Sign in / Sign out + Sync now** (added in `AppMainMenu.tsx`;
the Live-Collaboration item is hidden under the flag, §5):

```
   ┌───────────────────────────┐
   │  ☰  Menu                  │
   ├───────────────────────────┤
   │  📂  Open                  │
   │  💾  Save to file          │
   │  ⬇  Export image…          │
   │  ⌘  Command palette        │
   │  🔍  Find on canvas        │
   │  ❔  Help                  │
   │  🗑  Clear canvas          │
   ├───────────────────────────┤        ← (LiveCollaboration item NOT shown: flag on)
   │  ↻  Sync now               │        ← NEW (calls syncNow(); disabled if signed-out)
   │  👤  ankit@example.com     │        ← signed-in: shows email
   │  ⎋  Sign out               │        ← NEW
   ├───────────────────────────┤
   │  ⚙  Preferences            │
   │  ◑  Toggle theme           │
   │  🌐  Language              │
   └───────────────────────────┘

   …and when signed OUT, the auth region instead shows:
   ┌───────────────────────────┐
   │  ↻  Sync now      (greyed) │
   │  🔑  Sign in to sync  ▸     │   ← opens the sign-in prompt (3)
   └───────────────────────────┘
```

**(3) Minimal sign-in prompt — email magic link** (opened from "Sign in to sync"; modeled on
`signInWithOtp({ email })`, §4):

```
   ┌──────────────────────────────────────────┐
   │  Sign in to sync                    [ × ] │
   ├──────────────────────────────────────────┤
   │                                            │
   │   We'll email you a magic link.            │
   │                                            │
   │   Email                                    │
   │   ┌──────────────────────────────────┐    │
   │   │ ankit@example.com                │    │
   │   └──────────────────────────────────┘    │
   │                                            │
   │            ┌───────────────────────┐       │
   │            │   Send magic link     │       │
   │            └───────────────────────┘       │
   │                                            │
   │   ✓ Check your inbox to finish signing in. │  ← confirmation after send
   └──────────────────────────────────────────┘
```

---

## 3. Sync data flow (the heart)

### 3.1 Status state machine

`syncStatusAtom: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'`. **Offline is represented
purely as a status value here (M4)** — the engine does not write `collab/Collab.tsx`'s
`isOfflineAtom`. Transitions:

```
            login/pull start ─────────► syncing ──ok──► synced ──(quiet)──► idle
   idle ◀──────────────────────────────────┘   │
     ▲          notifyChange (debounced) ───────┤
     │                                          └──err──► error ──(retry/next change)──► syncing
   offline ◀── window 'offline' / push fails network ── ▲
     └────────────── window 'online' ─────────────────► (flush if dirty) syncing
```

Status lives in the engine and is mirrored to the atom so `SyncStatusButton` re-renders. `error`
carries a message (RLS denial, network, file-upload failure) for the tooltip (R: §9, M5).

### 3.2 Load / login flow (pull + reconcile) — version-driven LWW (M1)

Trigger points:
- App boot: `initializeScene` already builds `scene` from `importFromLocalStorage()` and resolves
  `initialStatePromiseRef.current.promise` (`App.tsx:527-530`). We do **not** block initial render
  on the network.
- On auth → signed-in (atom transition in `useSupabaseSync`): run a pull.

**State the engine keeps:**
- `localMeta = { version }` — the `version` of the last state this client pulled or pushed,
  persisted in localStorage under `STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META` (m4). Absent ⇒ this
  client has never synced this board.
- `dirty: boolean` — set `true` by `notifyChange` whenever a **meaningful** change occurs (elements
  or non-ephemeral appState changed; ephemeral changes never set it — §3.3/M3). Cleared to `false`
  only on a fully successful push (row written **and** all current-scene files uploaded — M5).

Reconciliation (deterministic; **no clock comparison**):
1. `pullBoard(userId)` → `cloudRow | null`.
2. Decide using the table below. `cloud.version` is the server integer; `localMeta.version` is the
   engine's stored integer; `dirty` is the local flag.

   | local `dirty`? | cloud row | condition | Decision |
   |---|---|---|---|
   | — | `null` | first login / empty cloud | **Push local up** (INSERT, §3.5); seed `localMeta.version` from the returned version. (Locked "first login → push local" decision; uses row presence, not `document.length` — §9.8.) |
   | `false` | exists | `cloud.version > localMeta.version` | **Cloud wins.** Apply cloud to editor (step 3), then load files (step 4); set `localMeta.version = cloud.version`. |
   | `false` | exists | `cloud.version === localMeta.version` | **No-op.** Already in sync. |
   | `false` | exists | `cloud.version < localMeta.version` | Shouldn't happen (monotonic); treat as no-op + log. |
   | `true` | exists | any | **Local wins.** Re-pull to read the latest `cloud.version`, then push with guarded `UPDATE ... version = cloud.version + 1` (§3.5). Files are union (M2) so this never strips another device's bytes. On the guarded-update 0-rows race, re-pull and re-evaluate this table. |

   `updated_at` is used only to render "Last synced: HH:MM" and as a human-facing tiebreak hint —
   never in the decision logic (M1). This removes the cross-clock comparison entirely and is
   simpler than the prior `max(element.updated)` approach (which was also wrong for delete-only
   edits, since `getNonDeletedElements` drops the deleted elements).

3. **Apply cloud → editor:**
   `excalidrawAPI.updateScene({ elements: restoreElements(row.document, null, { repairBindings:
   true }), appState: restoreAppState(row.app_state, null), captureUpdate:
   CaptureUpdateAction.NEVER })`. We use **`NEVER`** for a background login-pull so the pull does
   **not** create an undo entry (a background sync must not be Ctrl-Z-reversible — m3-review). This
   mirrors the tabSync apply (`App.tsx:574`), not the user-initiated hashchange apply (which uses
   `IMMEDIATELY`). For the **very first** boot we still resolve `initialData` from local (as today),
   then `updateScene(...)` once the pull lands — race-free, non-blocking (§9.7).

4. **Load referenced files (M2 — concrete, not "loadImages-equivalent"):** collect image `fileId`s
   from the applied scene, then:
   ```
   fileManager.getFiles(fileIds).then(({ loadedFiles, erroredFiles }) => {
     if (loadedFiles.length) excalidrawAPI.addFiles(loadedFiles);
     updateStaleImageStatuses({
       excalidrawAPI,
       erroredFiles,                                  // Map<FileId, true>
       elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
     });
   });
   ```
   This is the exact `addFiles` + `updateStaleImageStatuses` sequence the local path uses
   (`App.tsx:500-508`); missing objects resolve to `status:"error"` (so broken images don't spin
   forever) rather than hanging. The composed `fileManager.getFiles` also drives `onFileStatusChange`
   → `FileStatusStore` so the export-wait UI behaves.

> Why local-first then patch: it preserves the offline-first guarantee (app is interactive
> instantly), avoids a new blocking await in `initializeScene`, and `updateScene` is exactly how
> cross-tab sync + hashchange already mutate the live scene.

### 3.3 Change flow (push)

`onChange` (`App.tsx:677-727`) today does: (a) `collabAPI.syncElements` (disabled by flag, §5),
(b) `LocalData.save` **only when `!LocalData.isSavePaused()`** (kept untouched). We add a **third,
separate** call:

```
onChange(elements, appState, files):
    [flag off] -> exactly today's behavior
    [flag on ] -> collab branch skipped (§5)
                  if (!LocalData.isSavePaused()) LocalData.save(...)   // unchanged, 300ms debounce
                  supabaseSync.notifyChange(elements, appState, files) // NEW, non-blocking
```

`notifyChange` is **fire-and-forget**, does no awaiting in the `onChange` frame, and is **NOT**
gated by `LocalData.isSavePaused()` (m2-review) — only `LocalData.save` is. Inside the engine:

- **Dirty computation (M3):** compare the incoming scene to the last-synced snapshot using
  **elements + `stripEphemeral(clearAppStateForLocalStorage(appState))`** only. If nothing
  meaningful changed (e.g. a pure pan/zoom/selection/menu-open), **do not** set `dirty`, **do not**
  arm the debounce, return. This is the core M3 fix: viewport/selection churn never triggers an
  upload or bumps `version`.
- if flag off / no `userId` ⇒ return immediately. if offline ⇒ mark `dirty`, set status `offline`,
  do not arm network.
- else set `dirty = true` and (re)arm a **separate debounce**, recommended **2000ms**
  (`SUPABASE_SYNC_DEBOUNCE_MS`, a new `app_constants` value). Rationale: localStorage at 300ms is
  cheap and local; a network upsert at 300ms would hammer Postgres on every keystroke/drag-tick. 2s
  coalesces a burst into one upload while feeling "live enough"; `syncNow` covers impatience.
- **on debounce fire — files FIRST, then row, with M5 semantics** (see §3.5 for the exact ordering
  and failure handling): set status `syncing`; upload files; only if every current-scene file is
  clean, write the boards row; on full success set `synced`, clear `dirty`, store the returned
  `version` into `localMeta`; otherwise set `error`/`offline` and **leave `dirty` true** so the
  next `notifyChange`/reconnect retries.

This guarantees R1 (onChange hot path): zero synchronous network work, zero added awaits on the
editor's critical path.

### 3.4 File flow (composed `FileManager` — NOT a subclass) (B2)

We construct a `FileManager` by **composition**, exactly as Collab does (`Collab.tsx:152-200`).
**No subclassing.** The public `FileManager.saveFiles({ elements, files })` /
`FileManager.getFiles(ids)` methods (`FileManager.ts:92, 139`) keep all the dedup + status tracking;
we only inject the two storage-I/O callbacks. The factory closes over `userId`:

```ts
function createSupabaseFileManager(userId: string) {
  return new FileManager({
    onFileStatusChange: FileStatusStore.updateStatuses.bind(FileStatusStore),

    // INJECTED _getFiles — signature per FileManager.ts:50-53
    getFiles: async (fileIds: FileId[]): Promise<{
      loadedFiles: BinaryFileData[];
      erroredFiles: Map<FileId, true>;          // NOTE: value type is `true` here
    }> => { /* download scene-files/{userId}/{id}; reconstruct BinaryFileData;
              missing object ⇒ erroredFiles.set(id, true) */ },

    // INJECTED _saveFiles — signature per FileManager.ts:54-57
    saveFiles: async ({ addedFiles }: { addedFiles: Map<FileId, BinaryFileData> }): Promise<{
      savedFiles: Map<FileId, BinaryFileData>;   // NOTE: value type is BinaryFileData
      erroredFiles: Map<FileId, BinaryFileData>; // NOTE: value type is BinaryFileData (NOT `true`)
    }> => { /* for each [fileId, data] in addedFiles: upload bytes to
              scene-files/{userId}/{fileId} via client.storage...upload(path, blob,
              { upsert: true }); on ok → savedFiles.set(fileId, data);
              on failure → erroredFiles.set(fileId, data) */ },
  });
}
```

**Critical contract details (the review flagged these as easy to get wrong):**
- The **public** method the *app/engine* calls is `fileManager.saveFiles({ elements, files })`
  (object with `elements` + `files`) — same shape `LocalData._save` uses. The `{ addedFiles }`
  shape is the **injected callback**, not the public method (B2.2). Do not conflate them.
- The two errored maps have **different value types**: the injected `getFiles` errored map is
  `Map<FileId, true>`; the injected `saveFiles` errored map is `Map<FileId, BinaryFileData>`
  (verified `FileManager.ts:52-56`; Collab supplies `BinaryFileData` at `Collab.tsx:188-197`).
- Reconstructed `BinaryFileData` carries `{ id, dataURL, mimeType, created }`; set
  `lastRetrieved: Date.now()` on read (as the local manager does, `LocalData.ts:184`). `version` is
  optional and dedup defaults it to `1` (`FileManager.ts:88-90`) — fine; a later local edit to the
  image (version 2) simply re-uploads (m5-review).
- Like Collab's injected callbacks, ours may `throw` (e.g. no `userId`); the public
  `FileManager.saveFiles` does **not** throw on a per-file error — it returns them in `erroredFiles`
  (`FileManager.ts:115-137`). The engine therefore inspects the returned `erroredFiles` (M5), and
  also try/catches the whole call for hard throws.

Integration: this **one** `fileManager` instance is owned by the engine and used for both push
(saving images alongside the scene, §3.3/§3.5) and pull (the post-pull "load files" step, §3.2
step 4) — it replaces the Firebase/IDB branch for the sync path. When the flag is on, the
image-load branch in `loadImages` (`App.tsx:496-516`) routes initial-load file fetches through this
`fileManager.getFiles` instead of `LocalData.fileStorage`/`loadFilesFromFirebase`. (The engine's
instance is the sync-relevant one; `LocalData.fileStorage` continues to serve the local IDB cache.)

### 3.5 Push pipeline: ordering, version guard, and file-failure semantics (M5 + M1)

`pushBoard` runs **files first, row second**, and is gated on file completeness:

```
push():                                  // runs on debounce fire or syncNow
  status = 'syncing'
  // 1) FILES FIRST
  const { erroredFiles } = await fileManager.saveFiles({ elements, files })
  const currentSceneErrored = [...erroredFiles.keys()]
        .filter(id => sceneReferences(id))         // only files the current scene points at
  if (currentSceneErrored.length) {
     // M5: do NOT advance version, do NOT mark synced, stay dirty so it retries
     status = isNetworkError ? 'offline' : 'error'   // surfaces 'Sync error' in the button
     // dirty stays true; next notifyChange / reconnect / syncNow retries.
     // NOTE: FileManager will not re-add an errored file unless its version changes
     //       (FileManager.ts:107 "if errored during save, won't retry due to this check"),
     //       so before a retry the engine calls fileManager.reset() to clear erroredFiles_save.
     return
  }
  // 2) ROW SECOND — only reached when every current-scene file uploaded cleanly
  try {
    const { version } = (localMeta.version == null)
      ? await boardRepository.insertBoard(userId, serializeScene(...))            // first push
      : await boardRepository.pushBoard(userId, serializeScene(...), localMeta.version) // guarded
    localMeta.version = version            // persist to LOCAL_STORAGE_SUPABASE_META
    dirty = false
    status = 'synced'
  } catch (err) {
    if (isStaleVersion(err)) { await pullAndReconcile(); return }  // 0 rows → re-pull (table §3.2)
    status = isNetworkError(err) ? 'offline' : 'error'             // dirty stays true → retry
  }
```

**Boards-row write relative to file uploads (explicit, per M5):** the row is written **only after**
`fileManager.saveFiles` returns with **zero** errored files among the current scene's referenced
images. A transient upload failure thus never strands an image reference in the synced row — the
row and its Storage objects stay consistent, and the scene stays `dirty` until a later flush
succeeds.

**Version guard (M1 + m1-review — INSERT vs guarded UPDATE):** Supabase `.upsert()` cannot express
`WHERE version = :expected`, so we use two explicit paths:
- **First push** (`localMeta.version == null`): `insertBoard` = `.insert({...})` (RLS `with check`
  enforces ownership). On unique-violation (a row already exists, e.g. created by another device),
  fall through to a re-pull + the §3.2 table.
- **Subsequent push:** `pushBoard` = `.update({ document, app_state, version: expected + 1 })
  .eq('user_id', uid).eq('version', expected).select().maybeSingle()`. **0 rows updated** ⇒ a racing
  writer advanced `version` ⇒ re-pull and re-evaluate (do not blindly overwrite). The returned row
  yields the new `version` for `localMeta`.

For the single-active-session product this guard is belt-and-suspenders; it is also what makes the
multi-tab case (§9.3) safe.

### 3.6 Manual "Sync now"

`SyncStatusButton` (and the MainMenu "Sync now" item) call `supabaseSync.syncNow()` → engine cancels
the pending debounce timer and **immediately** runs the §3.5 push pipeline, driving status
`syncing → synced/error`. If offline, it attempts once and surfaces `offline/error`. Satisfies SC3.

### 3.7 Offline handling — sync module owns it; no `isOfflineAtom` write (M4)

- **The engine owns its own `online`/`offline` `window` listeners** so it does not depend on
  `Collab` being mounted. It represents offline **purely** as `syncStatusAtom = 'offline'`. It does
  **not** import or write `isOfflineAtom` (which is defined in the now-dormant
  `collab/Collab.tsx:100` and would be a backwards dependency fighting the dormancy goal, §0.2).
  Offline is surfaced to the user through `SyncStatusButton` (see §2.5 mockup, OFFLINE state), not
  through the collab-gated banner at `App.tsx:1021` (which is dead under the flag anyway, since
  `isCollaborating` is forced `false`).
- While offline: `notifyChange` marks the scene `dirty` (if the change is meaningful per M3) and
  sets status `offline`; it does **not** attempt the network (the debounce just no-ops the upload).
- On `online`: if `dirty`, the engine flushes one push of the latest scene (§3.5). Because the sync
  unit is the whole scene (not an op queue), "queue" is trivially "the scene is dirty"; there is no
  op backlog to replay. This is a direct benefit of the one-row model.
- `navigator.onLine` is the cheap gate; a failed push with a network-class error also flips status
  to `offline` defensively (§3.5).

> Decision recorded for M4: option (b) — "offline is a `syncStatusAtom` value" — is chosen over (a)
> "introduce a separate `syncOfflineAtom`". Reason: offline is already a state in the status
> machine, the button already reads `syncStatusAtom`, and one atom is simpler. If a future feature
> needs a standalone offline signal, promoting it is trivial. We do **not** move/re-export
> `isOfflineAtom`; the sync path simply never references it.

### 3.8 Flush on unload

`LocalData.flushSave()` already runs on blur/unload/visibility (`App.tsx:618-649, 653-674`). The
hook adds a best-effort `engine.flush()` on the same events (and on hook unmount). `engine.flush()`
is **independent of `LocalData.isSavePaused()`** (m2-review) — it must still flush while
`document.hidden`, which is exactly when blur/visibility fire. Network flush on `beforeunload` is
unreliable by spec; the design accepts that the *local* save is the durable one and the cloud
catches up on next load — consistent with local-first (§9 edge case). `flush()` runs the §3.5
pipeline only if `dirty`.

---

## 4. Auth integration

- **Provider/UI:** default **email magic link** (`signInWithOtp({ email })`) — no extra OAuth
  provider config needed by the stakeholder (matches A5 / R5). Provider is a documented config
  point; OAuth can be added later without touching the sync engine.
- **Session into the app:** `sessionAtom: Session | null` in a new atoms module; a single
  `useInitSupabaseAuth()` effect (mounted once near `ExcalidrawWrapper` or in `useSupabaseSync`)
  calls `auth.getSession()` on boot and subscribes `supabase.auth.onAuthStateChange` to keep the
  atom live across login/logout/token refresh. Derived `userIdAtom = session?.user.id ?? null`.
- **Sign-in/out + Sync now UI location:** in `MainMenu` via `AppMainMenu`
  (`components/AppMainMenu.tsx`). When the flag is on, render: a **Sync now** item (calls
  `syncNow()`; disabled when signed-out), and a Supabase auth section — signed-out ⇒ "Sign in to
  sync" (opens the §2.5 prompt: email field + "Send magic link"); signed-in ⇒ user email + "Sign
  out". The existing Excalidraw+ "Sign in/Sign up" `ItemLink` (`AppMainMenu.tsx:52-60`) is left in
  place but can be hidden under the flag to avoid confusion. (See §2.5 mockup.)
- **Gating:** sync is hard-gated on auth. `userId == null` ⇒ engine stays local-only: no client
  calls; status is `idle` and the button shows a "Sign in to sync" affordance. No cloud read/write
  ever happens without a session, so RLS is never hit unauthenticated.

---

## 5. Disable strategy for collab + share (flag-gated, code dormant)

**Principle:** when `isSupabaseSyncEnabled()` is `true`, every entry point to live collaboration
and shareable-link creation/import is neutralized at the *call site / render gate*, while the
underlying `collab/`, `share/`, `data/firebase.ts`, `data/index.ts` code is left intact and
compiled. Flag off ⇒ identical to today.

### 5.1 B1 fix — `renderTopRightUI` must NOT early-return on missing `collabAPI`

The real guard (`App.tsx:955-958`) is:
```ts
renderTopRightUI={(isMobile) => {
  if (isMobile || !collabAPI || isCollabDisabled) {
    return null;                       // ← with the flag on, collabAPI is ALWAYS null (Collab unmounted),
  }                                    //    so this returns before any SyncStatusButton branch
  ... // collab UI
}}
```
Because the flag also unmounts `<Collab>` (§5.2), `collabAPIAtom` is never set (it is only set in
`Collab.componentDidMount`, `Collab.tsx:243`), so `collabAPI` stays `null` forever. The old HLD
phrasing ("the guard stays; we add the flag branch") was therefore **wrong** — it could never reach
the button. **New control flow (the flag path is evaluated BEFORE the `!collabAPI` check):**

```ts
renderTopRightUI={(isMobile) => {
  if (isMobile) {
    return null;
  }
  if (isSupabaseSyncEnabled()) {
    // independent of collabAPI — renders even though Collab is unmounted and collabAPI is null
    return (
      <div className="excalidraw-ui-top-right">
        <SyncStatusButton onSyncNow={supabaseSync.syncNow} />
      </div>
    );
  }
  if (!collabAPI || isCollabDisabled) {
    return null;
  }
  return (/* existing collab UI: ExcalidrawPlusPromoBanner, CollabError, LiveCollaborationTrigger */);
}}
```

So the `SyncStatusButton` (DoD / SC3) renders whenever the flag is on, regardless of `collabAPI`.
The mobile early-return is preserved; the collab branch is unchanged when the flag is off.

### 5.2 Per-site treatment (verified line anchors)

| Site | File:line | Treatment when flag on |
|---|---|---|
| `renderTopRightUI` early-return + `LiveCollaborationTrigger` | `App.tsx:955-978` | **Per §5.1:** restructure so `if (isMobile) return null;` then `if (isSupabaseSyncEnabled()) return <SyncStatusButton/>;` then the original `if (!collabAPI || isCollabDisabled) return null;` + collab UI. Renders the sync button independent of `collabAPI` (B1). |
| `<Collab>` render | `App.tsx:1038-1040` | Gate becomes `excalidrawAPI && !isCollabDisabled && !isSupabaseSyncEnabled()` ⇒ Collab does not mount, no socket, no `collabAPIAtom` set. (The engine owns its own offline listeners, §3.7, so unmounting Collab doesn't lose offline detection.) |
| `<ShareDialog>` render + `onExportToBackend` wiring | `App.tsx:1042-1057` | Keep the import (dormant), but when flag on don't render it at all. The "collaborationOnly" path is dead because no caller opens it. |
| `onCollabDialogOpen` | `App.tsx:790-793` | No-op when flag on (callers also gated). |
| `MainMenu` LiveCollaborationTrigger item | `AppMainMenu.tsx:31-36` (gated by `isCollabEnabled`) | Pass `isCollabEnabled={!isCollabDisabled && !isSupabaseSyncEnabled()}` from `App.tsx:989` so the item disappears. Same for `AppWelcomeScreen` (`App.tsx:995`). The new Sync now / auth items render in its place (§4, §2.5). |
| Command palette "Live Collaboration" | `App.tsx:1069-1087` | **Add** `predicate: () => !isSupabaseSyncEnabled()` (item has no predicate today — n1; this is an addition, not a modification). |
| Command palette "Stop Session" | `App.tsx:1088-1109` | `predicate` already `!!collabAPI?.isCollaborating()`; with Collab unmounted `collabAPI` is null ⇒ naturally hidden. Add explicit flag for clarity. |
| Command palette "Share" | `App.tsx:1110-1129` | Hidden under flag (`predicate: () => !isSupabaseSyncEnabled()`; today it is `predicate: true` — n1). Local "Save to disk"/"Export image" remain via MainMenu. |
| `onExportToBackend` / `exportToBackend` | `App.tsx:733-771`, `data/index.ts:248-307` | Left intact; no UI path calls it when flag on (Share command + ShareDialog gated). No stub needed. |
| Collab link parsing | `data/index.ts:138-146` (`getCollaborationLinkData`) | Neutralize at the **consumer** in `initializeScene` (`App.tsx:248`): when flag on, force `roomLinkData = null` so the `roomLinkData && opts.collabAPI` branch (`App.tsx:327-359`) is never taken. Parser stays unchanged (dormant). |
| `isCollaborating` initial value | `App.tsx:408-410` (`isCollaborationLink(href)`) | When flag on, initialize `isCollaborating` to `false`, so the `is-collaborating` root class and collab UI never light up from a `#room=` URL (also keeps the offline-collab banner dark — n4). |
| `#json=` import | `App.tsx:226-228, 259-280` | When flag on, skip the `jsonBackendMatch` branch so `importFromBackend` isn't called. Dormant. |
| `#url=` import | `App.tsx:229, 302-325` | When flag on, skip the `externalUrlMatch` branch. Dormant. |
| Hashchange handler | `App.tsx:532-557` | When flag on, the collab `stopCollaboration`/`isCollaborationLink` checks are skipped (no-op because `collabAPI` is null); `initializeScene` re-run still works for library tokens. |

Net effect: with the flag on there is **no UI affordance and no URL path** to start a room or
create/import a share link (DoD + SC5); flag off ⇒ unchanged (R3 — collab tests run flag-off and
stay green).

---

## 6. Config & env

### 6.1 New env vars

```
VITE_APP_SUPABASE_URL=            # hosted Supabase project URL
VITE_APP_SUPABASE_ANON_KEY=       # project anon/public key (RLS enforces isolation)
VITE_APP_FEATURE_SUPABASE_SYNC=   # "true" to enable sync + disable collab/share; default off
```

- **Typed** in `excalidraw-app/vite-env.d.ts` (`ImportMetaEnv`, currently lines 4-45) — add the
  three keys as `string`.
- **No `vite.config.mts` change required:** `loadEnv(mode, "../")` + `envDir: "../"` already expose
  all `VITE_APP_*` to `import.meta.env` (confirmed `vite.config.mts:13, 23`; no `define` allowlist
  — n3).
- **`.env.example`** (new, at repo root next to `.env.development`/`.env.production`): documents the
  three vars + a pointer to the SQL/Storage setup doc. **Document the anon key only — never a
  service-role key** (n2).

### 6.2 Reading the flag + client

- `featureFlags.ts`: `export const isSupabaseSyncEnabled = () =>
  import.meta.env.VITE_APP_FEATURE_SUPABASE_SYNC === "true";` (string compare — same convention as
  `VITE_APP_ENABLE_PWA === "true"` and `VITE_APP_DISABLE_PREVENT_UNLOAD !== "true"` at
  `App.tsx:662`).
- `client.ts`: memoized singleton. `getSupabaseClient()` returns `null` if `!isSupabaseSyncEnabled()`
  or either URL/key is empty; otherwise lazily `createClient(url, anonKey, { auth: {
  persistSession: true, autoRefreshToken: true } })` and caches it. All other modules go through
  this — never call `createClient` directly, never read env outside `client.ts`/`featureFlags.ts`,
  **never use a service-role key** (n2).

### 6.3 New `STORAGE_KEYS` entry (m4)

Add to `STORAGE_KEYS` in `app_constants.ts:39-53` (the `as const` object):
```ts
LOCAL_STORAGE_SUPABASE_META: "excalidraw-supabase-meta",   // persists localMeta { version }
```
The engine reads/writes `localMeta = { version }` here (§3.2). Also add a new time constant
`SUPABASE_SYNC_DEBOUNCE_MS = 2000` alongside `SAVE_TO_LOCAL_STORAGE_TIMEOUT` (§3.3). List both as
edit sites in the anchor map.

---

## 7. Testing strategy (high level)

Unit tests only; **mock `@supabase/supabase-js`** at module level (no live instance — R4). Pattern
mirrors `vi.mock("../../excalidraw-app/data/firebase.ts", …)` and `vi.mock("socket.io-client", …)`
in `tests/collab.test.tsx`.

- **Mock shape:** `vi.mock("@supabase/supabase-js", () => ({ createClient: () => mockClient }))`
  where `mockClient` is a chainable stub whose methods are per-method `vi.fn()`s the test can
  program (m6): `.from().select().eq().maybeSingle()`, `.from().insert()`,
  `.from().update().eq().eq().select().maybeSingle()` resolve to canned `{ data, error }`;
  `.storage.from().upload()/.download()` resolve to canned blobs; `.auth.getSession()/
  onAuthStateChange()/signInWithOtp()/signOut()` are spies. A `createSupabaseMock()` helper keeps
  tests terse and lets each test set per-method return values and assert calls.
- **What gets tested:**
  - `boardRepository`: `serializeScene` produces the right `document`/`app_state` subset — assert
    `app_state` equals `stripEphemeral(clearAppStateForLocalStorage(...))` and that **no** ephemeral
    key (scrollX/Y, zoom, selectedElementIds, …) survives (M3). `pushBoard` issues a guarded
    `UPDATE ... version = expected + 1` (m1-review); first push uses `insert`; `pullBoard` maps a
    row → `{document, app_state, version, updated_at}`; `deserializeToInitialData` round-trips.
    (SC1, SC2)
  - `fileManager` (composition): `saveFiles({elements, files})` (public) routes image elements to
    the injected callback which uploads to `scene-files/{userId}/{fileId}` (assert path); the
    injected `saveFiles` returns `erroredFiles` as `Map<FileId,BinaryFileData>` and `getFiles` as
    `Map<FileId,true>` (B2 type assertions); `getFiles` reconstructs `BinaryFileData` with
    `lastRetrieved` set; missing object ⇒ `erroredFiles`. Path/key derivation explicitly tested
    (R6). (SC4)
  - `SyncEngine` (framework-free, **fake timers**): a **pan/zoom/selection-only** `notifyChange`
    does **not** arm the debounce / does **not** push (M3); a meaningful change debounces to one
    push after `SUPABASE_SYNC_DEBOUNCE_MS`; `syncNow` flushes immediately; **file-upload failure**
    keeps `dirty`, does not bump `version`, surfaces `error`, and the row is **not** written (M5);
    status transitions `idle→syncing→synced` and `→error`; offline ⇒ no network + `offline` status
    + dirty retained; the §3.2 **version table** picks the right winner (cloud-newer-not-dirty ⇒
    cloud; dirty ⇒ local re-push with `version+1`; null cloud ⇒ insert local). (SC1, SC3)
  - post-pull file apply: asserts `addFiles` + `updateStaleImageStatuses` run with the returned
    maps so missing files become `status:"error"` (M2).
  - `auth`/session atom: `onAuthStateChange` updates `sessionAtom`; sign-out clears it.
- **Proving collab/share disabled (SC5):** with `VITE_APP_FEATURE_SUPABASE_SYNC` true in the test
  env, render `<ExcalidrawApp/>` and assert: **`SyncStatusButton` IS in the DOM** (B1 regression
  guard) and no `LiveCollaborationTrigger`; `getCollaborationLinkData`/`importFromBackend` not
  called for a `#room=`/`#json=` href; the Share command predicate is false; `<Collab>`'s socket
  constructor never invoked. New `tests/supabase-sync.test.tsx`. Existing `collab.test.tsx` runs
  flag **off** and must stay green (R3).
- **Regression:** full `yarn vitest run` no new failures vs baseline (SC7); flag defaults off so the
  existing suite/snapshots are unaffected.

---

## 8. Key decisions (with alternatives considered)

### 8a. Sync orchestration: hook wrapping an imperative engine (vs pure hook / pure controller)
**Chosen:** `useSupabaseSync` hook owning a `SyncEngine` class instance (`useRef`).
**Rejected — pure hook (all logic in the hook):** debounce/status/offline/dirty state would live in
refs+state tangled with render; can't unit-test the data path without `render()`; closures
re-created on deps changes risk stale debounce timers. **Rejected — pure singleton controller, no
hook:** binding to React-scoped `excalidrawAPI` + jotai atoms and doing flush-on-unmount is awkward
from a module singleton. The split gives testable core + idiomatic React lifecycle, and matches
existing `Collab` (imperative class → atom) and `LocalData` (framework-free class) patterns.

### 8b. One `jsonb` document vs normalized per-element rows
**Chosen:** single `document jsonb` blob (+ `app_state jsonb`).
**Rejected — per-element rows:** Excalidraw already treats the scene as an array it serializes
wholesale (localStorage stores the whole array; share/collab compress the whole scene). Per-element
rows would require a diffing/sync engine, per-row RLS, fractional-index ordering, and partial-failure
handling — reinventing collaboration plumbing for a single-session LWW product. The blob keeps the
upsert atomic and the version-based LWW rule trivial. Whole-scene re-upload per debounce is mitigated
by the 2s debounce, the M3 dirty-gate (no push on viewport churn), and the §9.1 row-size mitigation.

### 8c. Supabase Storage for files vs inlining files in the row
**Chosen (already locked):** Storage bucket, one object per `fileId`.
**Justification vs inlining:** image `dataURL`s are large (base64; multi-MB each; cap
`FILE_UPLOAD_MAX_BYTES = 4 MiB`, `app_constants.ts:12`). Inlining into `document` jsonb would bloat
the row toward Postgres' jsonb/TOAST limits, re-upload all image bytes per scene push, and defeat
CDN/byte-range delivery. Storage gives per-file dedup, independent caching, and a small `boards`
row. Files are union/append-only (M2). Tradeoff: two round-trips (files then row) on push, which the
engine sequences with explicit file-completeness gating (§3.5, M5).

### 8d. Realtime vs polling vs debounced push
**Chosen:** debounced push + pull-on-load/login (no Realtime, no polling).
**Rejected — Supabase Realtime subscriptions:** explicitly out of scope (single active session,
LWW; not concurrent editing). **Rejected — periodic polling:** wasteful and still not real-time;
pull-on-load + manual "Sync now" covers the "see it on another device" need. Realtime is noted as a
clean future extension: subscribe to the user's `boards` row and `updateScene({ captureUpdate:
NEVER })` on remote change — the serialization boundary and apply-path already support it.

### 8e. Feature-flag-gated disable vs hard removal of collab/share
**Chosen (locked):** flag-gated neutralization, code dormant.
**Justification vs deletion:** App.tsx threads collab/share through `onChange`, `initializeScene`,
hashchange, render, and command palette; ripping it out risks breaking unrelated tests/snapshots.
Flag gating is low-risk, fully revertible, keeps the upstream diff small, and lets the collab test
suite keep running flag-off (R3). Dependency removal (socket.io, firebase) is likewise deferred.

---

## 9. Risks / edge cases the LLD must address

1. **Large scene payload & Postgres row limits.** `document` jsonb can grow with element count.
   *LLD must:* set a size threshold (~1MB serialized) and define escalation: first **compress** the
   jsonb client-side (reuse `compressData` from `@excalidraw/excalidraw/data/encode`, already used
   by the share path) into a `bytea`/text column; if still too large, store the document blob in the
   **same Storage bucket** (`scene-files/{user_id}/document.json`) and keep only a pointer +
   `version` in the row. v1 ships plain-jsonb; the LLD specifies the threshold + the switch.
2. **Debounce vs unmount / flush-on-unload.** The 2s push debounce can have a pending upload when
   the tab closes or the hook unmounts. *LLD must:* flush on hook unmount and on blur/visibility
   (alongside `LocalData.flushSave`, `App.tsx:618-649, 653-674`); `engine.flush()` is **not** gated
   by `isSavePaused()` (m2-review); accept that `beforeunload` network flushes are best-effort —
   durability is the local save, cloud reconciles next load. Define exactly which events trigger
   `engine.flush()`.
3. **Multiple tabs (existing `tabSync`).** Two tabs on one device each run an engine and could both
   push. *LLD must:* lean on existing `tabSync`/`isBrowserStorageStateNewer` (`App.tsx:559-616`) so
   a tab applies the other tab's local update before pushing, and rely on the **version-guarded
   conditional UPDATE** (§3.5) so a stale tab's push gets 0 rows and re-pulls rather than clobbering.
   Cross-*device* concurrency remains version-LWW by design (§3.2 table).
4. **Auth token expiry.** *LLD must:* configure `autoRefreshToken: true` / `persistSession: true`;
   on an auth-error push/pull, surface `error`, attempt a session refresh / re-pull, and if the
   session is truly gone drop to local-only (clear `sessionAtom`) **without losing the dirty scene**
   (it stays dirty for the next sign-in).
5. **RLS failure surfaced as sync error.** A misconfigured policy / wrong `user_id` yields a
   Postgres/Storage permission error. *LLD must:* map these to `syncStatusAtom = 'error'` with a
   readable message in the `SyncStatusButton` tooltip ("Sync failed: permission denied"), never a
   silent no-op — this is also how the stakeholder validates RLS live.
6. **Orphaned Storage objects (image GC).** Deleting an image from the scene doesn't delete its
   Storage object (files are union/append-only, M2). *Future work* (not v1): a
   `clearObsoleteFiles`-style sweep (mirroring `LocalFileManager.clearObsoleteFiles`,
   `LocalData.ts:54-70`) listing `scene-files/{user_id}/` and removing objects absent from the
   current scene. LLD leaves a hook/TODO; does not implement.
7. **First-load race (pull vs initialData).** *LLD must:* adopt the local-first-then-`updateScene`-
   patch approach (§3.2 steps 3-4) with `captureUpdate: NEVER` for the background login-pull, to keep
   `initializeScene` non-blocking and race-free, and to avoid polluting undo history (m3-review).
8. **Empty-cloud detection correctness.** `pullBoard` must distinguish "no row" (first login → push
   local) from "row with empty document" (user genuinely cleared the canvas elsewhere → cloud wins
   per the version table). *LLD must:* use row presence (`maybeSingle()` → `null`) for first-login,
   not `document.length === 0`.

---

## Appendix — verified anchor map (App.tsx unless noted)

| Concern | Anchor |
|---|---|
| imports (collab atoms, data/index) | `App.tsx:96-115` |
| `initializeScene` def | `App.tsx:215-371` (hash parse 224-229; collab branch 327-359) |
| `excalidrawAPI = useExcalidrawAPI()` | `App.tsx:374` |
| atoms read (`shareDialogState`, `collabAPI`, `isCollaborating`) | `App.tsx:406-411` |
| initial-load effect + hashchange + tabSync + unload | `App.tsx:522-650` (apply via `updateScene` 547-553; tabSync apply `captureUpdate:NEVER` ~574) |
| `loadImages` (file-load patterns) | `App.tsx:440-520` (local initial-load `addFiles`+`updateStaleImageStatuses` **500-508**) |
| `onChange` | `App.tsx:677-727` (collab 682-684; `isSavePaused` gate 688; LocalData.save 689) |
| `onExportToBackend` | `App.tsx:733-771` |
| `onCollabDialogOpen` | `App.tsx:790-793` |
| `renderTopRightUI` / `LiveCollaborationTrigger` | `App.tsx:955-978` (early-return **956**; trigger 969-975) — B1 |
| MainMenu / WelcomeScreen collab props | `App.tsx:986-996`; `AppMainMenu.tsx:31-36` (LiveCollab item); auth ItemLink `AppMainMenu.tsx:52-60` |
| `<Collab>` render gate | `App.tsx:1038-1040` |
| offline-collab banner | `App.tsx:1021` (`isCollaborating && isOffline`) — dead under flag |
| `<ShareDialog>` render | `App.tsx:1042-1057` |
| command palette items | `App.tsx:1067-1129` (LiveCollab 1069-1087 no predicate today; Stop 1088-1109; Share 1110-1129 `predicate:true`) |
| `getCollaborationLinkData` / `isCollaborationLink` | `data/index.ts:133-146` |
| `importFromBackend` / `exportToBackend` | `data/index.ts:202-242` / `248-307` |
| `FileManager` contract (composition) | constructor `FileManager.ts:45-65`; public `saveFiles({elements,files})` **92**; injected `_saveFiles({addedFiles})` returns `{savedFiles,erroredFiles}` both `Map<FileId,BinaryFileData>` **54-57,116-131**; public `getFiles` **139**; `_getFiles` errored `Map<FileId,true>` **50-53**; **no-retry comment 107**; `updateStaleImageStatuses` 272-296; `reset()` 212 |
| Collab's composed FileManager (reference) | `Collab.tsx:152-200` (`new FileManager({...})`, `isOfflineAtom` 100) |
| `LocalData.save/flushSave/fileStorage/isSavePaused` | `data/LocalData.ts` (`isSavePaused` 164; `lastRetrieved` set 184) |
| persisted appState subset + ephemeral keys | `clearAppStateForLocalStorage` `appState.ts:283`; conf `appState.ts:150-256` (ephemerals: scrollX/Y 220-221, zoom 242, selectedElementIds 222, selectedGroupIds 224, previousSelectedElementIds 217, selectedLinearElement 245, editingGroupId 180, openMenu 213, openSidebar 215, cursorButton 176); `clearAppStateForDatabase` (`server` subset) 291 |
| `importFromLocalStorage` | `data/localStorage.ts:37-74` (applies `clearAppStateForLocalStorage` on read) |
| STORAGE_KEYS / timeouts | `app_constants.ts:39-53` (add `LOCAL_STORAGE_SUPABASE_META`); add `SUPABASE_SYNC_DEBOUNCE_MS` near 2 |
| env loading | `vite.config.mts:13, 23`; types `vite-env.d.ts:4-45` |
| jotai atom helpers | `app-jotai.ts` |
| test mock pattern | `tests/collab.test.tsx` (firebase + socket.io mocks) |
