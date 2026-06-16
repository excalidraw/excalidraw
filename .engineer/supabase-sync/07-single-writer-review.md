# 07 — Single-Writer / Multi-Reader Design — Independent Concurrency Review

**Reviewer stance:** distributed-systems / concurrency, zero prior context. Ground-truthed against
`syncEngine.ts`, `boardRepository.ts`, `useSupabaseSync.ts`, `0001_init_boards.sql`,
`ephemeralAppState.ts`, and `packages/excalidraw/components/App.tsx` on branch `online-sync`
(2026-06-16). The locked product decisions are taken as given; only the *implementation* of them is judged.

## Verdict: **APPROVE-WITH-CHANGES**

The core lock mechanism (single conditional `UPDATE` in a `SECURITY DEFINER` RPC) **does** admit
exactly one writer — the row-lock + READ COMMITTED predicate re-evaluation is correct, and the
`acquired` derivation is sound. The handoff *ordering* (flush → release → claim → pull) is correct in
the happy path and **does** prevent the requester from landing an older scene. There are **no
blockers** in the atomicity of `claim_board_lock` or the happy-path handoff.

However there are **2 major correctness bugs** that can cause a *stuck writer-less board* or a
*lost-update window*, plus several minor/nit issues (including one false citation). None defeats the
"one writer" guarantee, but #M1 violates the "no lost edits" guarantee in a real race, and #M2 can
permanently wedge takeovers. Both are cheap to fix and must be fixed before implementation.

---

## Findings by severity

### BLOCKERS
None. (Specifically: `claim_board_lock` does NOT admit two writers — see Analysis #1 below.)

---

### MAJOR

#### M1 — Handoff can lose the writer's final flush if `flush()` no-ops or fails, yet `release` still runs unconditionally
**Location:** Design §4 steps 3–4; §3 transition "WRITER → READER (taken over)"; engine
`performHandoff()` (described §5, "flush → release → becomeReader").

The handoff sequence is `flush()` → `release_board_lock()` → demote. The design assumes step 3 always
commits the final scene to the cloud before step 4 frees the lock. But trace the real `flush()`
(`syncEngine.ts:372-395`) and `runPush()` (`:432-523`):

- `flush()` is a **no-op if `!this.dirty`** (`:373-375`). Fine if clean.
- `flush()` **returns without throwing on a push failure**: a file-upload error (`:452-461`,
  `:468-481`), a network error on the row write (`:499-504`), or a **version conflict** (`:507-511`,
  which calls `repullAndReconcile` and *applies the cloud over local*, dropping the local edits) all
  leave `runPush()` returning normally with `dirty` still `true` and the local edits **unpushed**.

If `performHandoff()` does `await flush(); await release()` and ignores flush's outcome, then on any
of those failure paths it will **release the lock with unsynced local edits still sitting in the
departing writer's tab**. The requester then claims the now-free lock, pulls version N (the writer's
edits were version N+1 that never landed), and the writer's final edits are **lost** — exactly the
failure the whole feature exists to prevent. Worse: the writer has demoted to reader, so its retry
path (`notifyChange`/`flush`) is now gated off (§3 reader-gate) — the edits can never be pushed.

This is a real lost-update window, not just theoretical: a takeover frequently happens *because* the
first writer's network got flaky (which is also why its flush would fail).

**Fix (required):** `performHandoff()` must treat the final flush as a **gate on release**:
1. Call `flush()` and then **check the engine actually reached a clean state** (`this.dirty === false`
   AND the last push succeeded). Expose a return value from `flush()`/`runPush()` (today they return
   `void`) — e.g. `flush(): Promise<boolean>` returning whether the scene is fully pushed.
2. **Only call `release_board_lock` if the flush confirmed `dirty === false`.** If the flush failed,
   do NOT release and do NOT demote — keep the lock, let the lease keep *not* renewing (so it
   eventually expires as the safety net), surface an error to the writer ("couldn't hand off — retrying"),
   and retry the flush on the next heartbeat tick. The requester's ACK_GRACE/lease-expiry path then
   becomes the fallback, and because the lock never freed cleanly the requester pulls only what
   actually committed. A *partially-flushed* board is strictly better than a *silently-truncated* one.
