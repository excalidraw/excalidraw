# 04 — Low-Level Design, PART 1: Data / Backend layer (Supabase sync)

_Scope: the data/backend half only — SQL migration, repository, file adapter, sync engine, atoms,
client/flags/auth. UI components, `App.tsx` edits, and tests are owned by the parallel LLD agent and
are **out of scope here**. All file/line refs verified against branch `online-sync` on 2026-06-15._

This part implements HLD §1 (modules), §2 (data model), §3.2/§3.3/§3.5 (flows), §3.7 (offline). It
follows the local-first, fire-and-forget, version-driven-LWW principles from HLD §0.

---

## Verified real signatures (quoted from source — anchors, ±a few lines)

These were read directly; the design below conforms to them exactly.

- **`FileManager` constructor** — `excalidraw-app/data/FileManager.ts:45-65` (confirmed):
  ```ts
  constructor({ getFiles, saveFiles, onFileStatusChange }: {
    getFiles: (fileIds: FileId[]) => Promise<{
      loadedFiles: BinaryFileData[];
      erroredFiles: Map<FileId, true>;            // value type is `true`
    }>;
    saveFiles: (data: { addedFiles: Map<FileId, BinaryFileData> }) => Promise<{
      savedFiles: Map<FileId, BinaryFileData>;     // value type is BinaryFileData
      erroredFiles: Map<FileId, BinaryFileData>;   // value type is BinaryFileData (NOT `true`)
    }>;
    onFileStatusChange?: (updates: Array<[FileId, "loading" | "loaded" | "error"]>) => void;
  })
  ```
  The two errored-map value types differ exactly as the HLD claims (confirmed `FileManager.ts:50-57`).
- **Public methods** (what the engine calls — note shape differs from the injected callbacks):
  - `saveFiles({ elements, files }: { elements: readonly ExcalidrawElement[]; files: BinaryFiles })`
    → `Promise<{ savedFiles: Map<FileId,BinaryFileData>; erroredFiles: Map<FileId,BinaryFileData> }>`
    (`FileManager.ts:92-137`). It internally builds `addedFiles` from initialized image elements and
    **skips files already saved/being-saved** (`isFileSavedOrBeingSaved`, `FileManager.ts:108`).
  - `getFiles(ids: FileId[])` → `Promise<{ loadedFiles: BinaryFileData[]; erroredFiles: Map<FileId,true> }>`
    (`FileManager.ts:139-180`).
  - `reset()` (`FileManager.ts:212-225`) clears `fetchingFiles/savingFiles/savedFiles/erroredFiles_fetch/erroredFiles_save`
    and emits an `"error"` status for any in-flight fetches. **Confirmed**: this is the only public way
    to clear `erroredFiles_save`, which is the no-retry latch (the `NOTE if errored during save, won't
    retry due to this check` comment is at `FileManager.ts:107`).
- **Collab's `new FileManager({...})`** — `Collab.tsx:152-200` (confirmed). The injected `saveFiles`
  reconstructs `savedFiles`/`erroredFiles` as `Map<FileId, BinaryFileData>` by looking up
  `addedFiles.get(id)` (`Collab.tsx:178-197`). Its injected callbacks `throw new AbortError()` when
  the room is missing — i.e. injected callbacks **may throw**; the public `saveFiles` does not throw
  on per-file errors, it returns them in `erroredFiles`. Our factory mirrors this (throws if no
  `userId`).
- **`BinaryFileData`** — `packages/excalidraw/types.ts:113-137` (confirmed): `{ mimeType, id: FileId,
  dataURL: DataURL, created: number, lastRetrieved?: number, version?: number }`. So a reconstructed
  file on read must set `{ id, mimeType, dataURL, created, lastRetrieved: Date.now() }`; `version` is
  optional and defaults to `1` in dedup (`FileManager.ts:88-90`). Collab/local set `lastRetrieved` on
  read (`LocalData.ts:184`).
- **`BinaryFiles`** = `Record<ExcalidrawElement["id"], BinaryFileData>` (`types.ts:141`).
- **`FileId`** = `string & { _brand: "FileId" }` (`packages/element/src/types.ts:395`).
- **`OrderedExcalidrawElement`** = `Ordered<ExcalidrawElement>` (`packages/element/src/types.ts:227`).
- **Import paths** (confirmed against `LocalData.ts` / `localStorage.ts` usage):
  - `import type { FileId, OrderedExcalidrawElement, ExcalidrawElement } from "@excalidraw/element/types"`
  - `import type { AppState, BinaryFileData, BinaryFiles, DataURL } from "@excalidraw/excalidraw/types"`
  - `import { getNonDeletedElements, isInitializedImageElement, newElementWith } from "@excalidraw/element"`
  - `import { restoreElements, restoreAppState } from "@excalidraw/excalidraw/data/restore"`
  - `import { CaptureUpdateAction } from "@excalidraw/excalidraw"` (`index.tsx:366` re-exports from element)
  - `import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState"`
- **`clearAppStateForLocalStorage(appState: Partial<AppState>)`** — `appState.ts:283-285` (confirmed):
  returns the `browser:true` subset as `Partial<AppState>`. Built on `APP_STATE_STORAGE_CONF`
  (`appState.ts:149-257`).
- **`restoreElements`** — `restore.ts:764-775`: `(targetElements, existingElements, opts?: {
  refreshDimensions?, repairBindings?, deleteInvisibleElements? })`. We call
  `restoreElements(row.document, null, { repairBindings: true })`.
- **`restoreAppState`** — `restore.ts:1013-1016`: `(appState: ImportedDataState["appState"],
  localAppState: Partial<AppState> | null | undefined)`. We call `restoreAppState(row.app_state, null)`.
  It fills missing keys from `getDefaultAppState()` — so dropping ephemerals on write is safe on read.
