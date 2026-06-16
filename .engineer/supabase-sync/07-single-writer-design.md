# 07 — Single-Writer / Multi-Reader Concurrency Design (Supabase sync)

_Design doc only. A later implementation pass follows this exactly. All `file:line` refs verified
against branch `online-sync` on 2026-06-16. Full implementation code is intentionally OUT of scope
here — only the SQL + RPC definitions + the exact lock-claim WHERE clause are included._

## Revision history

- **rev2 (2026-06-16)** — concurrency review approved with changes; the lock correctly admits exactly
  one writer (verified). Addressed 2 majors + 1 key minor in the handoff failure paths:
  - **M1 (lost writer edits on a failed final flush)** — the handoff no longer releases the lock after
    a flush that didn't commit. `flush()`/`runPush()` now return a success boolean; the writer demotes
    **only after a flush that returns `true`**. On flush failure it stays writer + dirty, leaves
    `takeover_requested_by` set, and retries on the next heartbeat. See §3 (push-gate / flush contract),
    §4 (steps 3–5 + new "failed-flush branch"), §5 (engine notes), §6.12.
  - **M2 (stuck takeover request)** — `takeover_requested_by` now has its own TTL. `renew_board_lock`
    and `read_lock_state` self-heal a stale/abandoned request (`takeover_requested_at < now() -
    REQUEST_TTL`) by clearing it, so the writer resumes renewing. SQL updated in §1; behavior in §4,
    §6.13.
  - **m5 (client-clock liveness hazard)** — `read_lock_state` is now a `SECURITY DEFINER` RPC that
    computes `lock_live` server-side with DB `now()` and returns `server_now`; readers/writers use
    `lock_live`, never `Date.now()`. Added to the 0002 SQL + the repo wrapper list (§1, §2, §5). Also
    fixed two misleading comments: the `viewModeEnabled` stripping claim (it's `browser:false`, so
    `clearAppStateForLocalStorage` already excludes it) and the "RLS applies inside SECURITY DEFINER"
    comment (SECURITY DEFINER **bypasses** RLS; ownership is enforced by the explicit `user_id =
    auth.uid()` filter present in **every** lock RPC).

## 0. Problem & locked decisions

Today sync is **version-guarded last-write-wins**, assuming a single active session. Two concurrent
editors of the same board ping-pong: each push bumps `version` (`pushBoard`,
`boardRepository.ts:114-137`), the other gets `{ ok:false, conflict:true }`, calls
`repullAndReconcile` (`syncEngine.ts:507-548`) which **applies the cloud row over the local scene**
(`applyCloud`, `syncEngine.ts:412-426`) — silently dropping in-flight local edits — and they fight.

We move to **exactly ONE active WRITER per board; every other session is a hard READ-ONLY reader.**

Locked product decisions (designed to exactly; not relitigated):

1. **Writer policy** — Explicit "Take over editing" button. A newly-opened session that finds a live
   writer opens **read-only**; it does NOT auto-grab the lock.
2. **Lock transfer (graceful handoff)** — On "Take over": (a) the current writer is NOTIFIED, (b) it
   FLUSHES its last unsynced changes, (c) THEN the lock transfers to the requester, who becomes
   writer with the just-flushed latest scene. No lost edits on either side.
3. **Reader updates** — POLLING (every few seconds). No Supabase Realtime. Presence / "who is
   editing" is inferred from the lock row's heartbeat timestamp + writer identity.
4. **Reader UX** — HARD read-only via `viewModeEnabled`, a banner, and a distinct reader sync-status,
   plus the "Take over editing" affordance.

### Why `viewModeEnabled` (prop) enforces hard read-only — confirmed

`viewModeEnabled` is a **controlled prop**, not just app-owned state. In
`packages/excalidraw/components/App.tsx:2800-2801` the prop **overrides** any action/internal value:

```ts
if (typeof this.props.viewModeEnabled !== "undefined") {
  viewModeEnabled = this.props.viewModeEnabled;   // prop wins over actionResult.appState
}
```

and `componentDidUpdate` re-applies it whenever the prop changes
(`packages/excalidraw/components/App.tsx:3492-3493`):

```ts
if (prevProps.viewModeEnabled !== this.props.viewModeEnabled) {
  this.setState({ viewModeEnabled: !!this.props.viewModeEnabled });
}
```

`viewModeEnabled` is declared optional on the public props (`packages/excalidraw/types.ts:636`) and is
**currently NOT passed** by the app — the `<Excalidraw>` JSX props run `App.tsx:960-1057` with no
`viewModeEnabled`. So the app reader-mode = pass `viewModeEnabled={role === "reader"}`. View mode
disables editing/tool-switching at the package level (`App.tsx:5045`, `5049`, `5067`, `5112`, `7459`,
`8135`, `8201`, `12701`, etc.) — i.e. a reader physically cannot draw, regardless of any app gate.
The app gate (engine no-op on push) is defense-in-depth for the brief window where the prop hasn't
flushed yet.

---

## 1. Lock data model

### Decision: extra columns on `boards` (NOT a separate table)

This deployment is strictly **one board per user** — `boards_user_id_key unique(user_id)`
(`0001_init_boards.sql:29`) — so "the board" IS the user's single row, and `pullBoard`/`pushBoard`
already key entirely on `user_id` (`boardRepository.ts:68`, `:123`). Adding lock columns to `boards`:

- keeps the existing single-round-trip pull (`select *`, `boardRepository.ts:65-69`) returning the
  version **and** lock state together — the reader poll is then one `select`, not a join.
- reuses the existing per-row RLS (`auth.uid() = user_id`, `0001:64-82`) verbatim — the lock is part
  of the row a user already exclusively owns. No new policies needed for the lock fields themselves.
- avoids a second table whose only key would be `board_id` 1:1 with `boards` anyway.

**Multi-board future:** because every lock column is on the board row and keyed by the row's `id`, a
future `unique(user_id, name)` world still works unchanged — each board row carries its own lock.
A separate `board_locks` table buys nothing until locks are shared across users (true multi-tenant
collab), which is explicitly out of scope (decision: one writer per *board*, board owned by one user).
We note the migration path in §6.

### Session identity — per-tab `session_id` in `sessionStorage`

A user logged in from two tabs shares one `auth.uid()`, so `user_id` cannot distinguish writer from
reader. We mint a **per-tab** `session_id` (a UUID) and store it in **`sessionStorage`** (NOT
`localStorage`): `sessionStorage` is per-tab, so each tab is a distinct session and a duplicated tab
gets a fresh value. Key: `STORAGE_KEYS.SESSION_STORAGE_SUPABASE_SESSION_ID` (new constant). Generated
once per `SyncEngine` construction via `crypto.randomUUID()`; falls back to a random string if absent.
It is opaque to RLS (RLS only checks `auth.uid()`); it only distinguishes sessions of the same user.

### New columns on `public.boards`

| column | type | meaning |
|---|---|---|
| `writer_id` | `uuid null` | `auth.uid()` of the current writer. NULL ⇒ no writer (free). |
| `writer_session_id` | `text null` | the writer's per-tab `session_id`. Distinguishes tabs of the same user. |
| `writer_heartbeat_at` | `timestamptz null` | server-clock time of the writer's last heartbeat. |
| `lock_expires_at` | `timestamptz null` | server-clock lease expiry = `writer_heartbeat_at + LEASE_TTL`. A lock is **held** iff `writer_id is not null AND lock_expires_at > now()`. |
| `takeover_requested_by` | `text null` | `session_id` of a reader requesting takeover. NULL ⇒ no pending request. |
| `takeover_requested_at` | `timestamptz null` | server-clock time the takeover was requested (for the ack timeout). |

All lock state derives from the **server clock** (`now()` inside RPCs / DB defaults), never a client
clock — mirroring the existing rule that `version`, not client `updated_at`, drives conflict
resolution (`0001:3-5`). Clients never write `now()` themselves; they pass only `session_id` (+ for
takeover, their identity) and let the RPC stamp server time.

### Migration `0002_board_locks.sql` (full, copy-pasteable)