3. Also handle the version-conflict-during-final-flush case explicitly: if the departing writer hits a
   conflict (someone already advanced the version — e.g. the requester stole an expired lease and
   started writing), the writer must NOT clobber; `repullAndReconcile` is correct there, but it means
   the writer's in-flight edits are intentionally dropped — that's acceptable *only* in the
   lease-expiry/steal path, not in the graceful path. In the graceful path the requester has not yet
   claimed, so no conflict should occur; if one does, it's a bug-signal worth logging.

Without this, "graceful handoff = no lost edits" is not actually guaranteed.

#### M2 — `takeover_requested_by` can get stuck set forever → all future takeovers wedged
**Location:** Design §1 (`takeover_requested_by` column), §3, §4, Open-question #7. SQL: `renew_board_lock`
guard `and b.takeover_requested_by is null` (migration line ~213); `claim_board_lock` clears it on claim
(~169); `release_board_lock` clears it (~245).

`takeover_requested_by` is only ever cleared by (a) a successful `claim_board_lock`, or (b)
`release_board_lock`. Consider: writer **W** is alive and renewing. Reader **R** clicks Take over →
`takeover_requested_by = R`. Now:

- `renew_board_lock(W)` sees the flag and **deliberately stops renewing** (correct per §4 step 2), so
  W's lease begins to decay toward expiry.