- **`LocalData`** (`LocalData.ts`, confirmed): `save(elements, appState, files, onFilesSaved)` (137-147,
  synchronously guarded by `isSavePaused`), `flushSave()` = `this._save.flush()` (149-151),
  `pauseSave(lockType)` / `resumeSave(lockType)` where `SavingLockTypes = "collaboration"` (155-161),
  `isSavePaused()` = `document.hidden || this.locker.isLocked()` (163-165). The 300ms debounce constant
  is `SAVE_TO_LOCAL_STORAGE_TIMEOUT` (`app_constants.ts:2`). **Our engine flush is independent of
  `isSavePaused()`** (HLD m2-review).
- **`STORAGE_KEYS`** — `app_constants.ts:39-53`, an `as const` object. We add ONE entry,
  `LOCAL_STORAGE_SUPABASE_META: "excalidraw-supabase-meta"`, plus a new time constant
  `SUPABASE_SYNC_DEBOUNCE_MS = 2000`. (These two edits live in `app_constants.ts`; coordinating only on
  the key name as instructed.)
- **`@supabase/supabase-js`**: **absent** from `excalidraw-app/package.json` dependencies (confirmed —
  lines 28-41 list only `@excalidraw/random-username`, `@sentry/browser`, `callsites`, `firebase`,
  `i18next-browser-languagedetector`, `idb-keyval`, `jotai`, `react`, `react-dom`, `socket.io-client`,
  `uqr`, `vite-plugin-html`). **Add `"@supabase/supabase-js": "^2.45.0"`** (the version already resolved
  in `node_modules` is `2.45.4`). Its top-level exports we rely on: `createClient`, `SupabaseClient`
  (value + type), and via `export * from '@supabase/auth-js'`: `Session`, `User`, `AuthChangeEvent`,
  `Subscription`, `AuthError`. `onAuthStateChange(cb)` callback is `(event: AuthChangeEvent, session:
  Session | null) => void` and returns `{ data: { subscription: Subscription } }`.
- **`app-jotai.ts`** (confirmed): exports `appJotaiStore` (a `createStore()`), `atom`, `Provider`,
  `useAtom`, `useAtomValue`, `useSetAtom`, and `useAtomWithInitialValue`. Atoms in the data layer use
  `import { atom } from "../app-jotai"` and `appJotaiStore.get/set` for non-React access (engine side).

