# 08 — Single-Writer / Multi-Reader Task Breakdown

Decomposed from `07-single-writer-design.md` (reviewed; M1/M2/m5 fixes applied). All gated by
`VITE_APP_FEATURE_SUPABASE_SYNC`. Tasks are largely sequential (each builds on the prior).

## Dependency graph
```
W01 (migration 0002 + RPCs + boardRepository lock fns + tests)
      │
      ▼
W02 (engine: sessionId, heartbeat, claim-on-start, reader-gate, handoff, release + tests)
      │
      ▼
W03 (lockAtom + hook: poll loop, role, viewModeEnabled, takeOver() + tests)
      │
      ▼
W04 (UI: SyncStatusButton reader/writer + Take-over; read-only banner; App.tsx viewMode wiring)
      │
      ▼
W05 (integration/verification tests + full regression)
```

## Tasks
| ID | Title | Primary files | Depends on |
|----|-------|---------------|------------|
| W01 | Lock migration + RPCs + repository fns | supabase/migrations/0002_board_locks.sql, data/supabase/boardRepository.ts, tests/supabase/boardLock.test.ts | — |
| W02 | Engine: heartbeat, claim, reader-gate, handoff | data/supabase/syncEngine.ts (+ SyncEngineDeps), tests/supabase/syncEngine.test.ts | W01 |
| W03 | lockAtom + hook poll/role/viewMode/takeOver | data/supabase/lockAtom.ts, data/supabase/useSupabaseSync.ts, tests/supabase/useSupabaseSync.test.tsx | W02 |
| W04 | UI: reader/writer button states, Take-over, banner, App viewMode | components/SyncStatusButton.tsx(+scss), components/ReadOnlyBanner.tsx(+scss), App.tsx | W03 |
| W05 | Verification tests + full regression | tests/supabase/singleWriter.test.tsx | W04 |

## Verification (each task)
- `yarn test:typecheck`, the task's own `yarn vitest run <file>`, `yarn eslint <changed files>`.
- W05 + final: full `yarn vitest run` (no NEW failures vs current 1434) + `yarn test:code`.

## Key correctness invariants (from the review — must hold)
- Exactly one writer: lock claim is the single conditional UPDATE inside `claim_board_lock` RPC.
- No lost edits on handoff: writer releases ONLY after `flush()` returns `true` (M1).
- No stuck takeover: `takeover_requested_by` self-heals via REQUEST_TTL in renew/read_lock_state (M2).
- No client clocks: all liveness via server `now()` / `lock_live` from `read_lock_state` (m5).
- Reader never writes: gate at the top of notifyChange/flush/syncNow/runPush + no unload flush as reader.