```sql
-- 0002_board_locks.sql
-- Single-writer / multi-reader locking for the per-user board.
-- Lock state lives on the boards row (one board per user today). All timing uses the SERVER clock
-- (now()) inside SECURITY DEFINER RPCs — never a client clock — mirroring the version-over-updated_at
-- rule in 0001.
--
-- SECURITY MODEL: these RPCs are SECURITY DEFINER, which means they run as the function OWNER and
-- THEREFORE BYPASS the row-level security policies on public.boards. RLS does NOT protect rows inside
-- these functions. Per-user ownership is instead enforced EXPLICITLY by the `b.user_id = auth.uid()`
-- filter that EVERY function below includes in its UPDATE and its SELECT. (auth.uid() reads the
-- caller's JWT claim, which the definer privilege does not change.) A reviewer MUST confirm that
-- filter is present in all of claim/renew/release/request_takeover/read_lock_state — it is the only
-- thing keeping one user out of another user's lock row. The lock columns distinguish a single user's
-- own tabs via an opaque session_id (no security boundary between same-user tabs — they share auth.uid()).

-- ---------------------------------------------------------------------------
-- 1. Lock columns
-- ---------------------------------------------------------------------------
alter table public.boards
  add column if not exists writer_id             uuid        null references auth.users(id) on delete set null,
  add column if not exists writer_session_id     text        null,
  add column if not exists writer_heartbeat_at   timestamptz null,
  add column if not exists lock_expires_at       timestamptz null,
  add column if not exists takeover_requested_by text        null,
  add column if not exists takeover_requested_at timestamptz null;

-- Tunables (kept in SQL as the single source of truth; the client mirrors them as constants).
--   LEASE_TTL          = 25 seconds  (lock_expires_at = heartbeat + this)
--   REQUEST_TTL        = 12 seconds  (a takeover_requested_by older than this is presumed
--                                      stalled/abandoned and is CLEARED by renew_board_lock and
--                                      read_lock_state so the writer self-heals and resumes renewing.
--                                      Set = ACK_GRACE: a live requester re-polls/re-affirms within
--                                      its ack-grace window, so it never lets its own request go stale.)
--   (client) HEARTBEAT = 5  seconds  (writer renew interval; << TTL so 1–2 missed beats are safe)
--   (client) POLL      = 4  seconds  (reader poll interval)
--   (client) ACK_GRACE = 12 seconds  (~2× heartbeat+poll: requester waits this long for the writer
--                                      to ack a takeover before presuming it dead and claiming)

-- ---------------------------------------------------------------------------
-- 2. claim_board_lock — atomically become the writer iff the lock is free/expired/already ours.
--    Returns the resulting lock state so the caller learns whether it won and who holds it.
-- ---------------------------------------------------------------------------
create or replace function public.claim_board_lock(
  p_session_id text,
  p_lease_seconds integer default 25
)
returns table (
  acquired              boolean,
  writer_id             uuid,
  writer_session_id     text,
  writer_heartbeat_at   timestamptz,
  lock_expires_at       timestamptz,
  version               integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- The crux: a SINGLE conditional UPDATE. The WHERE clause permits the write only when the lock is
  -- free OR its lease has expired OR it is already ours. Postgres takes a row lock for the UPDATE, so
  -- two concurrent claims serialize: the first flips writer_id; the second re-evaluates the WHERE
  -- against the just-written row and matches nothing (writer_id is now someone else and not expired).
  update public.boards b
     set writer_id           = v_uid,
         writer_session_id   = p_session_id,
         writer_heartbeat_at = now(),
         lock_expires_at     = now() + make_interval(secs => p_lease_seconds),
         -- claiming clears any stale takeover request that named us or has been satisfied
         takeover_requested_by = null,
         takeover_requested_at = null
   where b.user_id = v_uid
     and (
           b.writer_id is null                        -- free
        or b.lock_expires_at < now()                  -- lease expired (crashed/slept writer)
        or b.writer_session_id = p_session_id         -- re-affirm our own lock (idempotent renew-claim)
     );

  -- Whether or not we wrote, return the current authoritative state so the client can decide its role.
  return query
    select (b.writer_session_id = p_session_id) as acquired,
           b.writer_id, b.writer_session_id, b.writer_heartbeat_at, b.lock_expires_at, b.version
      from public.boards b
     where b.user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. renew_board_lock — writer heartbeat. Renews ONLY if we still hold the lock AND no LIVE takeover is
--    pending. M2: a takeover request older than REQUEST_TTL is presumed stalled/abandoned and is
--    cleared FIRST, so a writer that was briefly blocked (or a request whose requester vanished) resumes
--    renewing normally. Returns whether we still hold + the (post-cleanup) takeover signal so the writer
--    only begins the handoff for a request that is still live.
-- ---------------------------------------------------------------------------
create or replace function public.renew_board_lock(
  p_session_id text,
  p_lease_seconds integer default 25,
  p_request_ttl_seconds integer default 12
)
returns table (
  still_writer          boolean,
  takeover_requested_by text,
  takeover_requested_at timestamptz,
  version               integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- STEP A (M2 self-heal): clear a stale/abandoned takeover request before deciding whether to renew.
  -- Only touches OUR row and only when the request is older than its TTL.
  update public.boards b
     set takeover_requested_by = null,
         takeover_requested_at = null
   where b.user_id = v_uid
     and b.takeover_requested_at is not null
     and b.takeover_requested_at < now() - make_interval(secs => p_request_ttl_seconds);

  -- STEP B: renew the lease iff we still hold the lock and (after step A) no LIVE takeover is pending.
  update public.boards b
     set writer_heartbeat_at = now(),
         lock_expires_at     = now() + make_interval(secs => p_lease_seconds)
   where b.user_id = v_uid
     and b.writer_session_id = p_session_id          -- we still hold it
     and b.takeover_requested_by is null;            -- and nobody is (still) taking over

  return query
    select (b.writer_session_id = p_session_id
            and b.lock_expires_at > now())            as still_writer,
           b.takeover_requested_by, b.takeover_requested_at, b.version
      from public.boards b
     where b.user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. release_board_lock — writer voluntarily releases (clean tab close OR completing a handoff).
--    Idempotent + safe: only clears the lock if WE hold it (never steps on a new writer).
-- ---------------------------------------------------------------------------
create or replace function public.release_board_lock(
  p_session_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.boards b
     set writer_id             = null,
         writer_session_id     = null,
         writer_heartbeat_at   = null,
         lock_expires_at       = null,
         takeover_requested_by = null,
         takeover_requested_at = null
   where b.user_id = v_uid
     and b.writer_session_id = p_session_id;          -- only if still ours
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. request_takeover — a reader signals the current writer to hand off. Records the request only;
--    does NOT steal the lock. If the lock is already free/expired, returns immediately_claimable so
--    the reader's next claim_board_lock wins with no waiting.
-- ---------------------------------------------------------------------------
create or replace function public.request_takeover(
  p_session_id text
)
returns table (
  immediately_claimable boolean,
  writer_session_id     text,
  lock_expires_at       timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- Only stamp a request when there is a LIVE writer that isn't us. (First requester wins the column;
  -- a second requester just overwrites takeover_requested_by — only one session can ultimately claim,
  -- and the claim RPC, not this column, decides the winner.)
  update public.boards b
     set takeover_requested_by = p_session_id,
         takeover_requested_at = now()
   where b.user_id = v_uid
     and b.writer_id is not null
     and b.lock_expires_at > now()
     and b.writer_session_id is distinct from p_session_id;

  return query
    select (b.writer_id is null or b.lock_expires_at <= now()) as immediately_claimable,
           b.writer_session_id, b.lock_expires_at
      from public.boards b
     where b.user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. read_lock_state — the reader/writer POLL. m5: this MUST be an RPC (not a plain client SELECT) so
--    liveness is computed against the DB clock. A client SELECT would force the caller to compare
--    lock_expires_at to its own (possibly skewed) Date.now() — never do that. Returns lock_live
--    (writer present AND lease not expired, per now()) plus server_now so the client can render
--    "last heartbeat Ns ago" without trusting its own clock. M2: also self-heals a stale takeover
--    request (so a reader's poll, not just the writer's heartbeat, can unstick an abandoned request).
-- ---------------------------------------------------------------------------
create or replace function public.read_lock_state(
  p_request_ttl_seconds integer default 12
)
returns table (
  version               integer,
  writer_id             uuid,
  writer_session_id     text,
  lock_live             boolean,
  takeover_requested_by text,
  server_now            timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- M2 self-heal (same rule as renew): clear an abandoned takeover so a writer-less, request-wedged
  -- row recovers even if the writer isn't heartbeating to clear it itself.
  update public.boards b
     set takeover_requested_by = null,
         takeover_requested_at = null
   where b.user_id = v_uid
     and b.takeover_requested_at is not null
     and b.takeover_requested_at < now() - make_interval(secs => p_request_ttl_seconds);

  return query
    select b.version,
           b.writer_id,
           b.writer_session_id,
           (b.writer_id is not null and b.lock_expires_at >= now()) as lock_live,  -- DB-clock verdict
           b.takeover_requested_by,
           now() as server_now
      from public.boards b
     where b.user_id = v_uid;                          -- explicit ownership filter (SECURITY DEFINER bypasses RLS)
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants — authenticated only (mirrors 0001's grant model).
--    NOTE: these functions are SECURITY DEFINER and therefore BYPASS RLS on public.boards. Per-user
--    ownership is enforced solely by the `b.user_id = auth.uid()` filter inside each function body
--    (verified present in claim/renew/release/request_takeover/read_lock_state). `set search_path =
--    public` pins resolution so the definer privilege can't be abused via a hostile search_path.
-- ---------------------------------------------------------------------------
grant execute on function public.claim_board_lock(text, integer)            to authenticated;
grant execute on function public.renew_board_lock(text, integer, integer)   to authenticated;
grant execute on function public.release_board_lock(text)                   to authenticated;
grant execute on function public.request_takeover(text)                     to authenticated;
grant execute on function public.read_lock_state(integer)                   to authenticated;
```

