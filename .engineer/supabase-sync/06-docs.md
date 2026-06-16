# 06 — Documentation

Documentation-phase summary for the Supabase-backed sync feature. Written for humans and future
agents. The implementation is complete and all tests pass (see [`test-report.md`](./test-report.md)).

## Overview

This feature adds **per-user cloud sync** of the working scene (elements + app state) and its image
files to the Excalidraw app, backed by a self-hosted [Supabase](https://supabase.com) project.
Users sign in via **Supabase Auth email magic link**; once signed in, the canvas is **auto-synced
on a debounce** (≈2s after edits settle) and can also be flushed on demand via a **"Sync now"**
button. Sync is layered on top of the existing local-first storage (`LocalData` remains the offline
source of truth). The whole feature sits behind a single build-time feature flag. When the flag is
**on**, live collaboration and shareable links are **hidden** (the canvas becomes a private,
single-user cloud document); when the flag is **off** (the default), the app behaves exactly as
upstream Excalidraw with collaboration + share links intact and no Supabase dependency active.

## How to enable / disable

The feature is controlled by the build-time flag **`VITE_APP_FEATURE_SUPABASE_SYNC`**
(read in [`featureFlags.ts`](../../excalidraw-app/data/supabase/featureFlags.ts);
`isSupabaseSyncEnabled()` returns `true` only when the value is the exact string `"true"`).

| Flag value | Behavior |
|---|---|
| unset / anything ≠ `"true"` (**default**) | Original app: live collaboration + share links work; **no** Supabase client is created and the sync code is inert. |
| `"true"` | Supabase sync on; collaboration + share-link UI and URL handling are hidden/neutralized. |

Three environment variables (documented in
[`excalidraw-app/.env.example`](../../excalidraw-app/.env.example)):

- `VITE_APP_SUPABASE_URL` — your Supabase Project URL.
- `VITE_APP_SUPABASE_ANON_KEY` — the project's **anon public** API key. **Never** use the
  `service_role` key in the client; it bypasses Row Level Security.
- `VITE_APP_FEATURE_SUPABASE_SYNC` — `"true"` to turn the feature on.

If the flag is on but URL / anon key are missing, the client resolves to `null`, logs a warning, and
the app falls back to local-only (it never crashes).

**Provisioning the Supabase project** (migration, Storage bucket, email auth) is a one-time manual
step documented in **[`supabase/README.md`](../../supabase/README.md)** — not duplicated here.

## Architecture (brief)

Data + control layer lives under
[`excalidraw-app/data/supabase/`](../../excalidraw-app/data/supabase/):

| Module | Responsibility |
|---|---|
| `client.ts` | Lazy singleton `getSupabaseClient()`; returns `null` when the flag is off or env is missing (cached so it's evaluated once). |
| `featureFlags.ts` | `isSupabaseSyncEnabled()` — reads `VITE_APP_FEATURE_SUPABASE_SYNC`. |
| `auth.ts` | Null-safe wrappers over `supabase.auth`: `signInWithMagicLink` (via `signInWithOtp`), `signOut`, `getSession`, `onAuthStateChange`. |
| `sessionAtom.ts` | `sessionAtom` + derived `userIdAtom`; `useInitSupabaseSession()` seeds and subscribes to auth state. |
| `syncStatusAtom.ts` | `syncStatusAtom` holding `{ status, lastSyncedAt, error }` where status ∈ `idle`/`syncing`/`synced`/`error`/`offline`; the engine writes it, the UI reads it. |
| `boardRepository.ts` | Postgres I/O: `serializeScene` (drops deleted elements + ephemeral keys), `pullBoard`, `pushBoard` (version-guarded upsert returning a `PushResult` ok/conflict union). |
| `supabaseFiles.ts` | Storage adapter: `createSupabaseFileManager` / `createSupabaseFileCallbacks` mapping to the `FileManager` `getFiles`/`saveFiles` contract; uploads/downloads at `{user_id}/{fileId}` with `dataURL ↔ Blob` conversion. |
| `ephemeralAppState.ts` | `EPHEMERAL_APPSTATE_KEYS` + `stripEphemeral` — excludes viewport/selection/tool/transient-UI keys from the synced payload and the dirty-check. |
| `syncEngine.ts` | Framework-free orchestrator: debounce, dirty-check, push pipeline (files first, then version-guarded row), pull+reconcile on `start()`, `syncNow`/`flush`, offline handling, conflict re-pull, local-meta persistence. Never touches `excalidrawAPI`. |
| `useSupabaseSync.ts` | React adapter owning one `SyncEngine`; implements `applyRemoteScene` (the only DOM-mutating step), wires status into the atom, starts/stops on login/logout, flushes on unload. |

UI components in [`excalidraw-app/components/`](../../excalidraw-app/components/):

- `SyncStatusButton.tsx` (+ `.scss`) — top-right status pill (synced/syncing/error/offline) with a
  "Sync now" action; also surfaces sign-in/out.
- `SignInDialog.tsx` — magic-link email sign-in dialog.

Schema: [`supabase/migrations/0001_init_boards.sql`](../../supabase/migrations/0001_init_boards.sql)
— creates the `boards` table, its `updated_at` trigger, RLS policies, and the private `scene-files`
Storage bucket + its RLS policies.

**Data model.** One `boards` row **per user** (`unique(user_id)`), holding `document` (jsonb
elements), `app_state` (jsonb), and an integer `version`. Conflicts use **version-based
last-write-wins** (the integer `version` is the conflict key — bumped by a guarded UPDATE;
`updated_at` is display-only). Image files live in the private **`scene-files`** Storage bucket at
`{user_id}/{fileId}`. RLS on both the table and Storage objects restricts every read/write to
`auth.uid() = user_id` (Storage matches the leading `{user_id}/` path segment), so a user can never
see another user's boards or files.

## Data flow (brief)

- **Edit (push):** App.tsx `onChange` → `notifyChange()` → engine debounces (~2s) → if the
  serialized scene actually changed, push **files first** (`fileManager.saveFiles`), then a
  **version-guarded** `boards` upsert. On success it persists `{version, lastSyncedAt}` to
  local meta and sets status `synced`.
- **Login (pull):** on sign-in, `engine.start(userId)` pulls the cloud row and reconciles local vs
  cloud by version (LWW); the chosen scene is applied via `applyRemoteScene` →
  `excalidrawAPI.updateScene(..., CaptureUpdateAction.NEVER)` then image files are loaded
  (`getFiles` → `addFiles` → `updateStaleImageStatuses`). First login with an empty cloud pushes the
  current local scene up.
- **Sync now (manual):** flushes the pending debounce and pushes immediately; status transitions
  `syncing` → `synced`/`error`.
- **Conflict:** a version-guarded UPDATE that matches 0 rows (a racing writer advanced the version)
  → engine re-pulls and reconciles.
- **Offline:** network-class failures set status `offline`; sync resumes automatically on the next
  change after reconnect (the scene stays dirty).

## How collab / share are disabled

Disabling is **flag-gated hiding, not deletion** — fully revertible by turning the flag off:

- `renderTopRightUI` renders `<SyncStatusButton/>` instead of the `LiveCollaborationTrigger` when
  the flag is on (and before the `!collabAPI` early-return, since `<Collab>` is unmounted under the
  flag).
- The Live-Collaboration menu item is hidden by folding the flag into the existing
  `isCollabEnabled` prop at the `AppMainMenu` / welcome-screen call sites.
- Share-dialog open triggers and `#room=` / `#json=` / `#url=` URL handling
  (`getCollaborationLinkData` in `data/index.ts`, scene-init in `App.tsx`) are neutralized under the
  flag so external scenes/rooms never load.

The underlying collaboration, share, Firebase, and socket.io-client code is left **dormant** (not
removed, deps kept). With the flag off the original behavior returns unchanged.

## Testing

Tests live in
[`excalidraw-app/tests/supabase/`](../../excalidraw-app/tests/supabase/) — 31 tests across 5 files
(`boardRepository.test.ts`, `supabaseFiles.test.ts`, `syncEngine.test.ts`,
`useSupabaseSync.test.tsx`, `disable.test.tsx`). They cover serialization + RLS-shaped repo paths,
the Storage adapter round-trip, the engine (debounce / dirty-check / conflict / offline / syncNow /
reconcile), the hook's pull-apply, and that the collab/share entry points are disabled (including a
full-app render asserting the loading spinner clears under the flag).

Commands (run from repo root):

```bash
yarn test:typecheck                  # TypeScript typecheck
yarn vitest run                      # full test suite (or: yarn vitest run excalidraw-app/tests/supabase)
yarn test:code                       # lint (--max-warnings=0)
```

Unit tests **mock `@supabase/supabase-js`**; there are **no live integration tests** — the
stakeholder validates end-to-end after provisioning their own Supabase project (see
`supabase/README.md`).

## Known limitations / future work

- **No Realtime / concurrent editing.** Sync is single-active-session **last-write-wins**; two
  devices editing simultaneously can clobber via the version guard + re-pull. CRDT/OT merging is out
  of scope.
- **Single working board.** One `boards` row per user. The schema is **extensible** to multiple
  named boards (the `name` column already exists; relax `unique(user_id)` to `unique(user_id, name)`
  and add board-management UI) — not built yet.
- **No orphaned-file GC.** Files deleted from the scene are not yet removed from the `scene-files`
  Storage bucket; reclaiming orphaned objects is future work.
- **Large documents.** The whole scene is stored inline in the `boards` row (jsonb). Moving very
  large documents into Storage (document-in-Storage) is a future optimization; a soft size threshold
  is the likely first step.

## Files changed

**New files**

- `excalidraw-app/data/supabase/` — `client.ts`, `featureFlags.ts`, `auth.ts`, `sessionAtom.ts`,
  `syncStatusAtom.ts`, `boardRepository.ts`, `supabaseFiles.ts`, `ephemeralAppState.ts`,
  `syncEngine.ts`, `useSupabaseSync.ts`.
- `excalidraw-app/components/SyncStatusButton.tsx` (+ `SyncStatusButton.scss`), `SignInDialog.tsx`.
- `excalidraw-app/.env.example` — the three sync env vars.
- `supabase/migrations/0001_init_boards.sql` — schema, RLS, Storage bucket.
- `supabase/README.md` — provisioning guide.
- `excalidraw-app/tests/supabase/` — 5 test files (see Testing above).

**Modified files**

- `excalidraw-app/App.tsx` — FileManager construct + `useSupabaseSync` mount + `onChange` notify +
  `renderTopRightUI` (SyncStatusButton) + flag-gated scene-init / collab-disable + loading-spinner
  guard fix.
- `excalidraw-app/components/AppMainMenu.tsx` — Sync-now + sign-in/out menu items; collab item folded
  behind the flag.
- `excalidraw-app/data/index.ts` — `getCollaborationLinkData` neutralized under the flag.
- `excalidraw-app/vite-env.d.ts` — typings for the three new env vars on `ImportMetaEnv`.
- `excalidraw-app/app_constants.ts` — `LOCAL_STORAGE_SUPABASE_META` + `SUPABASE_SYNC_DEBOUNCE_MS`.
- `excalidraw-app/package.json` — explicit `@supabase/supabase-js` dependency.

> Note: the LLD planned a call-site edit to `AppWelcomeScreen.tsx`, but hiding the collaboration item
> was achieved entirely via `AppMainMenu` + the `isCollabEnabled` fold in `App.tsx`, so
> `AppWelcomeScreen.tsx` was not modified.
