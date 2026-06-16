# 09 — Single-Writer / Multi-Reader Retrospective

**Outcome: ✅ Complete.** Exactly-one-writer-per-board with read-only followers, graceful takeover, and
hard read-only enforcement. All 5 tasks (W01–W05) done, 0 blocked. Full regression green.

## What was built (vs the locked decisions)
- **Explicit Take-over, readers by default:** a fresh session with no live writer auto-becomes writer;
  any other session opens **read-only** and shows a "Take over editing" button. ✓
- **Graceful handoff:** reader requests → current writer (on next heartbeat) **flushes its final edits,
  then releases** → requester pulls the flushed scene and becomes writer. Release happens **only if the
  flush succeeds** (M1), so no edits are lost; a failed flush keeps the writer and retries. ✓
- **Polling (no Realtime):** readers poll `read_lock_state` every 4s; liveness is computed **server-side**
  (`lock_live`), never from a client clock (m5). ✓
- **Hard read-only:** `viewModeEnabled` on `<Excalidraw>` + a top-center banner + a muted "Read-only"
  status pill. ✓

## Architecture
- **DB (`0002_board_locks.sql`):** lock columns on `boards` + 5 `SECURITY DEFINER` RPCs
  (`claim/renew/release_board_lock`, `request_takeover`, `read_lock_state`), each with a
  `user_id = auth.uid()` ownership filter; atomic claim = one conditional UPDATE; `REQUEST_TTL` self-heal.
- **boardRepository:** typed wrappers for the 5 RPCs.
- **syncEngine:** writer/reader role; claim-on-start; 5s heartbeat (`renewLock`); reader-gate on every
  write path; `flush()`/`runPush()` return `Promise<boolean>` (flush-success contract); handoff;
  release on stop/dispose. Lease 25s.
- **lockAtom + useSupabaseSync:** per-tab `session_id` in `sessionStorage`; reader poll (4s) → pull on
  version bump; `viewModeEnabled` + `role` derivation; `takeOver()` action; minimal engine seam
  (`getRole`/`getLocalVersion`/`pullLatest`/`tryClaim`/`takeOver`).
- **UI:** `SyncStatusButton` reader/writer states + Take-over; `ReadOnlyBanner`; App.tsx wiring.
- All behind `VITE_APP_FEATURE_SUPABASE_SYNC`.

## Process notes
- Design was independently reviewed before any code (07-review): confirmed **exactly one writer**
  (Postgres row-lock + EvalPlanQual under READ COMMITTED — no TOCTOU) and caught **2 handoff bugs**
  (M1 lost-edits-on-failed-flush, M2 stuck takeover request) + 1 client-clock hazard (m5), all fixed in
  the design before implementation. Result: implementation found **zero** new bugs.
- Each task: implementer → independent re-verify (incl. applying the migration to a real local Postgres
  and smoke-testing columns/RPCs/grants) → diff-check → commit.

## Verification
- `yarn test:typecheck` PASS · `yarn vitest run` **1473 passed / 111 files / 0 failed** (baseline 1434 →
  +39 single-writer tests, 0 regressions) · `yarn test:code` exit 0.
- New tests: boardLock (15), syncEngine (+10 → 22), useSupabaseSync (+5 → 8), singleWriter (8).
- Supabase client mocked; lock SQL validated against a local Podman Supabase stack (not unit-mocked).

## Open / human action
- **Validate the handoff live** across two tabs/devices: open board in tab A (writer) → open in tab B
  (read-only banner + Take over) → click Take over in B → A flushes + goes read-only, B becomes writer
  with A's latest. Also test crash recovery (close A's tab → B can take over after the ~25s lease).
- Local magic-link emails are captured in Mailpit (http://localhost:54324), not actually sent.

## Follow-ups (not in scope)
- Realtime instead of polling (sub-second reader updates + live presence).
- Multiple named boards (lock model already keyed per board row; extends cleanly).
- Surfacing the writer's identity/email in the reader banner (currently "another session").