> **Divergences from HLD assumptions found while verifying** (carried into the summary at the end):
> 1. **`@supabase/*` is already present in `node_modules`** (v2.45.4, hoisted/transitive at the repo
>    root) even though it is not declared in `excalidraw-app/package.json`. We still add the explicit
>    dependency (don't rely on hoisting), but imports will resolve in tests today.
> 2. HLD §1.1 names the auth wrapper `signInWithEmail`; the prompt asks for `signInWithMagicLink`. I use
>    **`signInWithMagicLink(email)`** as the export (it is `signInWithOtp({ email })` underneath) and note
>    `signInWithEmail` as an alias if the UI agent prefers the HLD name.
> 3. HLD §3.4 implies one `fileManager` per engine that also serves the initial-load file fetch. That is
>    fine, but note the public `saveFiles` will **not** re-attempt a file that previously errored unless
>    `reset()` is called first (`FileManager.ts:107-108`) — so the engine MUST call
>    `fileManager.reset()` before a retry push (already in the pipeline below; calling it out because
>    it's load-bearing and easy to miss).

---

## A. SQL migration — full DDL

File: `supabase/migrations/0001_init_boards.sql`. Idempotent-ish (guards where Supabase allows). The
`updated_at` trigger is **display/tiebreak only — it is NOT the LWW key; the integer `version` column
is** (HLD §2.1 / M1).

```sql
-- 0001_init_boards.sql
-- Supabase sync: single working board per user, with private file storage.
-- NOTE: the LWW conflict key is the integer `version` column, bumped by a guarded UPDATE
--       in the application (boardRepository.pushBoard). `updated_at` below is for DISPLAY /
--       human tiebreak ONLY and must never drive conflict resolution.

-- ---------------------------------------------------------------------------
-- 1. boards table
-- ---------------------------------------------------------------------------
create table if not exists public.boards (
  id          uuid          primary key default gen_random_uuid(),
  user_id     uuid          not null references auth.users(id) on delete cascade,
  name        text          not null default 'Untitled',
  document    jsonb         not null default '[]'::jsonb,
  app_state   jsonb         not null default '{}'::jsonb,
  version     integer       not null default 0,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- one board per user for this deployment (relax to unique(user_id, name) for multi-board later)
create unique index if not exists boards_user_id_key on public.boards (user_id);

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger (DISPLAY ONLY — not used for LWW; version is)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security: a user may only read/write their own row
-- ---------------------------------------------------------------------------
alter table public.boards enable row level security;

drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own"
  on public.boards for select
  using (auth.uid() = user_id);

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own"
  on public.boards for insert
  with check (auth.uid() = user_id);

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own"
  on public.boards for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own"
  on public.boards for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Storage bucket for scene image files (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('scene-files', 'scene-files', false)
on conflict (id) do nothing;

-- Storage RLS: objects live under `{user_id}/{fileId}`. Each policy restricts BOTH to this
-- bucket AND to the caller's own top-level folder (= their auth.uid()).
drop policy if exists "scene_files_select_own" on storage.objects;
create policy "scene_files_select_own"
  on storage.objects for select
  using (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scene_files_insert_own" on storage.objects;
create policy "scene_files_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scene_files_update_own" on storage.objects;
create policy "scene_files_update_own"
  on storage.objects for update
  using (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "scene_files_delete_own" on storage.objects;
create policy "scene_files_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'scene-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## B (data). Per-file interface specs

All files live under `excalidraw-app/data/supabase/`. Types are real; bodies are prose/pseudocode.

### B.1 `excalidraw-app/data/supabase/featureFlags.ts`

- **Purpose:** single chokepoint for reading the flag so call sites never sprinkle `import.meta.env`.
- **Exports:**
  ```ts
  export const isSupabaseSyncEnabled: () => boolean;
  ```
- **Logic:** `return import.meta.env.VITE_APP_FEATURE_SUPABASE_SYNC === "true";` (string compare — same
  convention as `VITE_APP_ENABLE_PWA === "true"`). No other module reads this env var.
- **Imports:** none (just `import.meta.env`).

### B.2 `excalidraw-app/data/supabase/client.ts`

- **Purpose:** lazily create + memoize ONE `SupabaseClient`. Returns `null` if the flag is off or env
  is missing. **Anon key only — never a service-role key** (HLD §2.4/n2).
- **Exports:**
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  export const getSupabaseClient: () => SupabaseClient | null;
  export const resetSupabaseClientForTests: () => void;   // clears the memo (test hygiene only)
  ```
- **Logic (prose):**
  - module-scope `let client: SupabaseClient | null | undefined = undefined;` (`undefined` = not yet
    resolved; `null` = resolved-to-disabled — so we don't re-evaluate every call).
  - on first call: if `!isSupabaseSyncEnabled()` → set `client = null`, return.
  - read `url = import.meta.env.VITE_APP_SUPABASE_URL`, `anonKey =
    import.meta.env.VITE_APP_SUPABASE_ANON_KEY`. If either is empty/undefined → `client = null`, return
    (and `console.warn` once that sync is enabled but unconfigured).
  - else `client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true,
    detectSessionInUrl: true } })`. `detectSessionInUrl` lets the magic-link redirect complete the
    session automatically.
  - cache and return.
- **Imports:** `{ createClient } from "@supabase/supabase-js"`, `{ isSupabaseSyncEnabled } from
  "./featureFlags"`.

### B.3 `excalidraw-app/data/supabase/auth.ts`

- **Purpose:** thin wrappers over `supabase.auth`. Each is a no-op-safe call that first resolves the
  client; if the client is `null` it returns a benign error/empty so callers never crash flag-off.
- **Exports** (return types are supabase-js's own):
  ```ts
  import type {
    AuthChangeEvent,
    AuthError,
    Session,
    Subscription,
  } from "@supabase/supabase-js";

  // sends an email magic link (signInWithOtp underneath). HLD §4.
  export const signInWithMagicLink: (
    email: string,
  ) => Promise<{ error: AuthError | null }>;

  export const signOut: () => Promise<{ error: AuthError | null }>;

  export const getSession: () => Promise<Session | null>;

  // subscribes to auth changes; returns an unsubscribe fn (wraps Subscription.unsubscribe)
  export const onAuthStateChange: (
    cb: (event: AuthChangeEvent, session: Session | null) => void,
  ) => () => void;
  ```
- **Logic (prose):**
  - `signInWithMagicLink(email)`: `client = getSupabaseClient(); if (!client) return { error: <synthetic
    "sync disabled"> as AuthError }; return client.auth.signInWithOtp({ email, options: { emailRedirectTo:
    window.location.origin } });` — return only `{ error }` (the OTP call's `data` is empty pre-verify).
  - `signOut()`: `client?.auth.signOut() ?? { error: null }`.
  - `getSession()`: `const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
    return data.session ?? null;`
  - `onAuthStateChange(cb)`: if no client return a no-op unsubscribe; else `const { data } =
    client.auth.onAuthStateChange(cb); return () => data.subscription.unsubscribe();`
  - (Optional alias `export const signInWithEmail = signInWithMagicLink;` to satisfy HLD §1.1 naming.)
- **Imports:** `{ getSupabaseClient } from "./client"`; types from `@supabase/supabase-js`.

### B.4 `excalidraw-app/data/supabase/sessionAtom.ts`

- **Purpose:** jotai atoms holding the auth session, plus a hook that wires `onAuthStateChange` →
  atom. The **UI agent consumes these** (sign-in/out menu, button gating).
- **Exports:**
  ```ts
  import type { Session } from "@supabase/supabase-js";
  import type { PrimitiveAtom, Atom } from "jotai";

  export const sessionAtom: PrimitiveAtom<Session | null>;       // primitive, default null
  export const userIdAtom: Atom<string | null>;                  // derived: session?.user.id ?? null
  export const useInitSupabaseSession: () => void;               // mount once near app root
  ```
- **Logic (prose):**
  - `sessionAtom = atom<Session | null>(null)`.
  - `userIdAtom = atom((get) => get(sessionAtom)?.user.id ?? null)`.
  - `useInitSupabaseSession()`: a hook with one `useEffect(() => {...}, [])`:
    - `let mounted = true;`
    - immediately `getSession().then((s) => { if (mounted) setSession(s); })` (boot session).
    - `const unsub = onAuthStateChange((_event, session) => setSession(session));`
    - cleanup: `mounted = false; unsub();`
    - uses `const setSession = useSetAtom(sessionAtom)`.
  - Note: the engine reads the session imperatively via `appJotaiStore.get(userIdAtom)` rather than a
    hook (it is framework-free).
- **Imports:** `{ atom, useSetAtom } from "../../app-jotai"`, `{ getSession, onAuthStateChange } from
  "./auth"`, `{ useEffect } from "react"`.

### B.5 `excalidraw-app/data/supabase/syncStatusAtom.ts`

- **Purpose:** the status the UI renders. Offline is a status value here (HLD §3.1/M4) — the engine
  never touches `isOfflineAtom`.
- **Exports:**
  ```ts
  export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

  export interface SyncStatusState {
    status: SyncStatus;
    lastSyncedAt: number | null;   // epoch ms of last successful push/pull
    error: string | null;          // human-readable message for the tooltip (RLS/network/file)
  }

  export const syncStatusAtom: PrimitiveAtom<SyncStatusState>;
  // default: { status: "idle", lastSyncedAt: null, error: null }
  ```
- **Logic:** plain primitive atom. The engine mutates it via `appJotaiStore.set(syncStatusAtom, ...)`;
  the UI reads it via `useAtomValue`.
- **Imports:** `{ atom } from "../../app-jotai"`, `{ PrimitiveAtom } from "jotai"` (type only).

### B.6 `excalidraw-app/data/supabase/boardRepository.ts`

- **Purpose:** all `boards`-table I/O + scene ↔ row serialization. Version-guarded write (HLD §3.5).
- **Exports:**
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
  import type { AppState } from "@excalidraw/excalidraw/types";

  export interface BoardRow {
    id: string;
    user_id: string;
    name: string;
    document: OrderedExcalidrawElement[];
    app_state: Partial<AppState>;
    version: number;
    created_at: string;   // ISO string from Postgres timestamptz
    updated_at: string;
  }

  export interface SerializedScene {
    document: OrderedExcalidrawElement[];
    app_state: Partial<AppState>;
  }

  export const serializeScene: (
    elements: readonly OrderedExcalidrawElement[],
    appState: Partial<AppState>,
  ) => SerializedScene;

  export const pullBoard: (
    client: SupabaseClient,
    userId: string,
  ) => Promise<BoardRow | null>;

  export type PushResult =
    | { ok: true; version: number; updatedAt: string }
    | { ok: false; conflict: true };

  export const pushBoard: (
    client: SupabaseClient,
    userId: string,
    scene: SerializedScene,
    expectedVersion: number | null,   // null ⇒ first-time INSERT path
  ) => Promise<PushResult>;
  ```
- **Logic (prose):**
  - `serializeScene(elements, appState)`:
    - `document = getNonDeletedElements(elements)` (drops `isDeleted` — same call
      `saveDataStateToLocalStorage` uses, `LocalData.ts:92`).
    - `app_state = stripEphemeral(clearAppStateForLocalStorage(appState))` where `stripEphemeral`
      removes every key in `EPHEMERAL_APPSTATE_KEYS` (Section D). Net = `browser:true` minus ephemerals.
    - returns `{ document, app_state }`. Pure/synchronous; no client. (This is also the dirty-check
      snapshot source — §3.3.)
  - `pullBoard(client, userId)`: `SELECT * ... WHERE user_id = uid`, expecting 0 or 1 row →
    `maybeSingle()`. On error throw a typed `SupabaseSyncError` (see §E). `null` row ⇒ never synced.
  - `pushBoard(client, userId, scene, expectedVersion)`:
    - **first-time INSERT** (`expectedVersion == null`): insert a new row with `version = 0`.
    - **guarded UPDATE** otherwise: update only when `version` still equals `expectedVersion`, set
      `version = expectedVersion + 1`. **0 rows ⇒ conflict** (a racing writer moved the version).
    - Map a unique-violation on insert (`error.code === "23505"`) → `{ ok: false, conflict: true }` so
      the engine re-pulls and re-evaluates (HLD §3.5 first-push-but-row-exists race).
- **Exact supabase query CHAIN SHAPES** (the load-bearing part):
  ```ts
  // pullBoard
  const { data, error } = await client
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();                 // 0 rows -> data === null (NOT an error)

  // pushBoard — FIRST-TIME INSERT (expectedVersion === null)
  const { data, error } = await client
    .from("boards")
    .insert({
      user_id: userId,
      document: scene.document,
      app_state: scene.app_state,
      version: 0,
    })
    .select()
    .single();
  // -> on success: { ok: true, version: 0, updatedAt: data.updated_at }
  // -> on unique-violation (23505): { ok: false, conflict: true }  // row already exists

  // pushBoard — VERSION-GUARDED UPDATE (expectedVersion is a number)
  const { data, error } = await client
    .from("boards")
    .update({
      document: scene.document,
      app_state: scene.app_state,
      version: expectedVersion + 1,
    })
    .eq("user_id", userId)
    .eq("version", expectedVersion)   // optimistic guard
    .select()
    .maybeSingle();                   // 0 rows updated -> data === null
  // -> data === null  ⇒ { ok: false, conflict: true }   // someone advanced version
  // -> data !== null  ⇒ { ok: true, version: data.version, updatedAt: data.updated_at }
  ```
- **Imports:** `{ getNonDeletedElements } from "@excalidraw/element"`, `{ clearAppStateForLocalStorage }
  from "@excalidraw/excalidraw/appState"`, `{ EPHEMERAL_APPSTATE_KEYS } from "./ephemeralAppState"`
  (Section D), types as above. (Deserialization to live scene — `restoreElements`/`restoreAppState` —
  happens in the engine/hook at apply time, HLD §3.2 step 3, not here, since it needs `excalidrawAPI`.)

### B.7 `excalidraw-app/data/supabase/supabaseFiles.ts`

- **Purpose:** the two injected Storage-I/O callbacks for `new FileManager(...)`, produced by a factory
  that closes over `userId`. Mirrors Collab's composition (`Collab.tsx:152-200`) — **no subclassing**.
- **Exports:**
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  import type { FileId } from "@excalidraw/element/types";
  import type { BinaryFileData } from "@excalidraw/excalidraw/types";

  export interface SupabaseFileCallbacks {
    getFiles: (fileIds: FileId[]) => Promise<{
      loadedFiles: BinaryFileData[];
      erroredFiles: Map<FileId, true>;
    }>;
    saveFiles: (data: { addedFiles: Map<FileId, BinaryFileData> }) => Promise<{
      savedFiles: Map<FileId, BinaryFileData>;
      erroredFiles: Map<FileId, BinaryFileData>;
    }>;
  }

  export const createSupabaseFileCallbacks: (
    client: SupabaseClient,
    userId: string,
  ) => SupabaseFileCallbacks;

  // convenience: returns a composed FileManager wired with these callbacks + FileStatusStore
  export const createSupabaseFileManager: (
    client: SupabaseClient,
    userId: string,
  ) => FileManager;
  ```
- **Path convention:** `const path = (fileId: FileId) => `${userId}/${fileId}`;` — the leading
  `${userId}/` segment is exactly what the Storage RLS policy matches
  (`(storage.foldername(name))[1] = auth.uid()::text`).
- **Logic — `saveFiles({ addedFiles })`** (returns `Map<FileId, BinaryFileData>` for both maps, like
  Collab):
  - `const savedFiles = new Map<FileId, BinaryFileData>(); const erroredFiles = new Map<FileId,
    BinaryFileData>();`
  - `await Promise.all([...addedFiles].map(async ([fileId, data]) => { try { const blob =
    dataURLToBlob(data.dataURL); const { error } = await client.storage.from("scene-files").upload(
    path(fileId), blob, { upsert: true, contentType: data.mimeType }); if (error) throw error;
    savedFiles.set(fileId, data); } catch { erroredFiles.set(fileId, data); } }));`
  - return `{ savedFiles, erroredFiles }`. (Per-file failure → `erroredFiles`; the public `saveFiles`
    latches these into `erroredFiles_save` — engine `reset()`s before retry.)
  - **Storage chain shape:**
    ```ts
    await client.storage.from("scene-files").upload(path, blob, {
      upsert: true,                 // overwrite a newer version of the same fileId
      contentType: data.mimeType,
    });
    ```
- **Logic — `getFiles(fileIds)`** (returns `Map<FileId, true>` for errored, like the local/Collab read):
  - for each `fileId`: `const { data: blob, error } = await client.storage.from("scene-files").download(
    path(fileId));` (`.download` chain shape). If `error || !blob` → `erroredFiles.set(fileId, true);
    continue;`
  - else reconstruct: `const dataURL = await blobToDataURL(blob) as DataURL;` then
    `loadedFiles.push({ id: fileId, dataURL, mimeType: (blob.type || MIME_TYPES.binary) as
    BinaryFileData["mimeType"], created: Date.now(), lastRetrieved: Date.now() });` — fields chosen to
    match what Collab/local reconstruct (`id, dataURL, mimeType, created, lastRetrieved`). `created`
    is best-effort `Date.now()` since the object's true `created_at` isn't returned by `.download`.
  - **throws** if `!userId` at factory time? No — `createSupabaseFileCallbacks` requires a non-empty
    `userId` (engine only constructs the manager after login), but the callbacks themselves resolve
    gracefully; mirror Collab by throwing inside the callback only if `userId` is somehow empty.
  - return `{ loadedFiles, erroredFiles }`.
- **dataURL ↔ Blob helpers:** there is **no existing `dataURLToBlob`/`blobToDataURL` shared util** in
  the packages that fits (the closest is `encodeFilesForUpload` in `FileManager.ts:228`, which
  TextEncodes the whole `dataURL` string + compresses+encrypts — HLD §2.2 option (b), deferred). Spec a
  tiny local util (same file or `./fileEncoding.ts`):
  - `dataURLToBlob(dataURL: string): Blob` — split on `,`; parse the `data:<mime>;base64` header; if
    base64, `atob` → `Uint8Array` → `new Blob([bytes], { type: mime })`; if not base64 (rare), decode
    `decodeURIComponent`.
  - `blobToDataURL(blob: Blob): Promise<string>` — `new FileReader().readAsDataURL(blob)` wrapped in a
    Promise. (Both are unit-tested for round-trip per HLD §7.)
- **`createSupabaseFileManager(client, userId)`:** `return new FileManager({ onFileStatusChange:
  FileStatusStore.updateStatuses.bind(FileStatusStore), ...createSupabaseFileCallbacks(client,
  userId) });`
- **Imports:** `{ FileManager } from "../FileManager"`, `{ FileStatusStore } from "../fileStatusStore"`,
  `{ MIME_TYPES } from "@excalidraw/common"`, types as above.

### B.8 `excalidraw-app/data/supabase/syncEngine.ts`

- **Purpose:** framework-free orchestrator. Owns the push debounce, the dirty flag, the persisted
  `localMeta {version,lastSyncedAt}`, the status machine, online/offline listeners, and the push/pull
  pipelines. Unit-testable with fake timers + a mocked client (HLD §1.2, §7).
- **Constructor deps:**
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  import type { OrderedExcalidrawElement, FileId } from "@excalidraw/element/types";
  import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
  import type { FileManager } from "../FileManager";
  import type { SyncStatusState } from "./syncStatusAtom";

  export interface SyncEngineDeps {
    client: SupabaseClient;
    getUserId: () => string | null;                 // reads userIdAtom imperatively
    fileManager: FileManager;                        // the composed Supabase FileManager
    getScene: () => {
      elements: readonly OrderedExcalidrawElement[];
      appState: Partial<AppState>;
      files: BinaryFiles;
    };
    setStatus: (next: SyncStatusState) => void;      // mirrors into syncStatusAtom
    // callback the hook supplies to apply a pulled cloud row to the live editor
    // (engine is framework-free and cannot touch excalidrawAPI directly):
    applyRemoteScene: (row: BoardRow) => Promise<void>;
  }

  export class SyncEngine {
    constructor(deps: SyncEngineDeps);
    start(userId: string): Promise<void>;   // run an initial pull+reconcile
    stop(): void;                            // logout: cancel timers, reset dirty/meta cache
    notifyChange(): void;                    // called from onChange (fire-and-forget)
    syncNow(): Promise<void>;                // manual: cancel debounce, push immediately
    flush(): Promise<void>;                  // push now IF dirty (unload/unmount); not isSavePaused-gated
    dispose(): void;                         // remove window listeners, clear timers
  }
  ```
- **Internal state:**
  - `private debounceMs = SUPABASE_SYNC_DEBOUNCE_MS;` (`= 2000`, from `app_constants.ts`).
  - `private timer: ReturnType<typeof setTimeout> | null = null;`
  - `private dirty = false;`
  - `private localMeta: { version: number; lastSyncedAt: number } | null` — loaded from
    `localStorage[STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META]` on construct; `null` ⇒ never synced.
    Persisted via a private `saveMeta()` that `JSON.stringify`s `{ version, lastSyncedAt }`.
  - `private lastSyncedSnapshot: { elementsHash; appStateHash } | null` — used for the dirty-check
    (cheap structural compare of `serializeScene(...)` output; see §3.3 / M3).
  - `private inFlight: Promise<void> | null` — serializes pushes (no overlapping uploads).
  - `private onlineListenerArmed = false;`
- **Public behavior (prose; pipelines below cite HLD §3.2/§3.3/§3.5):**
  - `notifyChange()`:
    1. if flag off or `getUserId() == null` → return.
    2. compute `next = serializeScene(scene.elements, scene.appState)`; compare to
       `lastSyncedSnapshot`. **If nothing meaningful changed (elements + non-ephemeral appState equal)
       → return** (M3: pan/zoom/selection/menu never arm the debounce). (Comparison uses
       `JSON.stringify` of `{document, app_state}` — both already strip deleted + ephemerals.)
    3. set `dirty = true`.
    4. if `!navigator.onLine` → `setStatus(offline)`, arm the one-shot `online` listener (see offline),
       do NOT arm the network timer.
    5. else clear+re-arm the debounce: `this.timer = setTimeout(() => this.runPush(), this.debounceMs);`
  - `syncNow()`: clear the debounce timer, `await this.runPush()` (immediate).
  - `flush()`: if `dirty` → `await this.runPush()`; else no-op. Independent of `LocalData.isSavePaused()`.
  - `start(userId)`: run `pullAndReconcile()` (the §3.2 table).
  - `stop()`: clear timer, set `dirty=false`, `localMeta`/snapshot left intact in memory but engine
    stops pushing (logout). (The hook also nulls the engine on logout.)
  - `dispose()`: remove `online`/`offline` window listeners, clear timer.
- **PUSH PIPELINE — `runPush()` (HLD §3.5 + M5), exactly:**
  1. guard: if `!getUserId()` or `inFlight` → return (coalesce). Set `inFlight`.
  2. `setStatus(syncing)`.
  3. **FILES FIRST:** `const { erroredFiles } = await fileManager.saveFiles({ elements:
     scene.elements, files: scene.files });` (public method — object shape `{elements, files}`).
  4. `const sceneFileIds = new Set(initialized-image fileIds in scene.elements);`
     `const currentSceneErrored = [...erroredFiles.keys()].filter((id) => sceneFileIds.has(id));`
  5. **If `currentSceneErrored.length > 0`:** `setStatus(isNetworkError ? offline : error)` with a
     message; **do NOT bump version, do NOT clear dirty** (stay dirty → retry); **call
     `fileManager.reset()`** so a later retry isn't blocked by `erroredFiles_save` (`FileManager.ts:107`);
     `return` (release `inFlight`).
  6. **ROW SECOND** (only reached on clean file upload): `const result = await pushBoard(client, userId,
     serializeScene(scene.elements, scene.appState), localMeta?.version ?? null);`
     - if `result.ok`: `localMeta = { version: result.version, lastSyncedAt: Date.now() }`; `saveMeta()`;
       `dirty = false`; update `lastSyncedSnapshot`; `setStatus({ status: "synced", lastSyncedAt,
       error: null })`.
     - if `!result.ok && result.conflict`: `await pullAndReconcile();` (re-pull, re-evaluate §3.2 table —
       never clobber). Do not clear dirty here; reconcile decides.
  7. on thrown error in step 6 (network/RLS): `setStatus(isNetworkError ? offline : error)` with mapped
     message; **dirty stays true** → retry on next change/reconnect/syncNow.
  8. `finally`: release `inFlight`. If still `dirty` and a new `notifyChange` arrived during the push,
     the debounce will re-arm naturally.
- **PULL+RECONCILE — `pullAndReconcile()` (HLD §3.2 table):**
  - `const cloud = await pullBoard(client, userId);`
  - decide:
    - `cloud == null` → first login/empty cloud → push local up via `runPush()` with `expectedVersion =
      null` (INSERT); seed `localMeta.version` from the returned version. (Uses **row presence**, not
      `document.length` — HLD §9.8.)
    - `!dirty && cloud.version > (localMeta?.version ?? -1)` → **cloud wins**: `await
      deps.applyRemoteScene(cloud)` (hook applies via `updateScene({..., captureUpdate:
      CaptureUpdateAction.NEVER })` + the post-pull file-load step), then `localMeta = { version:
      cloud.version, lastSyncedAt: Date.now() }`; `saveMeta()`; update snapshot; `setStatus(synced)`.
    - `!dirty && cloud.version === localMeta.version` → no-op (already in sync), `setStatus(synced/idle)`.
    - `!dirty && cloud.version < localMeta.version` → shouldn't happen (monotonic); no-op + `console.warn`.
    - `dirty` → **local wins**: push with `expectedVersion = cloud.version` (so the guarded UPDATE writes
      `cloud.version + 1`); on the 0-row race, re-pull and re-run this table. Files are union (M2) so a
      local-wins push never strips another device's bytes.
- **STATUS MACHINE:** `idle → syncing → synced` on success, `→ error` on non-network failure, `→
  offline` on network failure / `navigator.onLine === false` (HLD §3.1). Every transition is mirrored
  via `deps.setStatus(...)` which the hook wires to `appJotaiStore.set(syncStatusAtom, ...)`.
- **OFFLINE (HLD §3.7 / M4):** the engine adds its OWN `window` listeners in the constructor:
  - `window.addEventListener("offline", () => setStatus(offline))` (only meaningful when dirty/active).
  - on `notifyChange` while `!navigator.onLine`: mark dirty, `setStatus(offline)`, and arm exactly ONE
    one-shot `online` handler: `const onOnline = () => { window.removeEventListener("online", onOnline);
    this.onlineListenerArmed = false; if (this.dirty) this.flush(); };` guarded by `onlineListenerArmed`
    so we never stack handlers. **The engine never imports or writes `isOfflineAtom`** (HLD §3.7/M4);
    offline is purely `syncStatusAtom = "offline"`.
- **Imports:** `{ pullBoard, pushBoard, serializeScene, type BoardRow } from "./boardRepository"`,
  `{ isInitializedImageElement } from "@excalidraw/element"`, `{ STORAGE_KEYS,
  SUPABASE_SYNC_DEBOUNCE_MS } from "../../app_constants"`, types as above. **Does NOT import from
  `../../collab/*`.**

---

## D. Finalized `EPHEMERAL_APPSTATE_KEYS`

File: `excalidraw-app/data/supabase/ephemeralAppState.ts`. Every key below is a **real `AppState` key
verified `browser: true`** in `APP_STATE_STORAGE_CONF` (`appState.ts:149-257`) — so it is in the
`clearAppStateForLocalStorage` output and must be removed before upload + excluded from the dirty-check
(HLD §2.3/M3).

**Decision on the four follow-ups (HLD §2.3 leaves them to the LLD):** treat tool/mode UI state as
**ephemeral** and EXCLUDE it from the cloud doc + dirty-check. `activeTool`, `zenModeEnabled`,
`objectsSnapModeEnabled`, and `penMode` (+ `penDetected`) describe the *editing-session UI* of one
device at one moment, not the document. Carrying them would (a) mark the board dirty on a tool click or
a Z-mode toggle — pure UI churn we explicitly want to suppress — and (b) yank a second device's active
tool / zen-mode out from under the user on pull. `restoreAppState` backfills them from defaults on read
(`restore.ts:1013`), so dropping them is safe. We DO keep cross-device document-flavored prefs (`theme`,
`name`, `viewBackgroundColor`, `grid*`, all `currentItem*`, `lockedMultiSelections`,
`showWelcomeScreen`) — those are `browser:true` and intentionally NOT in this set, preserving "boards
follow the user."

```ts
import type { AppState } from "@excalidraw/excalidraw/types";

/**
 * AppState keys that are `browser: true` (so they survive clearAppStateForLocalStorage)
 * but are pure viewport / selection / transient-UI state. They are stripped from the cloud
 * `app_state` AND excluded from the sync dirty-check, so pan/zoom/selection/menu/tool/mode
 * churn never marks the board dirty or triggers a push. Each key verified against
 * APP_STATE_STORAGE_CONF (packages/excalidraw/appState.ts).
 */
export const EPHEMERAL_APPSTATE_KEYS = [
  // viewport
  "scrollX",
  "scrollY",
  "zoom",
  "scrolledOutside",
  "shouldCacheIgnoreZoom",
  // selection
  "selectedElementIds",
  "selectedGroupIds",
  "previousSelectedElementIds",
  "selectedLinearElement",
  "editingGroupId",
  // transient UI / menus / pointer
  "openMenu",
  "openSidebar",
  "cursorButton",
  "lastPointerDownWith",
  "stats",
  // tool / mode UI state (LLD decision: ephemeral — excluded from cloud doc + dirty-check)
  "activeTool",
  "preferredSelectionTool",
  "zenModeEnabled",
  "objectsSnapModeEnabled",
  "penMode",
  "penDetected",
] as const satisfies ReadonlyArray<keyof AppState>;

export type EphemeralAppStateKey = (typeof EPHEMERAL_APPSTATE_KEYS)[number];

const EPHEMERAL_SET = new Set<string>(EPHEMERAL_APPSTATE_KEYS);

/** Removes ephemeral keys from a (browser-subset) appState before upload / before dirty-compare. */
export const stripEphemeral = (
  appState: Partial<AppState>,
): Partial<AppState> => {
  const out: Partial<AppState> = {};
  for (const key of Object.keys(appState) as (keyof AppState)[]) {
    if (!EPHEMERAL_SET.has(key)) {
      (out as any)[key] = appState[key];
    }
  }
  return out;
};
```

> Verification notes: `activeTool` `appState.ts:181`, `preferredSelectionTool` `:182`, `penMode` `:183`,
> `penDetected` `:184`, `zenModeEnabled` `:241`, `objectsSnapModeEnabled` `:248` — all `browser:true`.
> Viewport/selection keys confirmed `:217-245`. `stats` `:232`, `cursorButton` `:176`, `lastPointerDownWith`
> `:207`, `openMenu` `:213`, `openSidebar` `:215`, `editingGroupId` `:180` — all `browser:true`. (Note:
> `boxSelectionMode`, `bindingPreference`, `isBindingEnabled`, `isMidpointSnappingEnabled` are also
> `browser:true` mode-ish flags; I treat them as DOCUMENT-flavored prefs and KEEP them — they rarely
> change and are useful cross-device. If the UI agent finds they cause spurious dirtiness, they can be
> moved into this set without other changes.)

---

## E. Error handling & edge cases (data layer)

A single typed error helps map failures to status. In `boardRepository.ts` (or a small `errors.ts`):
```ts
export class SupabaseSyncError extends Error {
  constructor(message: string, public kind: "network" | "permission" | "conflict" | "unknown") {
    super(message);
  }
}
```
Classification helper used by the engine: `isNetworkError(err)` → true for `TypeError`/`fetch`
failures, `err.message` containing `"Failed to fetch"`/`"NetworkError"`, or `navigator.onLine ===
false`. `isPermissionError(err)` → PostgREST `error.code` in (`"42501"` insufficient_privilege,
`"PGRST301"`/JWT errors) or Storage 403; message → `"Sync failed: permission denied"`.

| Case | Handling (engine) |
|---|---|
| **File upload failure** | `runPush` step 5: any current-scene file in `erroredFiles` ⇒ `setStatus(error\|offline)`, message `"Sync failed: couldn't upload image"`, **do NOT bump version / clear dirty**, **call `fileManager.reset()`** (clears `erroredFiles_save` latch so retry works — `FileManager.ts:107`), return. Row is **never** written this push (M5). Files not referenced by the current scene that error are ignored. |
| **RLS / permission error** | `pushBoard`/`pullBoard` reject → engine maps via `isPermissionError` → `setStatus({status:"error", error:"Sync failed: permission denied"})`. Dirty stays true. Surfaced verbatim in the `SyncStatusButton` tooltip (this is also how the stakeholder validates RLS live, HLD §9.5). Never a silent no-op. |
| **Version conflict** | Guarded UPDATE returns 0 rows (`data === null`) OR INSERT hits unique-violation (`23505`) ⇒ `{ ok:false, conflict:true }` ⇒ engine `await pullAndReconcile()`; the §3.2 table re-decides. **Never blind-overwrite.** Files are union/append-only so reconcile never deletes bytes (M2). |
| **Offline** | `navigator.onLine === false` (or a network-class push error) ⇒ `setStatus(offline)`, mark dirty, arm exactly ONE `online` listener (guarded by `onlineListenerArmed`) that `flush()`es when connectivity returns. No op-queue — the whole scene being dirty IS the queue (HLD §3.7). Engine owns its own listeners; never touches `isOfflineAtom`. |
| **Large document** | Soft threshold: before the row write, `const size = JSON.stringify(scene.document).length; if (size > SUPABASE_DOCUMENT_WARN_BYTES /* ~1_000_000 */) console.warn("[supabase-sync] document ~", size, "bytes — approaching jsonb soft limit");`. v1 still pushes plain jsonb. Document-in-Storage (`scene-files/{userId}/document.json` + pointer) is the documented future escalation (HLD §9.1) — a TODO hook, not implemented. |
| **Auth token expiry** | Client created with `autoRefreshToken: true, persistSession: true` (§B.2) — supabase-js refreshes transparently; `sessionAtom` tracks refresh via `onAuthStateChange`. A push/pull that still fails with an auth/JWT error ⇒ `setStatus(error)` with message; engine attempts one re-pull on next change. If the session is truly gone (`getUserId()` returns null), engine drops to local-only and stops pushing **without clearing dirty** — the dirty scene waits for the next sign-in (HLD §9.4). The hook (UI side) clears `sessionAtom` on a `SIGNED_OUT` event. |

---

## G. Build order (data layer)

Strict dependency order (each depends only on earlier ones):

1. `supabase/migrations/0001_init_boards.sql` — independent (DB side; needed to run/test against a real
   project, no code dep).
2. `excalidraw-app/package.json` — add `"@supabase/supabase-js": "^2.45.0"`; `excalidraw-app/vite-env.d.ts`
   — add the 3 `VITE_APP_SUPABASE_*` / `VITE_APP_FEATURE_SUPABASE_SYNC` typings. (Enables all imports.)
3. `app_constants.ts` — add `STORAGE_KEYS.LOCAL_STORAGE_SUPABASE_META` + `SUPABASE_SYNC_DEBOUNCE_MS = 2000`.
4. `data/supabase/featureFlags.ts` — no deps.
5. `data/supabase/client.ts` — depends on (2), (4).
6. `data/supabase/ephemeralAppState.ts` (the `EPHEMERAL_APPSTATE_KEYS` + `stripEphemeral`) — depends only
   on `AppState` type.
7. `data/supabase/auth.ts` — depends on (5).
8. `data/supabase/syncStatusAtom.ts` — depends on `app-jotai` only.
9. `data/supabase/sessionAtom.ts` — depends on (7), `app-jotai`.
10. `data/supabase/supabaseFiles.ts` — depends on (5), `FileManager`, `fileStatusStore`, `@excalidraw/common`.
11. `data/supabase/boardRepository.ts` — depends on (6), element/appState helpers.
12. `data/supabase/syncEngine.ts` — depends on (3), (8/9 via setStatus/getUserId wiring), (10), (11).

(The React hook `useSupabaseSync.ts`, the `SyncStatusButton`/`SupabaseAuthMenu` UI, the `App.tsx`
edits, `vite-env.d.ts` is shared, and all tests are the OTHER agent's scope — they sit on top of 1-12.)

---

## Summary (≤20 lines, for the orchestrator)

Data files specced (all under `excalidraw-app/data/supabase/`): `featureFlags.ts`, `client.ts`
(memoized `SupabaseClient | null`, anon key only), `auth.ts` (`signInWithMagicLink`/`signOut`/
`getSession`/`onAuthStateChange`), `sessionAtom.ts` (`sessionAtom`, derived `userIdAtom`,
`useInitSupabaseSession`), `syncStatusAtom.ts` (`SyncStatus` + `{status,lastSyncedAt,error}`),
`boardRepository.ts` (`BoardRow`, `SerializedScene`, `serializeScene`/`pullBoard`/`pushBoard` with the
INSERT vs guarded-UPDATE chains + 0-row⇒conflict), `supabaseFiles.ts` (`createSupabaseFileCallbacks`/
`createSupabaseFileManager`, path `${userId}/${fileId}`, upload `{upsert,contentType}` + download +
dataURL↔Blob util), `ephemeralAppState.ts` (`EPHEMERAL_APPSTATE_KEYS`), and `syncEngine.ts` (the
debounce/dirty/version/offline orchestrator with the files-first push pipeline). Plus the SQL migration,
the `package.json` dep, and the `app_constants.ts` additions.
Ephemeral-keys decision: tool/mode UI state (`activeTool`, `preferredSelectionTool`, `zenModeEnabled`,
`objectsSnapModeEnabled`, `penMode`, `penDetected`) is treated as EPHEMERAL alongside viewport/selection/
menu keys — excluded from the cloud doc and the dirty-check; document-flavored prefs (theme/name/grid/
currentItem*/viewBackgroundColor/lockedMultiSelections) are kept.
Where REAL code diverged from the HLD's assumptions (please note):
- `@supabase/supabase-js` is NOT in `excalidraw-app/package.json` but IS already resolved in
  `node_modules` (v2.45.4, hoisted) — imports work today; we still add the explicit `^2.45.0` dep.
- HLD §1.1 calls the sign-in wrapper `signInWithEmail`; I exported `signInWithMagicLink` per the prompt
  (with an optional `signInWithEmail` alias) — flag for the UI agent so the menu imports the right name.
- Load-bearing FileManager detail: the public `saveFiles` will NOT retry a previously-errored file
  unless `fileManager.reset()` is called first (`FileManager.ts:107`) — the engine MUST `reset()` before
  a retry push; included in the pipeline.
- The engine is framework-free and cannot call `excalidrawAPI`, so applying a pulled row (the
  `updateScene` + post-pull `getFiles`→`addFiles`→`updateStaleImageStatuses` step, HLD §3.2 steps 3-4)
  is injected as `deps.applyRemoteScene(row)` — the UI agent's hook implements that callback.
- No existing shared `dataURL↔Blob` util fits (only `encodeFilesForUpload`, the encrypt path) — speccing
  a small local util in `supabaseFiles.ts`.