- W is *supposed* to then run `performHandoff()` (flush → release). But suppose W's handoff path
  doesn't fire or fails (M1), **or** R abandons (closes its tab) immediately after requesting
  (Open-question #7), **or** W's tab is killed by the OS right after the renew that observed the flag
  but before it can flush/release.

In the "R abandoned, W survived" sub-case: W stopped renewing because the flag is set, but **nobody
will ever clear the flag** — R is gone (won't claim), and W's own `renew` is a no-op that *also won't
clear it* (renew only renews; it never resets `takeover_requested_by`). So W's lease expires, W
demotes to reader on the next `still_writer=false`... and now the board is free **with
`takeover_requested_by = R` still set**. The *next* genuine reader R2 clicks Take over →
`request_takeover` runs, but its WHERE requires `writer_id is not null and lock_expires_at > now()`
(migration ~278-279) — the lock is free, so `request_takeover` returns `immediately_claimable=true`
and R2 claims, which *does* clear the flag (`claim_board_lock` clears it). So in *that* exact path it
self-heals.

But the genuinely stuck case is: **W stops renewing (flag set) but its lease has NOT yet expired, and
W never completes the handoff** (M1 failure, or W frozen but lease still live for up to 25s). During
that up-to-25s window `renew_board_lock` keeps returning `still_writer=true, takeover=R` and refuses
to renew — fine. But there is no code path that ever **clears a stale `takeover_requested_by` when the
requester has gone away while the writer is still live**. The design's own Open-question #7 admits the
board "ends writer-less until someone clicks Take over," but misses that the *flag itself* is never
reset in the writer-survives-but-handoff-stalls path, which means: if W somehow regains the lease
(e.g. operator lowers ACK_GRACE, or a transient resolves and W's handoff *partially* runs), W will
keep seeing a takeover request that no longer has a live requester and keep refusing to renew —
oscillating.

**Fix (required), pick one (a is simplest):**
- **(a) Stamp-and-expire the request.** Make `renew_board_lock` (and `read_lock_state`) treat the
  request as *live* only if `takeover_requested_at > now() - ACK_GRACE` (or a dedicated
  `TAKEOVER_REQUEST_TTL`, say 2×ACK_GRACE). A request older than that is ignored (renew resumes
  renewing) AND cleared: add `set takeover_requested_by = null, takeover_requested_at = null` to the
  renew UPDATE when `takeover_requested_at < now() - interval`. This guarantees a stale request can
  never wedge renew for more than one TTL. **This is the cleanest fix and also bounds M2's blast radius.**
- **(b)** Have the requester `request_takeover` *also* be responsible for re-clearing on abandon — not
  possible if the tab is gone, so (a) is strictly better.

Net: today a stuck `takeover_requested_by` is a real "stuck state" the prompt explicitly asked to hunt
for. Add the TTL.

---

### MINOR

#### m1 — False citation: `viewModeEnabled` is NOT stripped by `stripEphemeral`
**Location:** Design §1 note (lines 301-304): *"`viewModeEnabled` is an ephemeral key already stripped
before persistence (`stripEphemeral` in `serializeScene`, `boardRepository.ts:42`)… confirmed
`serializeScene` strips it."*

Ground truth: `EPHEMERAL_APPSTATE_KEYS` (`ephemeralAppState.ts`) does **not** contain `viewModeEnabled`
(it contains `zenModeEnabled`, `objectsSnapModeEnabled`, etc., but not `viewModeEnabled`).
`grep -c viewModeEnabled ephemeralAppState.ts` = 0. The *conclusion* (a reader's `viewModeEnabled=true`
never lands in the cloud row) is nonetheless **correct**, but for a *different* reason: `viewModeEnabled`
is `{ browser: false, … }` in `APP_STATE_STORAGE_CONF` (`packages/excalidraw/appState.ts:243`), so
`clearAppStateForLocalStorage()` — which runs *before* `stripEphemeral` inside `serializeScene`
(`boardRepository.ts:42`) — already drops it. **Fix:** correct the rationale to cite
`clearAppStateForLocalStorage` / `browser:false`, not `stripEphemeral`. (No code impact, but the design
claims to be implemented "exactly," and an implementer who later edits the ephemeral list trusting this
note could be misled.)

#### m2 — Woken-zombie-writer push-before-poll window is real; mitigation relies on the version guard but the timing claim is optimistic
**Location:** Design §6.1 and §6.7; engine `becomeWriter`/heartbeat.

§6.7 correctly identifies that a writer woken from sleep may "push one stale frame before its renew
tells it `still_writer=false`," and relies on `pushBoard`'s version guard
(`boardRepository.ts:124 .eq("version", expected)`) to turn that into a `conflict` →
`repullAndReconcile` instead of a clobber. That reasoning is **sound** — the version guard does catch
it, because the new writer will have bumped `version` and the zombie's `expectedVersion` is stale, so
the guarded UPDATE matches 0 rows. **However:** the window is larger than the design implies. On wake,
the debounce timer (`SUPABASE_SYNC_DEBOUNCE_MS = 2000`) may fire and call `flush()` → `runPush()`
*before* the heartbeat's `renew_board_lock` returns `still_writer=false`. During that window the engine
still has `role==="writer"`, so the reader-gate doesn't stop it. It is caught by the version guard, so
**no clobber** — but it does mean a wasted push and a `conflict`→`repull` that briefly flips the UI to
`syncing`/`synced` on a tab that is about to demote. **Acceptable** (no data loss), but: (a) add an
explicit test for "woken writer pushes once, gets conflict, demotes, does not clobber"; (b) consider
having `becomeWriter`/the heartbeat **demote eagerly on the FIRST renew after a visibility-regain
event** (listen for `visibilitychange`→visible and force an immediate `renew_board_lock` before
allowing any queued flush). Keep the version guard as the real safety net regardless.

#### m3 — Reader's first claim at `start()` runs only *after* `pullBoard`; but `start()`'s first-insert path flushes BEFORE claiming — a reader can transiently INSERT/own the row
**Location:** Design §6.8 and §5 ("Lock claim on start … after the initial `pullBoard`"); engine
`start()` (`syncEngine.ts:261-321`).

§6.8 says on true first login `start()` INSERTs via `flush`/`pushBoard` first, *then* calls
`claim_board_lock`. That ordering is fine for the single-session bootstrap. But consider two brand-new
sessions of the same user (two tabs) opening simultaneously when **no row exists yet**: both call
`start()`, both `pullBoard` → null, both take the first-insert branch and call `flush()` →
`pushBoard(expectedVersion=null)` → `INSERT`. One INSERT wins; the other hits the unique-violation on
`boards_user_id_key` and (`runPush` `:495-497`) calls `repullAndReconcile`. Good — no error. **Then
both call `claim_board_lock`.** Because the row now exists with `writer_id=null`, the claim's WHERE
(`writer_id is null`) matches for **both** in sequence — but the row lock serializes them, so exactly
one gets `acquired=true`. So the *lock* outcome is still correct (one writer). The only wrinkle: the
INSERT itself is not lock-gated, so for a few milliseconds *both* tabs believe they are mid-bootstrap
and have pushed a scene; whichever INSERT lost just reconciles. This is benign **only because** the
first writer hasn't claimed yet and version is 1 for both attempts. **No fix required**, but the design
should state explicitly that "claim is strictly after row-existence AND the bootstrap INSERT is
allowed to race because it predates any lock" — and add a 2-tab-cold-start test.

#### m4 — `start()` does not (in the design) gate the bootstrap flush behind the claim, so a session that opens as a *reader* could still run the first-insert flush
**Location:** Design §5 (`start()`), §3 reader-gate.

The reader-gate is added to `notifyChange/flush/syncNow/runPush`. But `start()`'s first-insert branch
(`syncEngine.ts:271-286`) calls `flush()` directly *before* the role is decided (claim happens after
reconcile, per §5). If the role-decision later makes this session a **reader** (because another session
holds the lock), the bootstrap `flush()` has *already pushed* a scene as if it were a writer. In the
one-board-per-user model the row either exists (so the first-insert branch is skipped — pull returns
non-null) or it doesn't (so no other writer can exist yet). So in practice this branch only runs when
the row is absent, which implies no live writer, so the session will win the claim. **Therefore benign
today**, but it's an ordering smell: the safe construction is to **claim FIRST, then bootstrap-flush
only if `acquired`**, OR explicitly document that the first-insert branch is reachable only when no
writer can exist. Recommend: in `start()`, move `claim_board_lock` to run *before* the bootstrap flush
when `cloud === null`, and only INSERT if `acquired`. Otherwise the reader-gate's invariant ("a reader
never pushes") has a hole at startup that only the data model accidentally closes.

#### m5 — `read_lock_state` as a *plain client select* cannot return a trustworthy `server_now`; expiry must be computed inside an RPC or via the row's own timestamps
**Location:** Design §2 (reader poll), §5 (`readLockState` = "a plain `select` … (+ `server_now`)"),
§6.6, Open-question #1.

The design wisely insists every expiry comparison use the server clock, and proposes `read_lock_state`
return `server_now`. But it also says `read_lock_state` is "implemented as a plain select in the repo,
no RPC needed" and that the select can include `server_now`. A plain PostgREST select **cannot** select
`now()` as an arbitrary scalar alongside the row unless you expose a view/RPC; `client.from('boards')
.select('…')` can only return columns. You can `select` the row's `lock_expires_at` but you cannot get
`now()` in the same round-trip without either (a) an RPC, or (b) a generated/computed column, or (c) a
view that adds `now() as server_now`. The design's own preferred option ("have `read_lock_state` return
a `server_now` value … return a boolean `lock_live`") is therefore an **RPC**, contradicting the
"plain select" statement. **Fix:** make `read_lock_state` a `SECURITY DEFINER` RPC (like the others)
that returns `… , now() as server_now, (writer_id is not null and lock_expires_at > now()) as lock_live,
(takeover_requested_by is not null) as takeover_pending`. Do the liveness comparison **server-side** and
return booleans; never ship `lock_expires_at` to the client for comparison against `Date.now()`. This
also kills the brittle "measure skew offset" alternative. Cheap, and removes the only remaining
client-clock hazard. (Open-question #1 should be closed as "(a), via RPC.")

#### m6 — `request_takeover` against an expired-but-not-cleared lease returns `immediately_claimable=true` but the *role decision* may still show `held_by_other` for one poll, confusing the UI
**Location:** Design §2 role-decision block; §4 step "Writer already gone/crashed".

`request_takeover` computes `immediately_claimable = (writer_id is null or lock_expires_at <= now())`.
Good. But the reader's *poll-derived* role uses the same expiry, and between the `request_takeover`
response and the next poll the UI state (`takeoverInFlight=true`) plus a stale `held_by_other` could
flicker. Minor UX only; ensure `takeOver()` immediately attempts `claim_board_lock` when
`immediately_claimable` rather than waiting a full poll interval (the design says "claim on its very
next tick" — make that an *immediate* claim, not a 4s-delayed one, to avoid a visible stall).

### NITS

- **n1 — Lease/heartbeat margins are safe.** HEARTBEAT=5s, TTL=25s ⇒ 5× margin; survives 4 consecutive
  missed beats. POLL=4s < TTL. ACK_GRACE=12s > HEARTBEAT+POLL (9s). Margins are conservative and
  correct. No change. (Confirms prompt check #2 margins.)
- **n2 — `claim_board_lock` re-affirm branch (`writer_session_id = p_session_id`) correctly makes
  claim idempotent**, so a writer re-calling claim renews rather than races itself. Good. But note the
  default `p_lease_seconds=25` is duplicated in three RPC signatures and again as a client constant
  (`SUPABASE_LOCK_LEASE_SECONDS`). The design says SQL is "single source of truth" yet passes the value
  from the client. Pick one: either don't pass it from the client (let the SQL default win) or assert
  in a test that the client constant equals the SQL default. Drift here silently changes safety margins.
- **n3 — `release_board_lock` and `renew_board_lock` correctly self-guard with
  `writer_session_id = p_session_id`**, so a departed writer can never step on the new writer. Good.
  `release` is idempotent. Good.
- **n4 — RLS vs `SECURITY DEFINER`:** see Analysis #3 — the design's claim that "RLS still applies
  inside these functions" is **technically false** (definer bypasses RLS), but the functions
  *manually* re-impose ownership via `where b.user_id = auth.uid()`, which is the correct mitigation.
  Reword the migration comment (it currently implies RLS protects the function body; it does not — the
  `user_id = auth.uid()` filter does). Functionally safe; comment is misleading.
- **n5 — `App.tsx` insertion point** for `viewModeEnabled`: `<Excalidraw` opens at `App.tsx:960`,
  `onChange` at `:961`, `theme={editorTheme}` at `:1003`. Inserting `viewModeEnabled={…}` as a sibling
  prop near `theme` is valid. Verified. `renderTopRightUI` is at `:1005` and `SyncStatusButton` render
  at `:1015-1024` (design says 1017-1024 — close enough). Citations are accurate.
- **n6 — `viewModeEnabled` IS a controlled prop.** Verified at `App.tsx:2800-2801` (prop overrides
  action result) and `:3492-3493` (`componentDidUpdate` re-applies on prop change), plus enforcement
  at `:5045,5049,5067,5112,7459,8135,8201,12701`. A reader genuinely cannot draw. Confirms prompt
  check #6. One caveat (m7 below).
- **n7 — entering reader mode mid-edit:** `componentDidUpdate`'s `prevState.viewModeEnabled !==
  this.state.viewModeEnabled` branch calls `deselectElements()` (`App.tsx:3498`), which clears
  selection but does NOT roll back an in-progress multi-point draw or a committed-but-unsynced edit.
  Those local edits remain in the scene. For a *demoting writer* that's exactly what we want (they get
  flushed by the handoff). For a *reader who briefly edited before the prop applied* there is no commit
  to the cloud (gate + viewMode), so it's discarded on the next `applyCloud`. Acceptable; add a test.

---

## Detailed analysis of the two load-bearing questions

### Analysis #1 — Does `claim_board_lock` admit exactly one writer? **YES.**
The single `UPDATE … WHERE (writer_id is null OR lock_expires_at < now() OR writer_session_id = mine)`
acquires a **row-level write lock** on the one board row. Under Postgres READ COMMITTED, a second
concurrent `UPDATE` that blocks on that lock will, when unblocked, **re-fetch the latest committed row
version and re-evaluate the WHERE predicate against it** (EvalPlanQual). After claimant A commits
(`writer_id=A`, `lock_expires_at=now()+25s`), claimant B's predicate evaluates against
`writer_id=A` (not null), not expired, `writer_session_id=A ≠ B` ⇒ **false ⇒ 0 rows updated**. The
subsequent non-locking `return query` SELECT reads the committed row; A sees `writer_session_id=A ⇒
acquired=true`, B sees `≠ ⇒ acquired=false`. There is **no read-then-write TOCTOU** because the read
that decides `acquired` happens *after* the serialized write, within the same autocommit transaction.
The two-readers-claim-a-freed-lock case (§4) reduces to the identical argument. **The lock is correct.**
(One precise wording fix for the design: it says the row lock makes the *claims* serialize — true; but
it should note the `acquired` correctness depends on the SELECT running after the UPDATE in the same
txn, which it does.)

Caveat that does NOT break it: if Postgres ran these at REPEATABLE READ/SERIALIZABLE, the blocked
second UPDATE would instead raise a serialization failure rather than re-evaluate — still safe (the
loser errors out → `acquired` effectively false), but the RPC would surface an error. Supabase/PostgREST
runs each RPC in **READ COMMITTED** by default, so the re-evaluation path applies. Worth a one-line
comment pinning the assumption, and a test that fires N concurrent claims and asserts exactly one
`acquired=true`.

### Analysis #2 — Does the handoff guarantee no lost writer edits? **ONLY AFTER FIX M1.**
Happy path ordering is correct: step 3 `flush()` bumps version N→N+1 and commits *before* step 4
`release` frees the lock; the requester polls free only *after* release, claims, sees claim-returned
`version=N+1 > localMeta`, and `applyCloud` pulls the flushed scene (§4 step 8). So a requester **cannot**
land an older scene **provided step 3 actually committed**. The hole is M1: `flush()` can return
without having pushed (no-op when not dirty is fine; but **silent failure** on network/file/conflict is
not), and the design releases unconditionally afterward. Fix M1 (gate release on a confirmed-clean
flush) and the guarantee holds. The crash/lease-expiry variant is safe *by construction* because the
lock never frees cleanly — the requester only steals an **expired** lease and then pulls whatever
actually committed (the version guard prevents the zombie from later clobbering). So: **with M1 fixed,
no lost writer edits; without it, a flush failure during graceful handoff loses the final edits.**

### Analysis #3 — RLS / `SECURITY DEFINER` security. **Safe, but for the reason the design half-states.**
`SECURITY DEFINER` runs the function body as the *owner* (typically a superuser-ish role on Supabase),
which **bypasses RLS** on `public.boards`. The design's migration comment claims "RLS on boards still
applies inside these functions" — that is **incorrect**. What actually protects ownership is that every
RPC filters `where b.user_id = auth.uid()` (and reads `auth.uid()` fresh inside the function). Because
`auth.uid()` is the JWT's subject and cannot be spoofed by a client, a malicious client can only
claim/renew/release/request-takeover **its own** board row — it cannot touch another user's lock. So
the **security outcome is correct**, but the *stated reason* is wrong and should be fixed in the
comment (n4). Also confirm the functions are owned by a role that the `authenticated` role cannot
redefine, and that `search_path = public` is set (it is, on all four) to prevent search-path injection
— good. No field is client-writable directly that shouldn't be: clients never `UPDATE boards` for lock
columns via PostgREST (only via these RPCs); the existing `boards_update_own` policy *would* let a
client `UPDATE` lock columns directly through PostgREST (RLS only checks `auth.uid()=user_id`, not
*which* columns) — **see m8 below.**

#### m8 (MINOR, security) — RLS lets a client write lock columns directly via PostgREST, bypassing the RPCs
**Location:** `0001` `boards_update_own` policy; `0002` adds lock columns to the same table.
Because the lock columns live on `boards` and `boards_update_own` permits any column update where
`auth.uid()=user_id`, a malicious *but authenticated* user could `supabase.from('boards').update({
writer_session_id: 'whatever', lock_expires_at: <far future> })` on **their own** row, bypassing
`claim_board_lock`'s logic. They can only do this to **their own** board (RLS still scopes to their
row), so they can only grief *their own* other tabs — not another user. **Severity: minor** (self-grief
only, single-tenant-per-board model). But it violates "lock state is only mutated through the RPCs." If
you want the invariant airtight, add a column-level guard: either (a) a `BEFORE UPDATE` trigger that
rejects changes to the lock columns unless `current_setting('app.via_rpc', true)` is set (RPCs set it),
or (b) move lock columns to a separate table with no direct-write policy (the design rejected this for
good reasons). Given the threat is self-only, **(a) is optional hardening, not a blocker** — but
document the residual ("a user can corrupt their own lock via direct PostgREST writes; cross-user is
impossible").

---

## Migration safety (#8)
- `0002` uses `add column if not exists` for all six columns → **idempotent**; re-runnable.
- All new columns are `null` with no `NOT NULL`/default → **non-breaking** to existing rows (existing
  rows get `NULL` lock state = "free", which is exactly right; the first `claim` will populate them).
- `writer_id … references auth.users(id) on delete set null` is correct (deleting the user nulls the
  writer pointer rather than blocking).
- `create or replace function` for all four RPCs → idempotent. `grant execute … to authenticated` for
  each → matches `0001`'s grant model. **No grant to `anon`** — correct.
- **One real gap:** there is **no `0002` file on disk** yet (`supabase/migrations/` contains only
  `0001_init_boards.sql`) — expected (design-only), just confirming the implementer must author it.
- Signatures: `claim_board_lock(text, integer)`, `renew_board_lock(text, integer)`,
  `release_board_lock(text)`, `request_takeover(text)` — all granted. **Missing:** `read_lock_state`
  must also be created+granted as an RPC (per m5) — the design lists it as a "plain select" so it has
  no migration entry; add it.
- `make_interval(secs => p_lease_seconds)` is valid PG ≥ 9.4. Fine.
- Returning `setof`/`returns table` from these and selecting `from public.boards b where user_id =
  v_uid` after a 0-row update is valid (it just reads current state). Fine.

---

## Reader-gate completeness (#5)
The four-point gate (`notifyChange`/`flush`/`syncNow`/`runPush`, all first-line
`if (role==="reader") return;`) covers every push entry I can find in `syncEngine.ts`. The on-unload
flush (`useSupabaseSync.ts:217-238`) calls `engineRef.current?.flush()`, which is gated — so a reader's
beforeunload flush is a no-op. ✔. The **one hole** is `start()`'s bootstrap flush (m4) and the
**handoff final flush must bypass the gate** — the design handles the latter correctly by ordering
(flush runs while still `role==="writer"`, demote only after). With m4 addressed, the gate is complete.
A reader's `onChange` can fire (e.g. selection cleared by `deselectElements`), but `notifyChange`
returns immediately for readers and, even if it didn't, `serializeScene` strips selection so the
snapshot wouldn't change — double-safe. ✔.

---

## Is it safe to implement?
**Yes, after M1, M2, and m5 are fixed** (and the m1/n4 comment corrections, which are doc-accuracy).
The lock's one-writer guarantee is solid and needs no change. The remaining risk is concentrated in two
spots the prompt correctly flagged: the handoff's final-flush failure mode (M1 — fix: gate release on a
confirmed-clean flush) and a stuck `takeover_requested_by` (M2 — fix: TTL the request inside
`renew`/`read_lock_state`). m5 (make `read_lock_state` an RPC returning server-side `lock_live`) closes
the last client-clock hazard. None of these is architectural; all are localized. Recommend
**APPROVE-WITH-CHANGES**: implement, but land M1/M2/m5 in the same PR and add the named tests
(N-concurrent-claims, 2-tab-cold-start, woken-zombie-no-clobber, handoff-flush-failure-no-release,
abandoned-takeover-request-self-heals, clock-skew-role-correctness).