> Note on `app_state` & view mode (m5 correction): a writer's scene push never carries
> `viewModeEnabled` into the cloud row — but NOT because `stripEphemeral` removes it. `viewModeEnabled`
> is configured `browser:false` in the appState storage table
> (`packages/excalidraw/appState.ts:243` — `viewModeEnabled: { browser: false, export: false, server:
> false }`), and `serializeScene` runs `clearAppStateForLocalStorage` (`boardRepository.ts:42`) which
> uses the `"browser"` config (`packages/excalidraw/appState.ts`, `clearAppStateForLocalStorage →
> _clearAppStateForStorage(appState, "browser")`) and therefore already excludes every `browser:false`
> key, `viewModeEnabled` included. (`stripEphemeral` handles a different, viewport/selection set.) Net
> result is the same — no migration change needed — but the mechanism is `clearAppStateForLocalStorage`,
> not `stripEphemeral`. This also means reader-mode is purely a runtime PROP (§0): even if a stale
> `viewModeEnabled` were ever present in a row, it would be ignored because the app passes the prop,
> which overrides row/appState state.

---

## 2. Lock acquisition & heartbeat (the crux)

### Why naive read-then-write races

`acquire = if (read().writer_id is null) update(set writer_id=me)` has a TOCTOU gap: two sessions both
read NULL, both write themselves, both believe they hold it → two writers. There is no atomicity
between the read and the write.

### Our mechanism — a single conditional `UPDATE` inside `claim_board_lock` (RPC)

We pick the **RPC wrapping a conditional UPDATE** (not a bare client-side conditional UPDATE) for two
reasons: (a) the lease comparison must use the **server clock** `now()`, which a client UPDATE
can't express against an arbitrary column without a round-trip; (b) we want claim to also clear the
takeover columns atomically. The exact guard (the load-bearing clause):

```sql
where b.user_id = auth.uid()
  and ( b.writer_id is null               -- free
     or b.lock_expires_at < now()         -- lease expired (crash/sleep)
     or b.writer_session_id = p_session_id -- already ours (idempotent)
      )
```

Atomicity: the `UPDATE` takes a **row-level lock** on the single board row. Two concurrent
`claim_board_lock` calls serialize on that lock — the first commits `writer_id = A`; when the second's
UPDATE proceeds it re-evaluates the WHERE against the now-current row (`writer_id = A`, not expired,
`writer_session_id ≠ B`) → 0 rows changed. Each call then re-`select`s and returns `acquired =
(writer_session_id = my_session_id)`, so exactly one sees `acquired = true`. No read-then-write gap.

**Auto-writer on first open (decision #1 precise rule):** `start()` issues one `claim_board_lock`.
- If it returns `acquired = true` (lock was free/expired) → this session becomes **writer**. This is
  how "opening a board with NO active writer makes you the writer automatically."
- If it returns `acquired = false` with a live holder → this session becomes **reader** and must click
  "Take over" to write. It does NOT retry-claim in a loop.

So the FIRST session to open a board with a free lock auto-becomes writer; a session that opens while a
writer is live becomes a reader. Exactly decision #1.

### Heartbeat (writer) — N = 5s, lease TTL = 25s

The writer runs a timer every **`HEARTBEAT_INTERVAL_MS = 5000`** calling `renew_board_lock`, which sets
`lock_expires_at = now() + 25s`. TTL ≫ interval so losing 1–4 beats (a GC pause, a brief network blip)
does not drop the lease. On each renew the RPC returns:
- `still_writer = true`, `takeover_requested_by = null` → keep writing.
- `takeover_requested_by = <someone>` → a takeover is pending: the writer enters the **handoff** path
  (§4) — flush, release, demote. (`renew` deliberately does NOT renew the lease while a takeover is
  pending, so the lease starts ticking toward expiry as a safety net if the writer stalls mid-handoff.)
- `still_writer = false` (we lost the lock — lease expired & someone else claimed, e.g. after laptop
  sleep) → the writer **demotes to reader immediately** (set `viewModeEnabled`, stop the push pipeline,
  show banner) and does NOT clobber. It then pulls to resync (ties into `repullAndReconcile`, §6).

**Renew failure (network error):** treated like any transient — keep the existing role optimistically
for up to the lease window; the *server* lease is the source of truth, so if the writer is truly
offline the lease expires server-side and a reader can claim. On the next successful renew the writer
re-learns its true state (`still_writer`). We do NOT demote on a single failed renew (that would
thrash on a flaky network); we demote when the server says `still_writer = false`.

### Reader poll — M = 4s

A reader runs a timer every **`READER_POLL_INTERVAL_MS = 4000`** calling the **`read_lock_state` RPC**
(m5 — a `SECURITY DEFINER` function, NOT a plain client `select`). The RPC computes liveness with the DB
clock and returns `{ version, writer_id, writer_session_id, lock_live, takeover_requested_by, server_now
}`, where `lock_live = (writer_id is not null AND lock_expires_at >= now())`. The client NEVER compares
`lock_expires_at` to `Date.now()` — it consumes the server's `lock_live` verdict directly. The role
decision is then clock-free:

```
held_by_me      = lock_live && writer_session_id === mySessionId
held_by_other   = lock_live && !held_by_me
free_or_expired = !lock_live                          // writer absent OR lease expired (server verdict)

role = held_by_me ? 'writer'
     : held_by_other ? 'reader'                       // stays reader; Take-over enabled
     : 'reader'                                        // free/expired → reader-who-can-claim
```

Per decision #1, a fresh session that finds `free_or_expired` during *polling* still stays reader (it
only auto-claims at `start()`). The reader uses `!lock_live` to enable the Take-over fast path.
`server_now` is returned only for cosmetic "last heartbeat Ns ago" presence text (subtracting two
server-stamped timestamps), never for the liveness decision — which is already baked into `lock_live`.
This removes the client-clock hazard entirely; there is no `skew` offset to maintain.

