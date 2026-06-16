# RETRO — supabase-sync

**Outcome: ✅ Complete.** Supabase-backed per-user whiteboard sync shipped behind a feature flag; live
collaboration and shareable links are disabled (hidden, code dormant) when the flag is on. All 11 tasks done,
0 blocked. Full regression green.

## What was built vs. planned
Delivered exactly the approved scope:
- **Auth:** Supabase Auth via email magic link (`signInWithMagicLink`); session/user as jotai atoms; per-user
  isolation by RLS.
- **Sync:** auto debounced background push on change (files-first, then version-guarded `boards` upsert) +
  manual "Sync now"; pull + LWW reconcile on login; status surfaced in a top-right `SyncStatusButton`
  (synced / syncing / error / offline).
- **Files:** images sync via a private `scene-files` Supabase Storage bucket at `{user_id}/{fileId}`, RLS-isolated,
  through a composed `FileManager`.
- **Disable collab + share:** flag-gated hiding of triggers + `#room=`/`#json=`/`#url=` URL handling; `<Collab>`,
  `<ShareDialog>`, firebase, socket.io all kept dormant (not deleted) — flag off restores today's app exactly.
- **Schema/docs:** migration (`boards` + RLS + bucket + policies), `.env.example`, `supabase/README.md`, `06-docs.md`.
- **UI mockup** (added on request) is in `03-hld.md §2.5`.

Scope changes from the plan: none material. The planned `AppWelcomeScreen.tsx` component edit turned out
unnecessary — hiding the collab CTA was achievable purely via the existing `isCollabEnabled` prop at the App.tsx
call site, so no component change shipped (documented in `06-docs.md`).

## Deviations & why (all documented in task files)
1. **`boards` first-insert writes `version: 1`** (LLD pseudocode said 0). Engine first-push uses `expectedVersion=null`
   and stores the returned version. Consistent end to end.
2. **`pushBoard` insert errors throw** (no 23505→conflict mapping in the repo); the engine wraps the first insert and
   treats a uniqueness/race throw as a repull-and-reconcile. Net behavior correct.
3. **`SyncEngine` is framework-free**; applying a pulled scene is injected as `applyRemoteScene(row)` implemented by
   the `useSupabaseSync` hook (clean data↔UI seam; engine stays unit-testable, never imports `excalidrawAPI`/collab).
4. **`as const satisfies` avoided** — the repo's pinned prettier 2.6.2 eslint parser rejects it. Used `as const` +
   a separate type assertion for the same compile-time guarantee.
5. **Menu icons** reused existing exports (`playerPlayIcon`/`usersIcon`/`loginIcon`) since the LLD's icon names
   didn't exist.

## Self-correction summary (1 bug, fixed)
- **TESTING caught a release-blocking bug:** with the flag on, the app hung on the loading spinner forever. The
  scene-init effect early-returned when `collabAPI` was null, and the flag unmounts `<Collab>` (so `collabAPI` is
  always null). The T11 agent found it while writing the full-app render test and correctly refused to patch
  production to hide it — it flagged it instead.
- **Fix:** scene-init guard now also checks `!isSupabaseSyncEnabled()`, so under the flag the effect proceeds to
  `initializeScene` (which already treats flag-on as "no external scene"). Proven by a full-app render test that
  asserts the spinner clears (`isLoading === false`). One correction cycle; no other failures.
- The HLD review cycles (2 blockers + 5 majors on HLD, 2 blockers + 3 majors on the split LLD) caught all the other
  contract/seam issues *before* implementation — which is why implementation itself had only this one integration bug.

## Verification (final)
- `yarn test:typecheck` → PASS.
- `yarn vitest run` → **1434 passed / 109 files / 0 failed** (baseline 1403/104 → +31 new tests, 0 regressions).
- `yarn test:code` (lint, `--max-warnings=0`) → exit 0.
- 31 new tests across 5 files in `excalidraw-app/tests/supabase/`. Supabase client mocked; no live integration tests.

## Blocked / open items
**None blocked.** Items requiring the human (expected, by design):
- **Provision Supabase + validate end-to-end.** Run `supabase/migrations/0001_init_boards.sql`, confirm the
  `scene-files` bucket, enable Email (magic-link) auth, set the 3 `VITE_APP_SUPABASE_*` vars, then build with
  `VITE_APP_FEATURE_SUPABASE_SYNC=true` and verify real sync across devices. (No automated live test exists.)

## Suggested follow-ups (future work, out of current scope)
- **Multiple named boards** — schema already has `name`; relax `unique(user_id)` + add a board selector UI.
- **Realtime / concurrent editing** via Supabase Realtime (current model is LWW, single active session).
- **Orphaned-file GC** in Storage (deleting images doesn't remove the uploaded object).
- **Large-document handling** — currently a soft size threshold/log; consider storing the document blob in Storage
  past a limit.
- **OAuth providers** in addition to magic link (a documented config point).
- Optional: an end-to-end test against a local `supabase start` stack (deferred — needs Docker).

## Where everything lives
- Production code: `excalidraw-app/data/supabase/*`, `excalidraw-app/components/{SyncStatusButton,SignInDialog}.tsx`,
  edits in `App.tsx`, `components/AppMainMenu.tsx`, `data/index.ts`, `vite-env.d.ts`, `app_constants.ts`, `package.json`.
- DB/infra: `supabase/migrations/0001_init_boards.sql`, `supabase/README.md`, `excalidraw-app/.env.example`.
- Tests: `excalidraw-app/tests/supabase/*`.
- Design/process docs: `.engineer/supabase-sync/` (01-requirements → 06-docs, test-report, RETRO, JOURNAL, state.json, tasks/).
- Commits: 8 `engineer(supabase-sync): …` commits on branch `online-sync`.
