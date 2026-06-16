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