**Version refetch:** on each poll the reader compares the returned `version` against `localMeta.version`
(`syncEngine.ts:46-49`, the persisted `{version,lastSyncedAt}`); if cloud `version` is greater it calls
the existing `applyRemoteScene` path (via `applyCloud`, `syncEngine.ts:412-426`) to refetch the scene +
files. This reuses the engine's existing pull/apply machinery unchanged.

---

## 3. Roles & state machine

### Role state — new `lockAtom`

Add a new atom (alongside `syncStatusAtom.ts` / `sessionAtom.ts`) rather than overloading
`SyncStatus`. `SyncStatus` stays `idle|syncing|synced|error|offline` (`syncStatusAtom.ts:3`) — it
describes *the push pipeline's* health and is orthogonal to role. New file
`excalidraw-app/data/supabase/lockAtom.ts`:

```ts
export type SyncRole = "writer" | "reader";
export interface LockState {
  role: SyncRole;
  // presence/holder info the UI shows ("editing on another session"):
  holderSessionId: string | null;     // writer_session_id from the row
  holderIsMe: boolean;
  lockLive: boolean;                   // writer_id != null && lock_expires_at > server now
  takeoverPending: boolean;            // a takeover_requested_by is set
  takeoverInFlight: boolean;           // THIS session clicked Take over and is waiting
}
// initial: reader, nothing held (safe default — nobody can push until promoted)
```

The engine owns role transitions and pushes them into `lockAtom` via an injected `setLock` dep
(mirroring how it pushes `setStatus`, `syncEngine.ts:41`). The hook subscribes and derives
`viewModeEnabled = role === "reader"`.

### State machine (ASCII)

```
                              ┌─────────────────────────────────────────────────────────┐
                              │                        SIGNED OUT                         │
                              │        (no engine; viewModeEnabled = false)               │
                              └───────────────┬──────────────────────────▲────────────────┘
                                              │ sign in / start()          │ sign out / stop()
                                              ▼                            │
                              ┌───────────────────────────────┐           │
                              │   CLAIMING (one claim attempt) │───────────┤
                              │   start() → claim_board_lock   │           │
                              └──────┬───────────────┬─────────┘           │
                       acquired=true│               │acquired=false        │
                          (free)    │               │(live holder)         │
                                    ▼               ▼                      │
        ┌──────────────────────────────────┐   ┌──────────────────────────────────────────┐
        │             WRITER                │   │                READER                      │
        │  viewModeEnabled = false          │   │  viewModeEnabled = true  (HARD read-only) │
        │  push pipeline ACTIVE             │   │  push pipeline NO-OP (notify/flush/syncNow)│
        │  heartbeat 5s (renew_board_lock)  │   │  poll 4s (read_lock_state):                │
        │  on renew sees takeover ─────────┐│   │   • version↑ → applyCloud (refetch)        │
        │                                  ││   │   • lock free/expired → enable Take over   │
        └───────┬───────────────┬─────────┘│   └───────────┬───────────────────▲────────────┘
                │               │           │               │ click Take over   │ lost claim race
   tab close /  │   takeover    │ lease lost│   handoff      │ (request_takeover)│ (loser stays reader)
   unmount      │   requested   │ (sleep,   │   complete:    ▼                   │
   flush+release│   (HANDOFF)   │  someone  │   requester   ┌──────────────────────────────────┐
                ▼               ▼  else      │   wins claim  │     TAKEOVER_PENDING (requester)  │
        ┌───────────────┐  ┌──────────────┐ │   ───────────►│  still reader + viewMode=true     │
        │  RELEASED →    │  │ flush final, │ │               │  poll: did writer release / did   │
        │  SIGNED-IN     │  │ release,     │ │               │  ACK_GRACE(12s) elapse?           │
        │  (engine idle) │  │ DEMOTE→READER│─┘               │   → claim_board_lock              │
        └───────────────┘  └──────────────┘                 └───────┬───────────────┬──────────┘
                                                          acquired   │               │ acquired=false
                                                          =true      ▼               ▼ (another reader won)
                                                    pull latest → WRITER        back to READER
```

### Transition rules

- **initial open → CLAIMING → WRITER | READER**: one `claim_board_lock` at `start()`. Free ⇒ writer;
  live holder ⇒ reader. (§2.)
- **READER → WRITER (Take over)**: the handoff protocol (§4). Requester goes READER →
  TAKEOVER_PENDING → (wins atomic claim) → WRITER.
- **WRITER → READER (taken over / lease lost)**: writer sees `takeover_requested_by` on a renew
  (graceful) OR `still_writer = false` (lease lost after sleep/crash-recovery) → demote to reader
  (set viewMode, stop push, banner). Decision #2 only *forces* a handoff on explicit takeover; a
  writer does NOT auto-release just for going idle.
- **WRITER → RELEASED (tab close / unmount)**: YES — flush + `release_board_lock` on
  `beforeunload`/`blur`/visibility-hidden/unmount so a clean close frees the lock fast; heartbeat-lease
  expiry (25s) is the crash fallback when the unload handler doesn't run.

### Where the push pipeline is GATED (reader = never push)

Single chokepoint in the engine so the gate can't be bypassed:
- `notifyChange()` (`syncEngine.ts:332`): add `if (this.role === "reader") return;` as the **first**
  line (before the `getUserId()` null-check at `:333`). A reader's edits can't happen anyway
  (viewMode), but a programmatic `updateScene` must never arm the debounce.
- `flush()` (`syncEngine.ts:372`): add `if (this.role === "reader") return;` as the first line — so a
  reader's unload/blur flush is a no-op and never pushes.
- `syncNow()` (`syncEngine.ts:365`): add the same guard so a reader can't force a push from the UI.
- `runPush()` (`syncEngine.ts:432`): belt-and-suspenders `if (this.role === "reader") return;` at the
  top, in case any future caller reaches it.
- The handoff's **final flush** must bypass the gate: it runs while the engine is *still* writer
  (`role === "writer"`) and only demotes to reader *after* the flush + release succeed (§4). So no
  special-casing of the gate is needed — order of operations preserves it.

### Flush-success contract (M1 — no lost edits on a failed final flush)

Today `flush()` / `runPush()` return `void` and swallow failures: on a network/file/conflict failure
`runPush` (`syncEngine.ts:432-523`) returns early leaving `dirty=true` and the edits unpushed
(`:453-461`, `:468-481`, `:499-504`, `:507-511`), and `flush()` (`:372-395`) likewise resolves with no
signal. That is fine for the normal retry loop, but it is **fatal for the handoff**: if the writer
released the lock after a flush that didn't actually commit, the requester would pull the *pre-flush*
version and the writer's final edits would be lost — and the demoted writer is now reader-gated and
cannot retry.

Fix: make the push report success.
- **`runPush()`** returns `boolean` — `true` **only** on the success path (after `this.dirty = false`
  and the `synced` status, `syncEngine.ts:514-522`); `false` on every early-return failure branch
  (file upload error `:453-461`, current-scene image errored `:468-481`, version `conflict` →
  `repullAndReconcile` `:507-511`, thrown push error `:499-504`, and the signed-out early return
  `:433-437`). The first-insert uniqueness-race path that re-pulls (`:495-498`) also returns `false`
  (nothing of ours committed this pass).
- **`flush()`** returns `boolean` — propagates `runPush()`'s result; the "not dirty / nothing to do"
  early return (`:372-374`) returns `true` (already in sync). The in-flight coalesce branch (`:376-380`)
  returns the result of the awaited re-run so a caller awaiting `flush()` during a concurrent push still
  learns the real outcome.
- Define **flush success = it committed AND `this.dirty === false` afterward.** The handoff demote/release
  step (§4) gates on exactly this boolean. Public `syncNow()` may keep returning `void` (UI doesn't need
  the signal); only the internal handoff consumes the boolean.

---

## 4. Graceful takeover handoff protocol (decision #2)

No Realtime — the "notify the writer" channel is the DB row, observed by the writer's 5s heartbeat and
the requester's 4s poll. Goal: NO lost edits, NO indefinite hang, exactly ONE winner.

### Column transitions, step by step

Let **W** = current writer session, **R** = requester (reader) session.

