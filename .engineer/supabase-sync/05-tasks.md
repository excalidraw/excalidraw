# 05 — Task Breakdown

Decomposed from `04-lld.md` (+ `04-lld-part1-data.md`, `04-lld-part2-ui-tests.md`, and the **NORMATIVE
Engine ↔ Hook contract** section in `04-lld.md`). Each task is sized for one sub-agent context (≤~5 files).
All sync/disable behavior is gated by `isSupabaseSyncEnabled()` so flag-off keeps current behavior.

## Dependency graph (topological)

```
T01 (config/foundation) ──┬─> T03 (repo+ephemeral) ──┐
                          ├─> T04 (supabaseFiles) ────┤
                          └─> T05 (atoms+auth) ───────┼─> T06 (syncEngine) ─> T07 (hook) ─┐
T02 (SQL migration + .env.example)  [independent]     │                                   ├─> T09 (App wiring) ─> T10 (disable) ─> T11 (disable/integration tests)
                                                      └─> T08 (SyncStatusButton + SignInDialog, presentational) ┘
```

Notes:
- **T02** is fully independent (SQL/docs) — may run anytime in parallel.
- **T03, T04, T05** are parallelizable after T01 (disjoint files).
- **T08** (presentational UI) depends only on T05's auth + the prop shapes; can run in parallel with T06/T07.
- **T09, T10** both edit `App.tsx` → **serialize** them (T09 then T10) to avoid conflicts.
- **Shared-file ownership (collision rule, LLD §12):** `app_constants.ts` and `excalidraw-app/package.json` are
  edited ONLY by **T01**. `App.tsx` sync-wiring is **T09**; `App.tsx` disable-edits are **T10**.

## Task list

| ID | Title | Files (primary) | Depends on | Parallel-safe with |
|----|-------|-----------------|------------|--------------------|
| T01 | Config & foundation (deps, env typings, constants, flag, client) | package.json, vite-env.d.ts, app_constants.ts, data/supabase/{featureFlags,client}.ts | — | T02 |
| T02 | SQL migration + .env.example + setup README | supabase/migrations/0001_init_boards.sql, .env.example, supabase/README (or docs) | — | all |
| T03 | Ephemeral keys + board repository + test | data/supabase/{ephemeralAppState,boardRepository}.ts, tests/supabase/boardRepository.test.ts | T01 | T04,T05 |
| T04 | Supabase file adapter (Storage) + test | data/supabase/supabaseFiles.ts, tests/supabase/supabaseFiles.test.ts | T01 | T03,T05 |
| T05 | Status atom + session atom + auth wrappers | data/supabase/{syncStatusAtom,sessionAtom,auth}.ts | T01 | T03,T04 |
| T06 | Sync engine + test | data/supabase/syncEngine.ts, tests/supabase/syncEngine.test.ts | T03,T04,T05 | T08 |
| T07 | useSupabaseSync hook (+applyRemoteScene) + test | data/supabase/useSupabaseSync.ts, tests/supabase/useSupabaseSync.test.tsx | T06 | T08 |
| T08 | SyncStatusButton (+scss) + SignInDialog (presentational) | components/{SyncStatusButton.tsx,SyncStatusButton.scss,SignInDialog.tsx} | T05 | T06,T07 |
| T09 | App.tsx sync wiring (FileManager, hook mount, onChange notify, renderTopRightUI B1, initial data) | excalidraw-app/App.tsx | T07,T08 | — |
| T10 | Disable collab+share (flag-gated) + menu auth/Sync-now items | App.tsx, data/index.ts, components/AppMainMenu.tsx, components/AppWelcomeScreen.tsx | T09 | — |
| T11 | Disable-verification + integration tests | tests/supabase/disable.test.tsx (+ any hook/integration assertions) | T10 | — |

## Global verification (run after each task + in REGRESSION)
- `yarn test:typecheck` — must stay green.
- `yarn vitest run <new test file>` — the task's own tests.
- Per-task `verify` command is in each `tasks/Txx.md`.
- Full regression at the end: `yarn vitest run` (baseline = 1403 passed, 0 failed), `yarn test:code` (lint).

## Definition of done for IMPLEMENTATION phase
All tasks `done` (or `blocked` with reason); typecheck green; each new test passing; no test-weakening.