| # | Actor | Action | Row transition |
|---|---|---|---|
| 0 | — | steady state | `writer_session_id=W`, `lock_expires_at>now`, `takeover_*=null` |
| 1 | R | clicks Take over → `request_takeover(R)` | if W live & ≠ R: `takeover_requested_by=R`, `takeover_requested_at=now()`. Returns `immediately_claimable=false`. R enters TAKEOVER_PENDING, starts the ACK timer. |
| 2 | W | next heartbeat `renew_board_lock(W)` | sees a *live* `takeover_requested_by=R` (the RPC first clears a stale one, M2) → renew is a **no-op** (the `takeover_requested_by is null` guard fails), returns `takeover_requested_by=R`. Lease is NOT extended (starts ticking). |
| 3 | W | handoff: `const ok = await engine.flush()` | pushes final pending changes via the existing pipeline (`runPush`, `syncEngine.ts:432-523`) → on success `version` bumps, scene is now the latest in the cloud, `dirty===false`, `ok===true`. (Runs while still writer, so the reader-gate doesn't block it.) **The next two steps run ONLY if `ok===true`** (M1). |
| 3-fail | W | flush returned `ok===false` | network/file/conflict failure: scene did NOT commit, `dirty` is still `true`. W does **NOT** release and does **NOT** demote — it **stays writer**, surfaces `error`/`offline` on `syncStatusAtom` (already set by `runPush`), and leaves `takeover_requested_by=R` untouched so the handoff **retries on the next heartbeat** (§4 "failed-flush branch"). Row is unchanged from step 2. |
| 4 | W | `release_board_lock(W)` (only if `ok`) | `writer_id=null, writer_session_id=null, heartbeat=null, lock_expires_at=null, takeover_*=null`. Lock is now FREE. |
| 5 | W | demote (only if `ok`) | engine `role=reader`; hook sets `viewModeEnabled=true`, shows reader banner. W is now a reader. |
| 6 | R | next poll sees lock FREE | `read_lock_state` returns `lock_live=false` (writer_id null) → R calls `claim_board_lock(R)`. |
| 7 | R | `claim_board_lock(R)` | WHERE matches (`writer_id is null`) → sets `writer_session_id=R`, fresh lease. Returns `acquired=true` + current `version`. |
| 8 | R | pull latest, promote | `version` from claim > `localMeta.version` ⇒ `applyCloud` refetches W's just-flushed scene (step 3). engine `role=writer`; hook clears `viewModeEnabled`. R is now the writer with no lost edits. |

**How the requester knows it WON (vs another reader also requesting):** the winner is decided **only**
by `claim_board_lock` (step 7), never by `takeover_requested_by`. If R1 and R2 both poll the freed
lock and both call `claim_board_lock`, the row-lock serializes them — exactly one gets `acquired=true`;
the other gets `acquired=false` with `writer_session_id` = the winner, and stays reader. The
`takeover_requested_by` column is only a *signal to the writer*; it does not grant the lock.

**Writer already gone/crashed when Take over is clicked:** `request_takeover` returns
`immediately_claimable=true` (the row shows `writer_id=null` or `lock_expires_at<=now()`). R skips the
wait and calls `claim_board_lock` on its very next tick — no one to notify.

**TIMEOUT (writer never acks — presumed dead):** R, on entering TAKEOVER_PENDING (step 1), starts an
**`ACK_GRACE_MS = 12000`** timer (~2× the heartbeat+poll budget; comfortably > one missed heartbeat).
On each poll while pending (the poll's `lock_live` is the server-clock verdict, m5 — R never inspects
`lock_expires_at` itself):
- if `read_lock_state` reports `lock_live=false` → lock is free/expired → claim (the normal path, step 6).
- if `ACK_GRACE` elapses AND `lock_live` is still `false` only after the lease lapses (W stopped
  renewing) → R calls `claim_board_lock`, whose `lock_expires_at < now()` branch (evaluated server-side)
  lets it steal the lease. R wins, pulls, promotes.
- if `ACK_GRACE` elapses but `lock_live` is still `true` (W is renewing but ignoring the request —
  shouldn't happen, since `renew` won't extend while a takeover is pending) → R surfaces "Couldn't take
  over — the other session is still active" and stays reader (no forced steal of a live lease). This is
  the only non-success terminal, and it's self-healing: once W's lease lapses, the next click succeeds.

**FAILED-FLUSH BRANCH (M1 — the writer's final flush didn't commit).** This is the crux fix. When W
sees the takeover on a heartbeat (step 2) it runs `ok = await engine.flush()`:
- `ok === true` → proceed to release + demote (steps 4–5). The requester pulls the just-committed scene.
- `ok === false` → W is offline / hit a file error / lost a version conflict; its edits are still local
  (`dirty === true`). W **does NOT release the lock and does NOT demote** — it remains the writer, so it
  is NOT reader-gated and CAN still push. The `takeover_requested_by=R` signal stays set, so on **each
  subsequent heartbeat** W re-attempts `engine.flush()` (it can't renew the lease while the request
  stands, but it keeps retrying the flush). As soon as connectivity returns and a flush succeeds, W
  completes the handoff (release + demote) and R picks it up — **no edits lost**.
  - If W genuinely cannot recover (stays offline), its lease — which `renew` refuses to extend while the
    request is pending — expires within `LEASE_TTL`. Then R's ACK_GRACE + `!lock_live` path (above)
    steals the lease. In that case W's un-flushed local edits are NOT propagated (W is partitioned and
    by definition can't push them); when W eventually reconnects, its renew returns `still_writer=false`
    → it demotes + `repullAndReconcile` (§6.1) and does not clobber. This is the same "partitioned writer
    loses to the lease holder" semantics already accepted in §6.1 — the difference M1 makes is that a
    *recoverable* (transient) flush failure never drops edits, only a *true* partition does, and that
    only after the full lease window.
- Net invariant (M1): **the lock is released to a requester only after a flush that returns success**, so
  a requester can never pull a pre-flush scene from a still-recoverable writer.

Because `renew_board_lock` refuses to extend the lease while a LIVE `takeover_requested_by` is set
(step 2), a *responsive-but-busy* or *failing* writer's lease still decays to expiry within `LEASE_TTL`
— so the requester's timeout path always eventually fires even if W's flush keeps failing. No indefinite
hang. (And M2's REQUEST_TTL cleanup ensures the *converse*: an abandoned request never wedges a healthy
writer — see §6.13.)

### ASCII handoff sequence diagram

```
  WRITER (W)                         DB (boards row)                       REQUESTER (R, reader)
     │                                     │                                        │
     │   …editing, heartbeat 5s…           │                                        │   …polling 4s…
     │ ── renew_board_lock(W) ──────────►  │  lease += 25s                          │
     │                                     │                                        │
     │                                     │  ◄──────────── request_takeover(R) ────│  [user clicks
     │                                     │  takeover_requested_by = R             │   "Take over"]
     │                                     │  (lease NOT extended henceforth)       │  → TAKEOVER_PENDING
     │                                     │                                        │  → start ACK_GRACE 12s
     │ ── renew_board_lock(W) ──────────►  │  clears stale req (M2); guard fails    │
     │  ◄── {still_writer, takeover=R} ─── │  (live takeover set): NO-OP renew      │
     │                                     │                                        │
     │  ── ok = await engine.flush() ───►  │  IF SUCCESS: document/app_state,       │   (still polling…)
     │       (final unsynced edits)        │             version++                  │
     │                                     │                                        │
     │  ┌─ M1 GATE: branch on `ok` ───────────────────────────────────────────┐    │
     │  │ ok===false (offline/file/conflict): scene NOT committed, dirty=true. │    │
     │  │   ↳ DO NOT release, DO NOT demote — STAY WRITER, show error/offline, │    │
     │  │     leave takeover_requested_by=R → retry flush next heartbeat.      │    │
     │  │     (lease can't be renewed while req stands → decays to expiry;     │    │
     │  │      if W never recovers, R's lease-expiry path steals it, §6.1.)    │    │
     │  │ ok===true: proceed ↓                                                 │    │
     │  └──────────────────────────────────────────────────────────────────────┘   │
     │ ── release_board_lock(W) ────────►  │  writer_id=null, lease=null,           │
     │   (ONLY when ok===true)             │  takeover_*=null   → LOCK FREE         │
     │  role=READER, viewMode=true         │                                        │
     │  (banner: editing active elsewhere) │  ◄──────────── read_lock_state ────────│  sees lock_live=false
     │                                     │  ─────────── {lock_live:false,...} ───►│  (writer_id null)
     │                                     │  ◄──────────── claim_board_lock(R) ────│
     │                                     │  writer_session_id=R, fresh lease      │
     │                                     │  ───────────── {acquired:true, ver} ──►│  WON
     │                                     │  ◄──────────── pullBoard (applyCloud) ─│  pull W's flushed
     │                                     │  ───────────── latest scene ──────────►│  scene → no lost edits
     │                                     │                                        │  role=WRITER, viewMode=false
     │   (now a reader, polling 4s)        │                                        │   (now the writer, heartbeat 5s)
     ▼                                     ▼                                        ▼

  CRASH/TIMEOUT variant: if W never reaches the renew (dead), takeover_requested_by sits; W's lease
  expires at ≤25s; once R's ACK_GRACE(12s) has passed AND read_lock_state reports lock_live=false, R's
  claim_board_lock takes the `lock_expires_at < now()` branch and steals the lease. Same WON path.
```

---

## 5. Integration points (cite current file:line)

### `excalidraw-app/data/supabase/syncEngine.ts`
- **New deps on `SyncEngineDeps`** (`syncEngine.ts:29-44`): `setLock: (s: LockState) => void`
  (mirrors `setStatus`, `:41`); `getSessionId: () => string` (the per-tab id). No need to inject role —
  the engine owns it as private state.
- **New private state** near `:149-161`: `private role: SyncRole = "reader";`,
  `private heartbeatTimer`, `private pollTimer`, `private takeoverDeadline: number | null`.
- **Lock claim on start** in `start()` (`syncEngine.ts:261-321`): after the initial `pullBoard`
  (`:268`) and reconcile, call `claim_board_lock`. `acquired ⇒ becomeWriter()` (start heartbeat, stop
  poll, `role=writer`, push `setLock`); else `becomeReader()` (start poll, `role=reader`, push
  `setLock`). The existing reconcile (`:289-307`) stays — claim runs *after* the scene is settled.
- **Reader gate**: first-line `if (this.role === "reader") return;` in `notifyChange()` (`:332`),
  `flush()` (`:372`), `syncNow()` (`:365`), and `runPush()` (`:432`). (§3.)
- **Heartbeat timer** (writer): every 5s call `renew_board_lock`; on a LIVE `takeover_requested_by` →
  `performHandoff()`; on `still_writer=false` → `becomeReader()` + `repullAndReconcile`. New private
  method; armed in `becomeWriter`, cleared in `becomeReader`/`stop`.
- **`performHandoff()` (M1 — flush-success gated)**: `const ok = await this.flush();` (the engine is
  still `role==="writer"`, so the reader-gate doesn't block it). **Only if `ok === true`** →
  `releaseLock()` then `becomeReader()`. **If `ok === false`** → do NOT release, do NOT demote: stay
  writer (status is already `error`/`offline` from `runPush`), leave `takeover_requested_by` set, and
  let the *next* heartbeat re-enter `performHandoff()` and retry the flush. (If W stays offline, its
  lease — un-renewable while the request stands — expires and the requester's lease-expiry path takes
  over, §4 failed-flush branch / §6.1.) This is the single behavioral change that resolves M1; it
  depends on `flush()`/`runPush()` returning the success boolean defined in §3.
- **Poll timer** (reader): every 4s call `readLockState` (the **RPC**, m5); run the clock-free role
  decision off `lock_live` (§2); on `version↑` → `applyCloud` (`:412`). New private method; armed in
  `becomeReader`, cleared in `becomeWriter`/`stop`.
- **`flush()`/`runPush()` return type (M1)**: change both from `void`/`Promise<void>` to
  `Promise<boolean>` per the §3 flush-success contract. `notifyChange()`'s fire-and-forget `void
  this.flush()` (`:360`) and the unload `void engineRef.current?.flush()` (`useSupabaseSync.ts:222`)
  ignore the result and are unaffected; only `performHandoff()` consumes it.
- **`takeOver()` public method** (new): if `role!=="reader"` no-op; else `request_takeover` → set
  `takeoverInFlight`, `takeoverDeadline = ACK_GRACE`; the existing poll loop drives the claim attempt
  (do NOT duplicate poll logic). Exposed up through the hook.
- **Release on stop/dispose**: `stop()` (`:324-329`) and the unload flush path must call
  `release_board_lock` if `role==="writer"`. Add a `releaseIfWriter()` and call it from `stop()` and a
  new sync best-effort branch in `dispose()` (`:398-405`). Clear both new timers in `clearTimer`-adjacent
  cleanup (extend `clearTimer`, `:241-246`, or add `clearLockTimers`).
- **Unchanged**: localMeta persistence (`:196-235`), the dirty-snapshot logic (`:123-126`, `:337-345`),
  online/offline listeners (`:167-189`, `:248-254`), `applyCloud`/`repullAndReconcile` (`:412-548`),
  the files-first push order (`:447-523`).

### `excalidraw-app/data/supabase/boardRepository.ts`
New thin RPC wrappers (each `client.rpc(...)`, returning typed results), alongside `pullBoard`/`pushBoard`.
**All five are RPCs** — none is a plain client `select` (m5: liveness must be a DB-clock verdict):
- `claimLock(client, sessionId)` → `{ acquired, holder: {writerId, writerSessionId}, lockExpiresAt, version }`
- `renewLock(client, sessionId)` → `{ stillWriter, takeoverRequestedBy, version }`
- `releaseLock(client, sessionId)` → `void`
- `requestTakeover(client, sessionId)` → `{ immediatelyClaimable, writerSessionId, lockExpiresAt }`
- `readLockState(client)` → **`client.rpc("read_lock_state")`** (m5 — NOT a plain select) →
  `{ version, writerId, writerSessionId, lockLive, takeoverRequestedBy, serverNow }`. The client keys
  on `lockLive`/`takeoverRequestedBy`; it never compares any expiry to `Date.now()`. (No `userId` arg —
  the RPC reads `auth.uid()` itself.) `BoardRow` need not carry the lock columns (the poll uses this
  RPC's projection, not `select *`); `mapRowToBoard` (`:46-55`) is unchanged.
- **Unchanged**: `serializeScene` (`:37-44`), `pullBoard` (`:61-76`, still `select *` for the scene),
  `pushBoard`'s version guard (`:113-137`) — still used.

### `excalidraw-app/data/supabase/useSupabaseSync.ts`
- Inject the new deps when constructing the engine (`useSupabaseSync.ts:175-187`): `setLock` (a stable
  jotai setter for `lockAtom`), `getSessionId: () => sessionIdRef.current` (mint once via
  `crypto.randomUUID()` in a `useMemo`/ref, persisted to `sessionStorage`).
- The engine's poll/heartbeat timers live **inside the engine** (not the hook) — the hook just wires
  deps, matching how all timing already lives in the engine (the hook "holds NO debounce/status/retry
  logic," `useSupabaseSync.ts:42-45`). This keeps the existing architecture.
- Read `lockAtom` and **derive `viewModeEnabled = role === "reader"`**; return it from the hook
  (extend `UseSupabaseSyncResult`, `:27-34`). Also return `role`, presence (`holderIsMe`/`lockLive`/
  `takeoverPending`), and a `takeOver` action (`() => engineRef.current?.takeOver()`).
- The existing unload/blur/visibility flush (`:217-238`) gains a `releaseIfWriter()` companion call so a
  clean close frees the lock; the engine's `dispose()`/`stop()` already centralize this.
- **Unchanged**: `applyRemoteScene` (`:128-164`), the spinner-flooring logic (`:65-100`), the
  construction/start effects (`:170-214`).

### `excalidraw-app/App.tsx`
- Pass **`viewModeEnabled={supabaseSync.viewModeEnabled}`** to `<Excalidraw>`. Insert in the props
  block — e.g. right after `theme={editorTheme}` (`App.tsx:1003`) / before `renderTopRightUI`
  (`:1005`). Currently no `viewModeEnabled` prop exists in `960-1057`; adding it is the entire reader
  enforcement (§0). When the flag is off, `supabaseSync.viewModeEnabled` is `false` ⇒ identical to today.
- **Reader banner**: render a flag-gated banner alongside the existing app alerts
  (`App.tsx:1102-1111`, the `alert--warning`/`alert--danger` pattern) — e.g.
  `{isSupabaseSyncEnabled() && supabaseSync.role === "reader" && <div className="alert alert--warning">Read-only — editing is active on another session.<button>Take over editing</button></div>}`.
  Reuse the existing alert styling; the button calls `supabaseSync.takeOver()`.
- Wire `role`/`takeOver`/presence into the `SyncStatusButton` props at the existing render site
  (`App.tsx:1017-1024`).
- **Unchanged**: `onChange` (`:716-773`) still calls `supabaseSync.notifyChange()` (`:761`) — the
  engine's reader-gate makes it a no-op for readers, so no app-side change to `onChange` is needed.

### `excalidraw-app/data/supabase/syncStatusAtom.ts` / new `lockAtom.ts`
- `syncStatusAtom` (`syncStatusAtom.ts:18-22`) **unchanged** — `SyncStatus` stays orthogonal to role.
- New `lockAtom.ts` exporting `SyncRole`, `LockState`, and `lockAtom` (§3), initial `role:"reader"`.

### `excalidraw-app/components/SyncStatusButton.tsx`
- Add `role`, presence, and `onTakeOver` to `SyncStatusButtonProps` (`:9-16`).
- Extend `getPresentation` (`:24-45`): when `role==="writer"` and signed in → glyph/label "Editing"
  (a distinct modifier, e.g. `--writer`); when `role==="reader"` → "Read-only" / `--reader`.
- In the popover (`:133-169`): when reader, show a **"Take over editing"** menuitem calling
  `onTakeOver` (disabled + "Taking over…" while `takeoverInFlight`); when writer, show "Editing — you
  have the lock" + keep "Sync now". Add SCSS modifiers in the adjacent `.scss`.

### `excalidraw-app/components/SignInDialog.tsx`
- No functional change required. (Reader/writer is post-auth.) Optional copy tweak only.

### `supabase/migrations/0002_board_locks.sql`
- New migration (§1). Extends `boards` (`0001:17-26`) + adds **five** `SECURITY DEFINER` RPCs
  (`claim`/`renew`/`release`/`request_takeover`/`read_lock_state`). Reuses `0001`'s grant model
  (`:61`). NOTE (m5): these RPCs **bypass** `0001`'s RLS (`:53-82`) by virtue of `SECURITY DEFINER`;
  ownership is enforced by the `user_id = auth.uid()` filter inside each — the existing table RLS still
  protects any *direct* table access (`pullBoard`/`pushBoard`), which is unchanged.

### `excalidraw-app/app_constants.ts`
- New constants: `SUPABASE_LOCK_HEARTBEAT_MS = 5000`, `SUPABASE_LOCK_POLL_MS = 4000`,
  `SUPABASE_LOCK_LEASE_SECONDS = 25`, `SUPABASE_TAKEOVER_ACK_GRACE_MS = 12000`, and
  `STORAGE_KEYS.SESSION_STORAGE_SUPABASE_SESSION_ID` (mirrors the existing
  `LOCAL_STORAGE_SUPABASE_META`, `app_constants.ts:46`).

---

## 6. Edge cases & failure modes

1. **Writer's laptop sleeps / loses network mid-edit.** Heartbeat stops → lease expires at ≤25s → a
   reader's Take-over (or its next claim after ACK_GRACE) wins via the `lock_expires_at < now()`
   branch. When the original writer **wakes**, its first `renew_board_lock` returns
   `still_writer=false` (someone else now holds it) → it **demotes to reader** and runs
   `repullAndReconcile` (`syncEngine.ts:531-548`) which applies the cloud row (now the new writer's
   version) over the local scene — NO clobber. Its dirty local edits made during sleep are NOT pushed
   (gate + version guard both stop it). This is acceptable: the lease holder is authoritative; the
   woken tab is stale by definition.
2. **Two readers click Take over near-simultaneously.** `request_takeover` just overwrites the signal
   column; the **atomic `claim_board_lock` (row lock)** picks exactly one winner (§4). The loser gets
   `acquired=false`, stays reader, and its UI clears `takeoverInFlight`.
3. **Reader's poll is slow / offline.** No writes happen anyway. The reader keeps its last-known scene
   and last-known role; on reconnect the next poll re-syncs `version` and re-derives role. Status atom
   can show `offline` (the existing offline machinery, `syncEngine.ts:347-355`) independent of role.
4. **Writer never sees the takeover (crashed mid-edit, unload handler didn't fire).** `release` never
   runs; the lease expires; the requester's ACK_GRACE + `lock_expires_at <= now()` path claims (§4
   timeout). Bounded by `max(ACK_GRACE, lease remaining)` ≤ ~25s.
5. **A reader becoming writer must reconcile version (stale local scene).** The promotion path (§4
   step 8 / §2 poll) compares the claim/poll `version` against `localMeta.version`
   (`syncEngine.ts:46-49`) and runs `applyCloud` (`:412-426`) **before** it starts pushing — so the
   new writer's baseline (`lastSyncedSnapshot`, `:152`,`:420`) is the freshly-pulled scene. Its first
   `pushBoard` therefore guards against the correct `version`. No clobber of the prior writer's flush.
6. **Clock skew (m5).** Every lease/expiry comparison happens **inside the DB** against `now()`:
   `claim`/`renew`/`request` stamp `now()` server-side, and the reader/writer poll consumes
   `read_lock_state`'s `lock_live` boolean — itself computed as `writer_id is not null AND
   lock_expires_at >= now()` in the function body (m5). The client therefore **never** compares
   `lock_expires_at` to `Date.now()`; there is no client-side `skew` offset to maintain. `server_now`
   is returned only for cosmetic "last heartbeat Ns ago" presence (two server-stamped timestamps
   subtracted). This mirrors `0001`'s rule that the integer `version` (not client `updated_at`) drives
   conflict resolution (`0001:3-5`). The heartbeat interval/lease are *durations* (interval math in
   SQL), so only the absolute timestamps need a common clock — which is the DB's.
7. **Does version-guarded `pushBoard` still matter with one writer?** **YES — defense in depth.** During
   the brief handoff window (W releasing while R claiming) or a lease-expiry race (W woke and pushes one
   stale frame before its renew tells it `still_writer=false`), two sessions could momentarily both
   believe they may write. The version guard (`boardRepository.ts:124`, `.eq("version", expected)`)
   ensures the stale writer's push returns `conflict` → `repullAndReconcile`, not a clobber. We KEEP it
   untouched. The lock prevents the *steady-state* fight; the version guard catches the *transient*.
8. **First-insert + lock interplay.** On true first login the row doesn't exist yet (`pullBoard` →
   null, `syncEngine.ts:270`). `start()` INSERTs via the existing `flush`/`pushBoard` first-insert path
   (`:271-286`, `boardRepository.ts:93-110`), THEN calls `claim_board_lock` (which now finds a row with
   `writer_id=null` → acquires). If a uniqueness race inserts the row first
   (`isUniquenessRace`, `syncEngine.ts:107-116`), reconcile runs, then claim runs against the existing
   row. Claim is always *after* row existence is guaranteed.
9. **Same user, writer tab + reader tab, writer closes cleanly.** `release_board_lock` frees the lock;
   the reader tab's next poll sees free → still stays reader (decision #1: polling never auto-claims).
   The user clicks Take over (or reopens) to edit. (Acceptable per locked decision #1; we could later
   relax "auto-promote my own other tab," but NOT in scope.)
10. **RPC permission / ownership failure (m5).** The lock RPCs are `SECURITY DEFINER` and **bypass
    RLS**; ownership is enforced solely by the `user_id = auth.uid()` filter inside each body (verified
    present in claim/renew/release/request_takeover/read_lock_state). A signed-out call has `auth.uid()
    is null` → the filter matches no row → 0 rows updated, empty result (and `claim` additionally raises
    `28000`). A wrong-user call can never reach another user's row because the filter binds to the
    caller's own `auth.uid()`. `set search_path = public` on every function prevents search-path abuse
    of the definer privilege. The engine treats RPC *errors* via the existing
    `isPermissionError`/`isNetworkError` classification (`syncEngine.ts:52-100`) and surfaces
    `error`/`offline` on `syncStatusAtom` without changing role optimistically on a transient.
11. **Multi-board migration note.** If `boards` later becomes `unique(user_id, name)`, the RPCs must key
    on `board_id` (passed in) instead of `user_id`, and `read_lock_state` selects by `id` (keeping the
    `user_id = auth.uid()` ownership check alongside). The column model needs no change. Documented so
    the implementer doesn't bake in `user_id`-only assumptions beyond the RPC signatures.
12. **Failed final flush during handoff (M1).** Covered in detail in §4 "failed-flush branch". Summary:
    the writer releases the lock **only after `flush()` returns success**. A transient flush failure
    (offline/file/conflict) keeps W as writer + dirty and retries on each heartbeat, so a requester can
    never pull a pre-flush scene from a recoverable writer — no lost edits. A *non*-recoverable writer
    (true partition) loses the lock only after its un-renewable lease expires, at which point its
    un-flushed edits are genuinely unreachable and the §6.1 demote-and-reconcile (no clobber) applies.
13. **Stuck / abandoned takeover request (M2).** `takeover_requested_by` has its own `REQUEST_TTL`
    (= ACK_GRACE = 12s). Both `renew_board_lock` (STEP A) **and** `read_lock_state` clear it when
    `takeover_requested_at < now() - REQUEST_TTL`. So: (a) a requester that abandons (closes its tab)
    before the writer acks no longer wedges the writer — within ≤REQUEST_TTL the writer's next heartbeat
    clears the request and resumes renewing its lease, staying writer; (b) a writer that briefly stalled
    (e.g. the M1 transient) and whose request is genuinely stale gets it cleared too. A *live* requester
    re-affirms its intent inside its own ACK_GRACE window (it's actively polling/claiming), so its
    request is never spuriously cleared before it can claim. This closes the "request outlives any live
    reader" gap and makes the request column self-healing from both sides.

---

## 7. What changes vs stays

**Stays unchanged (minimally invasive):**
- `serializeScene`, the files-first push order, `pushBoard`'s version guard, `pullBoard`
  (`boardRepository.ts`).
- `applyRemoteScene` (`useSupabaseSync.ts:128-164`), the spinner-flooring (`:65-100`), construction &
  start/stop effects (`:170-214`), the unload/blur/visibility flush wiring (`:217-238`).
- The engine's localMeta persistence, dirty-snapshot, online/offline listeners,
  `applyCloud`/`repullAndReconcile`, the whole status machine (`SyncStatus`).
- `syncStatusAtom` (orthogonal to role). `sessionAtom`. `SignInDialog`.
- `onChange` in `App.tsx` (the reader-gate lives in the engine, so `notifyChange()` at `:761` needs no
  app change).

**Extended:**
- `boards` table → 6 lock columns + 5 `SECURITY DEFINER` RPCs (claim/renew/release/request_takeover/
  read_lock_state) (`0002_board_locks.sql`).
- `SyncEngineDeps` → `+setLock`, `+getSessionId`; engine gains role state, heartbeat timer, poll timer,
  `takeOver()`, lock claim-on-start, release-on-stop, the 4-point reader gate, and the flush-success
  contract: `flush()`/`runPush()` now return `Promise<boolean>` (M1) and `performHandoff()` releases
  only on `ok===true`.
- `boardRepository` → `+claimLock/renewLock/releaseLock/requestTakeover/readLockState` (all five are
  `client.rpc(...)` wrappers; `readLockState` is an RPC, not a select — m5). `BoardRow` unchanged.
- `useSupabaseSync` → wire the new deps, mint/persist `session_id`, subscribe `lockAtom`, derive +
  return `viewModeEnabled`/`role`/presence/`takeOver`.
- `App.tsx` → pass `viewModeEnabled`, render the reader banner, pass role/takeOver to
  `SyncStatusButton`.
- `SyncStatusButton` → reader/writer presentation + "Take over editing".
- New `lockAtom.ts`; new constants in `app_constants.ts`.

**Feature flag:** everything stays behind `VITE_APP_FEATURE_SUPABASE_SYNC`
(`featureFlags.ts:1-2`). When off: `getSupabaseClient()` returns null (`client.ts`), no engine is
constructed (`useSupabaseSync.ts:170-172`), `supabaseSync.viewModeEnabled` is `false`, no poll/heartbeat
timers run, `0002` is just dormant schema, and the app renders exactly as today. The reader banner /
takeover UI are all `isSupabaseSyncEnabled()`-gated in `App.tsx`.

---

## Open questions / risks for the implementer

1. **Skew-free reader liveness (RESOLVED by m5).** Decided: `read_lock_state` is a `SECURITY DEFINER`
   RPC that returns the DB-computed `lock_live` boolean (+ `server_now` for cosmetic presence text only).
   The client uses `lock_live` and **never** compares `lock_expires_at` to `Date.now()`. Implementer
   action: add a unit test that fakes a large +/- client clock skew and asserts the role decision is
   unaffected (it should be, since the verdict is server-side). The only residual choice is purely
   cosmetic: how to render "last heartbeat Ns ago" from `server_now` − `writer_heartbeat_at` (the RPC
   could also return `writer_heartbeat_at` if that label is wanted).
2. **`renew_board_lock` returning `still_writer=false` on a flaky network vs a real takeover.** A failed
   *RPC call* (network) must NOT demote (we keep role optimistically; lease decays server-side); only a
   *successful* RPC returning `still_writer=false` demotes. Make sure the engine distinguishes "RPC
   threw" from "RPC said you lost it." (§2.)
3. **ACK_GRACE vs LEASE_TTL tuning.** With HEARTBEAT=5s, POLL=4s, LEASE=25s, ACK_GRACE=12s: a *clean*
   handoff completes in ≈1 heartbeat + 1 poll (≤9s); a *crashed-writer* takeover in ≤25s (lease). If
   product wants faster crash-takeover, lower LEASE (e.g. 15s) but keep LEASE ≥ 2.5×HEARTBEAT to avoid
   false demotion on GC pauses. These are the only knobs; expose them as constants.
4. **Beforeunload release is best-effort.** `release_board_lock` on `beforeunload` may not complete
   (browser kills the request). The lease-expiry fallback covers it, but there's a ≤25s window where a
   freshly-closed writer still "holds" the lock and a reader must wait/timeout. Acceptable; document in
   UX copy ("the other session may take a few seconds to release").
5. **One-writer-per-user vs one-writer-per-board.** RPCs currently key on `user_id`. The §6.11 multi-board
   note must be honored if the unique index ever relaxes — don't hardcode `user_id` assumptions in the
   client beyond the RPC wrappers.
6. **Reader poll cost.** 4s polling per reader is a `select` on one indexed row — cheap, but N readers ×
   every 4s is steady DB load. Fine for this deployment's scale; revisit (longer interval / Realtime) if
   it ever grows. Out of scope now (decision #3 mandates polling).
7. **`takeover_requested_by` is a single slot.** If R1 requests then abandons (closes tab) before W acks,
   the column stays set and W still hands off into a free lock that nobody claims → the lock goes free
   and the *next* poller (incl. W as a reader) sees it free but won't auto-claim (decision #1). Net: the
   board ends writer-less until someone clicks Take over. Acceptable, but worth a test + maybe a
   "no active editor — Take over to edit" affordance for readers when `lockLive=false`.
