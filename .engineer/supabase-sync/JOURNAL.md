# Engineering Journal — supabase-sync

## [2026-06-15 00:00] phase=init action=setup
- Created `.engineer/supabase-sync/` workspace.
- Requirement: add Supabase-backed sync for the whiteboard; disable live collaboration and shareable-link features.
- Setup answers (AskUserQuestion, verbatim):
  - Autonomy = **Supervised** (gates after Requirements & HLD).
  - Auth model = **Supabase Auth (login)** — boards owned by user_id, RLS-protected.
  - Sync model = **"auto sync and manual button for sync as well."**
- Captured baseline (agent): typecheck PASS (0 err), tests PASS (104 files / 1403 passed, 48 skipped, 0 failed; `yarn vitest run`), lint PASS (`yarn test:code`). Node v21.7.3, yarn 1.22.22. See baseline.md.
- Explored collab/share/persistence (agent); findings in exploration-collab-share.md. Key: Collab is a class component using socket.io+Firebase; share links via `exportToBackend`/`importFromBackend` (Firebase + BACKEND_V2); local persistence via `LocalData` (localStorage for elements/appState, IndexedDB for binary files), save debounced 300ms on onChange. Main hot path: App.tsx onChange (~683 syncElements, ~689 LocalData.save).
- Decision: proceed to REQUIREMENTS. Why: setup complete, baseline green, scope understood.

## [2026-06-15 00:00] phase=requirements action=start
- Drafting 01-requirements.md and clarifying questions (max 4, supervised mode).

## [2026-06-15 00:05] phase=requirements action=write+gate
- Round-2 Q&A answered (verbatim in 01-requirements.md): files=Supabase Storage; removal=hide UI keep code; deployment=new self-hosted app (no legacy migration); supabase=stakeholder-provided hosted project (no live integration tests, mock in unit tests).
- Wrote 01-requirements.md (goals, DoD, non-goals, constraints, assumptions A1-A5).
- phase_status=done. Presenting requirements GATE to human for approval. Why: supervised mode requires approval before scoping/design.

## [2026-06-15 00:10] phase=scoping action=gate-approved
- Human approved requirements gate (verbatim: "approve"). Set gates.requirements=approved.
- Decision: proceed to SCOPING. Spawning Explore agent to pin exact affected files/line ranges (already have a map from INIT; now confirming precise edit sites for collab/share disable + sync insertion points + env config files).

## [2026-06-15 00:20] phase=scoping action=write
- Scope Explore agent confirmed exact edit sites; wrote exploration-scope.md (579 lines). Key confirmations: FileManager constructor shape {getFiles(ids)→{loadedFiles,erroredFiles}, saveFiles({addedFiles})→{savedFiles,erroredFiles}}; ImportMetaEnv at vite-env.d.ts ~4-49; vite loadEnv(mode,"../"); no supabase dep yet; tests mock via module-level vi.mock (firebase/collab pattern) — reuse for supabase.
- Wrote 02-scope.md (in/out scope, SC1-SC7 measurable criteria, affected areas, R1-R6 risks).
- phase_status(scoping)=done → phase=hld. Spawning designer agent for 03-hld.md, then independent reviewer.

## [2026-06-15 00:35] phase=hld action=design+review
- Designer agent wrote 03-hld.md (9 sections, ASCII diagram, file:line anchors). Modules under data/supabase/: client, featureFlags, auth, sessionAtom, boardRepository, SupabaseFileManager, syncEngine, useSupabaseSync hook + SyncStatusButton UI + migrations. boards schema: id,user_id,name,document jsonb,app_state jsonb,version,created_at,updated_at, unique(user_id). Orchestration = SyncEngine class wrapped by useSupabaseSync hook. LWW reconciliation.
- Independent reviewer verdict: APPROVE-WITH-CHANGES — 2 blockers, 5 majors. Review in 03-hld-review.md.
  - B1: renderTopRightUI returns null when collabAPI null (App.tsx:956); unmounting <Collab> means collabAPI never set → SyncStatusButton can never render. Must restructure early-return.
  - B2: FileManager is used by COMPOSITION (new FileManager({...}), Collab.tsx:152), not subclassing; saveFiles({elements,files}) public vs injected _saveFiles({addedFiles}); errored-map value types differ.
  - M1: LWW mixing DB-clock updated_at vs client-clock element updated → drive off engine-owned version + dirty flag.
  - M2: reconciliation ignores file completeness; post-pull must run addFiles + updateStaleImageStatuses (App.tsx:500-508).
  - M3: pushing full browser appState subset → pan/zoom/selection trigger upserts; strip ephemeral keys + dirty check.
  - M4: engine writing isOfflineAtom recouples disabled collab module (isOfflineAtom in collab/Collab.tsx:100); move atom or use syncStatusAtom='offline'.
  - M5: files-then-row ordering can strand image refs (FileManager won't auto-retry, FileManager.ts:107); specify abort-on-errored-files / re-upload.
  - Security: RLS intent correct, anon key fine, NO service-role key in client (verified).
- USER REQUEST (mid-flight): "also add a approx image on how would it look in ui" → add an ASCII UI mockup to the HLD.
- Decision: ONE revision cycle (protocol allows up to 2). Spawning fresh designer to fix B1,B2,M1-M5 and add UI mockup, then re-review the deltas. Why: findings are concrete contract/correctness fixes, not a redesign.

## [2026-06-15 00:55] phase=hld action=revise+rereview
- Fresh designer revised 03-hld.md: B1 (renderTopRightUI evaluates flag before !collabAPI guard; SyncStatusButton renders independent of collabAPI), B2 (FileManager by composition new FileManager({getFiles,saveFiles,onFileStatusChange}); correct errored-map types _getFiles→Map<FileId,true>, _saveFiles→Map<FileId,BinaryFileData>), M1 (LWW off engine-owned monotonic version + dirty flag, 5-row decision table; updated_at display/tiebreak only), M2 (post-pull getFiles→addFiles→updateStaleImageStatuses, files union/append-only), M3 (15-key ephemeral blacklist verified vs appState.ts), M4 (no isOfflineAtom write; syncStatusAtom='offline'), M5 (files-first; on file error no version bump/stays dirty/error; FileManager.reset() for no-retry). Added §2.5 UI Mockup (status button states, MainMenu auth+Sync now, magic-link prompt).
- Independent RE-review (fresh agent) verdict: APPROVE-WITH-CHANGES; all of B1,B2,M1-M5,UI = RESOLVED (verified vs real code), no new blocker/major. 2 minor LLD follow-ups recorded in state.lld_followups: (1) activeTool/zenMode/objectsSnap/penMode browser:true but not blacklisted — decide; (2) pin isInitializedImageElement reduce for fileIds.
- phase_status(hld)=done. Presenting HLD GATE to human (with UI mockup, per user request). Why: supervised mode + 1 revision cycle done, design verified.

## [2026-06-15 01:05] phase=lld action=gate-approved+start
- Human approved HLD gate (verbatim: "approve"). Set gates.hld=approved.
- Decision: proceed to LLD. Spawning LLD agent to produce 04-lld.md (per-file interfaces/signatures, SQL DDL+RLS+Storage policies, exact App.tsx edit specs with anchors, test strategy w/ exact commands) and resolve the 2 lld_followups (activeTool ephemerality; fileIds reduce). Then one reviewer pass (no human gate at LLD).

## [2026-06-15 01:35] phase=lld action=write
- First LLD agent (single, full-scope) hit API stream idle timeout (~14min, 37 tool calls) BEFORE writing 04-lld.md (file absent). Decision: split LLD into 2 smaller parallel agents (data/backend; UI+wiring+tests) to avoid timeout. Why: single task too large; halves are mostly disjoint.
- Part 1 (data) → 04-lld-part1-data.md: full SQL migration (boards + RLS + storage bucket/policies), client/featureFlags/auth/sessionAtom/syncStatusAtom/boardRepository/supabaseFiles/syncEngine specs, EPHEMERAL_APPSTATE_KEYS const, error handling, build order.
- Part 2 (UI/tests) → 04-lld-part2-ui-tests.md: useSupabaseSync hook, SyncStatusButton, SignInDialog, exact App.tsx/menu/welcome/data-index/vite-env/app_constants edit specs (with anchors), full test list + reusable vi.mock skeleton + exact commands.
- Stitched 04-lld.md with cross-cutting reconciliation + HLD divergences. KEY corrections: STORAGE_KEYS live in app_constants.ts (not localStorage.ts); supabase-js absent from package.json but hoisted v2.45.4 in node_modules (add explicit ^2.45.0); data↔UI seam = engine.deps.applyRemoteScene(row) implemented by hook; renderTopRightUI(isMobile) single-arg (B1 mandatory); signInWithMagicLink canonical name; CaptureUpdateAction.NEVER for pull-apply; AppMainMenu/AppWelcomeScreen already take isCollabEnabled (hide via call-site flag); FileManager.reset() before retry push; test scripts at ROOT package.json; app_constants.ts + package.json each owned by ONE task (collision avoidance).
- Decision: one reviewer pass on combined LLD (no human gate at LLD), then PLANNING.

## [2026-06-15 01:50] phase=lld action=review+resolve
- Independent LLD reviewer verdict: APPROVE-WITH-CHANGES — 2 blockers, 3 majors, ALL in the engine↔hook seam being described differently across the two parallel halves (NOT design problems). Spot-checks PASS: 21 ephemeral keys all real + browser:true; FileManager contract exact; CaptureUpdateAction.NEVER re-exported (const object, not enum — nit); SQL valid for supabase db push; App.tsx anchors accurate; mock satisfies all chains. Review in 04-lld-review.md.
  - B1: applyRemoteScene specified 2 incompatible ways (engine-calls-callback vs hook-expects-start()-return). B2: SyncEngine deps/notifyChange signature conflict. M1: Part2 mis-stated consumed signatures (pushBoard arity, PushResult union, auth returns). M2: used bare new FileManager(callbacks) omitting onFileStatusChange instead of createSupabaseFileManager. M3: hook missing useSetAtom(syncStatusAtom) + imports.
- Resolution: declared Part 1 data-layer signatures AUTHORITATIVE; added a NORMATIVE "Engine ↔ Hook contract" section to 04-lld.md that fixes B1,B2,M1,M2,M3 verbatim (exact SyncEngineDeps, notifyChange()=no-arg, hook implements applyRemoteScene(row:BoardRow), use createSupabaseFileManager, hook owns setStatus). Doc-only reconciliation; architecture unchanged. Why fix-in-place vs re-run agent: reviewer gave exact correct contract; faster + deterministic.
- phase_status(lld)=done → phase=planning. Decision: decompose into tasks now.

## [2026-06-15 02:00] phase=planning action=task-breakdown
- Decomposed LLD into 11 tasks (T01-T11), topologically ordered; wrote 05-tasks.md + tasks/T01..T11.md; loaded tasks[] into state.json. Each task ≤~5 files, one coherent change, with exact verify command.
- Dep graph: T01(foundation)→{T03 repo, T04 files, T05 atoms/auth}→T06 engine→T07 hook; T08 UI dep T05; T09 App-wiring dep T07,T08; T10 disable dep T09; T11 tests dep T10. T02(SQL) independent. T03/T04/T05 parallel after T01. T09 & T10 both edit App.tsx → serialized. Shared files app_constants.ts + package.json owned ONLY by T01 (collision rule).
- phase_status(planning)=done → phase=implementation. Decision: begin IMPLEMENTATION loop. Start T01 + T02 in parallel (disjoint). Checkpoint after EVERY task.

## [2026-06-15 02:05] phase=implementation action=spawn task=T01,T02
- Set T01,T02 in_progress. Spawning 2 implementer agents in parallel (disjoint files: T01=package.json/vite-env.d.ts/app_constants.ts/data/supabase/{featureFlags,client}.ts; T02=supabase/migrations + .env.example + supabase/README.md).
- Will verify each independently before marking done + committing.

## [2026-06-15 02:15] phase=implementation action=verify+commit task=T01,T02
- T01 returned PASS. INDEPENDENT verify: new files exist (featureFlags.ts, client.ts) with correct exports; app_constants has SUPABASE_SYNC_DEBOUNCE_MS + LOCAL_STORAGE_SUPABASE_META; vite-env has 3 typings; package.json has @supabase/supabase-js ^2.45.0. Re-ran `yarn test:typecheck` myself → PASS (Done in 6.21s, 0 errors). No tests to weaken.
- T02 returned files. INDEPENDENT verify: migration + README + .env.example exist; SQL has 8 create policy, RLS enabled (L53) before policies, FK references auth.users on delete cascade, unique index on user_id, scene-files bucket insert idempotent. Read full SQL myself — clean, idempotent (if not exists / on conflict / drop policy if exists), storage policies correctly scoped to {user_id}/ via storage.foldername(name)[1], proper using/with-check split. Copy-paste ready.
- DEVIATION noted for later: T01 client.ts omitted detectSessionInUrl:true (LLD §B.2 suggested it; T01 spec didn't list it). Magic-link redirect needs it → recorded in next_action for T05/auth task.
- Both T01,T02 status=done, attempts=1. Committing.
- Decision: unlock + spawn T03,T04,T05 in parallel (all dep only on T01, disjoint files).

## [2026-06-15 02:35] phase=implementation action=verify+commit task=T03,T04,T05
- All 3 returned PASS with evidence. INDEPENDENT verify (orchestrator ran): `yarn vitest run boardRepository.test supabaseFiles.test` → 11 passed (11). `yarn test:typecheck` → PASS (0 err). Diff-check: 29 expect-assertions, ZERO .skip/.only/.todo across both test files; spot-read boardRepository.ts confirms real logic (getNonDeletedElements, ephemeral strip, optimistic .eq("version",expectedVersion) guard, 0-row→conflict) — not stubbed. No test-weakening.
- T03: ephemeralAppState.ts (21 verified browser:true keys) + boardRepository.ts (BoardRow/SerializedScene/PushResult/serializeScene/pullBoard/pushBoard) + 7 tests. T04: supabaseFiles.ts (createSupabaseFileCallbacks/createSupabaseFileManager, dataURL↔Blob via atob for jsdom, onFileStatusChange=FileStatusStore.updateStatuses.bind) + 4 tests. T05: syncStatusAtom + auth (signInWithMagicLink/signOut/getSession/onAuthStateChange, null-safe) + sessionAtom (sessionAtom/userIdAtom/useInitSupabaseSession), jotai via ../../app-jotai (app store).
- DEVIATIONS captured for T06: (a) first INSERT version=1 not 0; (b) insert errors throw, no 23505→conflict mapping (engine should handle concurrent-first-insert race via repull); (c) repo lint rejects `as const satisfies` — avoid.
- All 3 status=done attempts=1. Committing. Decision: unlock + spawn T06 (engine).

## [2026-06-15 02:55] phase=implementation action=verify+commit task=T06
- T06 returned PASS (11 engine tests). INDEPENDENT verify: `yarn vitest run excalidraw-app/tests/supabase/` → 22 passed (22) across 3 files; `yarn test:typecheck` → PASS. Diff-check: 47 expect() assertions, 0 .skip/.only; CONSTRAINT confirmed — engine has NO collab/ or isOfflineAtom import (M4 satisfied). Spot-read syncEngine.ts: real pipeline — files-first saveFiles(450), reset() on file error(459/479), version-guarded pushBoard(484-491), 23505 first-insert race→repull(495), conflict→pullBoard+applyRemoteScene(533/413), offline guards(53/347/471). Not stubbed.
- Reconcile-after-conflict choice: on conflict/23505-race → repull + applyRemoteScene + set localMeta=cloud.version + re-baseline snapshot + status synced, leave dirty untouched (next notifyChange re-pushes). Avoids clobber + re-push loop.
- T06 status=done attempts=1. Committing. Decision: unlock + spawn T07 (hook) + T08 (UI) in parallel (disjoint; T07 dep T06 met, T08 dep T05 met).

## [2026-06-15 03:05] phase=implementation action=verify+commit task=T07,T08
- Both returned PASS. INDEPENDENT verify: `yarn vitest run excalidraw-app/tests/supabase/` → 25 passed (4 files incl new hook test). `yarn test:typecheck` → PASS. `yarn eslint` on the 3 new files (SyncStatusButton, SignInDialog, useSupabaseSync) → 0 errors/warnings. Diff-check hook test: 19 expect(), 0 skip/only.
- T07 useSupabaseSync.ts: implements applyRemoteScene (updateScene captureUpdate NEVER + fileIds reduce via isInitializedImageElement + getFiles→addFiles→updateStaleImageStatuses, copied from App.tsx:463-469/504-508); builds FileManager internally via createSupabaseFileManager (M2); engine in ref w/ refs for getScene/getUserId (no stale closures); start/stop on login/logout; flush on beforeunload/blur/visibilitychange. Returns {status,lastSyncedAt,syncNow,notifyChange}. Confirmed real imports: restoreAppState is 2-arg (app_state, getAppState()); CaptureUpdateAction from @excalidraw/excalidraw.
- T08: SyncStatusButton.tsx (4 states + idle + signed-out, custom popover div, package Button) + .scss + SignInDialog.tsx (mirrors ShareDialog: Dialog/TextField/FilledButton, magic-link form). Presentational, no engine import. Added optional error prop (matches LLD §B.2).
- CRITICAL for T09 (recorded in next_action): hook takes NO fileManager param; onChange→notifyChange() no-args; renderTopRightUI B1 render button before !collabAPI return.
- T07,T08 status=done attempts=1. Committing. Decision: unlock + spawn T09 (App.tsx sync wiring).

## [2026-06-15 03:20] phase=implementation action=verify+commit task=T09
- T09 returned PASS. INDEPENDENT verify: `yarn vitest run excalidraw-app/tests` → 30 passed (7 files); `yarn test:typecheck` → PASS. Diff-check App.tsx: exactly ONE removal (`if (isMobile || !collabAPI || isCollabDisabled)` split into B1 restructure — isMobile separated so SyncStatusButton renders before the collabAPI guard); everything else additive + flag-gated (imports, hook mount, onChange notifyChange, SignInDialog all under isSupabaseSyncEnabled()). No collab/share logic deleted. userIdAtom import confirmed (L134/423).
- Agent correctly REJECTED the stale §C-1 sketch (build FileManager in App + pass to hook) and followed the real T07 hook contract: useSupabaseSync({excalidrawAPI}) only, notifyChange() no-args. Good adaptive call.
- renderTopRightUI is a plain inline arrow (not useCallback) → no stale-closure/exhaustive-deps issue; eslint App.tsx exit 0.
- T09 status=done attempts=1. Committing. Decision: unlock + spawn T10 (disable collab+share + menu items).

## [2026-06-15 03:50] phase=implementation action=verify+commit task=T10
- T10 returned PASS. INDEPENDENT verify: `yarn vitest run excalidraw-app/tests` → 30 passed (collab.test.tsx 2/2 green w/ flag OFF = no flag-off regression); `yarn test:typecheck` → PASS. 
- CRITICAL diff-check (hide-UI-keep-code requirement): inspected all removals — every `-` line is paired with a flag-gated rewrite, NOT a deletion. Confirmed dormant code PRESERVED: <ShareDialog> (L1116), <Collab> (L1112), onExportToBackend (L771), onCollabDialogOpen (L828) all present + gated by !isSupabaseSyncEnabled(). userIdAtom import merged with sessionAtom (L134), not lost. No collab/share/firebase/socket.io code deleted. ✓ requirement satisfied.
- Disable sites (all flag-gated): data/index.ts getCollaborationLinkData→null; App.tsx initializeScene #json/#url/roomLinkData→null, isCollaborating init→false, onCollabDialogOpen no-op, <Collab>/<ShareDialog> gated, command palette predicates; AppMainMenu.tsx +6 props + Sync-now/auth items (LiveCollab item hidden via call-site isCollabEnabled); AppWelcomeScreen via call-site fold-in (already had isCollabEnabled prop).
- Deviation: reused existing icons (playerPlayIcon/usersIcon/loginIcon) since spec's syncIcon/userIcon/logoutIcon don't exist. Applied full C-4 disable set (correct per acceptance criteria).
- T10 status=done attempts=1. Committing. Decision: unlock + spawn T11 (disable-verification tests).

## [2026-06-15 04:05] phase=testing action=bug-found+self-correct task=T11→T10
- T11 agent wrote disable.test.tsx (5 tests pass: getCollaborationLinkData null under flag + control flag-off non-null; SyncStatusButton present/collab-button absent at component level). CRUCIALLY: while attempting the preferred full-app render, it discovered a RELEASE-BLOCKING BUG and correctly REFUSED to patch production to hide it — flagged instead. Good protocol adherence.
- BUG: flag-on → app hangs on loading spinner forever. Root cause (orchestrator VERIFIED by reading App.tsx:553-556): scene-init effect early-returns on `(!isCollabDisabled && !collabAPI)`; T10 unmounts <Collab> under flag so collabAPI permanently null; non-iframe ⇒ isCollabDisabled false ⇒ guard true ⇒ initializeScene never runs ⇒ initialStatePromiseRef never resolves. collab.test.tsx missed it (flag-off mounts Collab; component/unit tests don't boot full app). This is the cross-cutting integration bug TESTING exists to catch.
- SELF-CORRECTION (orchestrator, not a subagent — 1-line fix, diagnosis already pinpointed + verified): App.tsx:553 guard → `if (!excalidrawAPI || (!isCollabDisabled && !collabAPI && !isSupabaseSyncEnabled())) return;`. Recorded evidence in T10.md §Attempt 2. T10 attempts=2.
- Verified fix: typecheck PASS; existing 35 tests still green (flag-off unaffected — new condition only changes flag-on path).
- Resumed T11 agent (bg) to ADD the full-app render test now possible after the fix — PROVES the spinner clears under the flag. Awaiting completion before committing fix+test together.

## [2026-06-15 04:20] phase=testing action=verify-fix+commit task=T11
- T11 bg agent added full-app render test (#6). INDEPENDENT verify: `yarn vitest run disable.test.tsx` → 6 passed. Diff-check the full-app test (L249-271): asserts renderApp resolves + .LoadingMessage null + window.h.state.isLoading===false (LOAD-BEARING proof the hang is fixed) + .collab-button absent + sync-status-button present. 0 skip/only. This test WOULD have caught the original bug → correction validated.
- Committing the App.tsx fix + all 6 disable tests together. T11 status=done attempts=1 (the bug was in T10, fixed under T10 attempt 2).
- All 11 tasks DONE. phase=regression. Decision: run FULL project regression next (not just app tests) vs baseline.

## [2026-06-15 04:35] phase=regression action=full-regression
- Ran FULL project regression (orchestrator, captured true exit codes):
  - `yarn test:typecheck` → PASS.
  - `yarn vitest run` → 1434 passed / 109 files / 0 failed (TEST_EXIT=0). Baseline was 1403/104. Delta +31 tests +5 files = EXACTLY our new tests; zero pre-existing tests broke.
  - `yarn test:code` (lint --max-warnings=0) → initially FAILED with 8 NEW warnings (6 in supabaseFiles.test.ts: 2 import/order + 2 no-template-curly-in-string in `it(...)` descriptions; +2 import/order in supabaseFiles.ts). FIXED: reworded 2 test descriptions to drop ${...}, ran eslint --fix on both files for import order. Re-ran → LINT_EXIT=0. supabaseFiles test still 4/4 green.
- These were the only regressions vs baseline and they're now clean. Wrote test-report.md.
- phase=documentation. Committing lint fixes. Decision: write 06-docs.md then RETRO.

## [2026-06-15 04:50] phase=documentation action=write
- Docs agent wrote 06-docs.md (overview, enable/disable + 3 env vars, architecture/module map, data model + flow, how collab/share disabled-but-dormant, testing, limitations/future, files-changed) and added an 8-line "Optional: self-hosted Supabase sync" note to root README.md linking supabase/README.md + .env.example.
- Agent verified changed-file set via git diff master...HEAD: AppWelcomeScreen.tsx did NOT ship a component edit (collab hidden via AppMainMenu + App.tsx call-site props) — documented accurately. Orchestrator confirmed: 27 non-.engineer files changed (3365+/31-); the 31 App.tsx deletions are flag-gating rewrites, no logic lost.
- phase=retrospective. Committing docs. Decision: write RETRO.md, then final report.

## [2026-06-15 05:00] phase=retrospective action=complete
- Wrote RETRO.md (built vs planned, 5 documented deviations, the 1 bug + self-correction, final verification, no blocked items, follow-ups). Marked run_status=done.
- FINAL STATE: 11/11 tasks done, 0 blocked. typecheck PASS, full suite 1434 passed/0 failed (+31 new vs baseline), lint exit 0. 9 commits on branch online-sync. Feature flag-gated (VITE_APP_FEATURE_SUPABASE_SYNC); flag-off = original app.
- Handoff to human: provision hosted Supabase (run migration, confirm scene-files bucket, enable magic-link auth, set 3 env vars), then build with flag on to validate end-to-end (no automated live test by design).

## [2026-06-16] phase=followup-design action=single-writer-design
- NEW follow-up requested by user (post-run): single-writer / multi-reader across tabs+devices. Currently out-of-scope LWW would ping-pong between concurrent sessions.
- Product decisions (AskUserQuestion, verbatim intent):
  - Writer policy = Explicit "Take over editing" button; new sessions open READ-ONLY.
  - Lock transfer = on takeover, current writer is NOTIFIED first, a FINAL sync flush of its last changes runs, THEN the lock transfers (graceful handoff).
  - Reader updates = Polling (every few seconds) for version + lock/presence (heartbeat-based).
  - Reader UX = Hard read-only (viewModeEnabled + banner + reader state on sync button).
- Current code baseline: engine uses version-guarded LWW (optimistic .eq(version); conflict→repull, cloud wins). tabSync is localStorage same-device only. No presence/lock today.
- Plan: spawn design agent → write a design doc (lock data model, state machine, handoff protocol, polling, migration + UI), then review before implementing. Also: prior local-run UI fixes + DB grant fix still UNCOMMITTED.

## [2026-06-16] phase=followup-design action=design+review
- Designer wrote 07-single-writer-design.md: lock = extra columns on boards (writer_id, writer_session_id, writer_heartbeat_at, lock_expires_at, takeover_requested_by, takeover_requested_at); per-tab session_id in sessionStorage; atomic claim via SECURITY DEFINER RPC claim_board_lock (conditional UPDATE, WHERE writer_id is null OR lock_expires_at<now() OR writer_session_id=mine); HB 5s / lease 25s / poll 4s / ack-grace 12s; graceful handoff via takeover_requested_by column; reader gate in engine; viewModeEnabled (confirmed controlled prop App.tsx:2800/3492) for hard read-only. New 0002 migration + RPCs.
- Independent concurrency review (07-single-writer-review.md): APPROVE-WITH-CHANGES, 0 blockers, 2 majors. Lock admits EXACTLY ONE writer = YES (verified row-lock + EvalPlanQual under READ COMMITTED, no TOCTOU). Handoff no-lost-edits = NO as written, YES after M1 fix.
  - M1: flush()/runPush() return without throwing on network/file/conflict failure → dirty stays true but release frees lock anyway → requester pulls pre-flush version → lost writer edits. FIX: flush() returns success; release only if dirty===false.
  - M2: takeover_requested_by only cleared by successful claim/release; a stalled handoff or abandoned requester wedges it forever. FIX: TTL the request inside renew/read_lock_state.
  - m5 (key minor): read_lock_state must be SECURITY DEFINER RPC returning server-computed lock_live, not a client-clock compare.
  - Other minors: doc's stripEphemeral(viewModeEnabled) claim false but harmless (browser:false drops it); RLS comment misleading but functionally safe; authenticated can write own lock cols (self-grief only).
- Decision: patch design with M1/M2/m5 fixes → implementation-ready. Then present to user to decide build. NOTE: still UNCOMMITTED — local-run UI fixes (overlap, modal scss, spinner) + DB grant migration fix + supabase/config.toml.

## [2026-06-16] phase=single-writer-impl action=spawn task=W01
- Committed local-run batch (3 commits: grant fix e2e5a05f, UI polish a895986a, config+docs a021b141). Tree clean.
- Design patched (rev2): M1 flush-success gate, M2 request-TTL self-heal, m5 server-side read_lock_state. Implementation-ready.
- Wrote 08-single-writer-tasks.md + tasks/single-writer/W01-W05.md; loaded into state.subrun.
- Spawning W01: migration 0002 (lock cols + 5 SECURITY DEFINER RPCs + grants) + boardRepository lock wrappers + boardLock.test.ts.

## [2026-06-16] phase=single-writer-impl action=verify+commit task=W01
- W01 returned PASS. INDEPENDENT verify: boardLock.test 15/15; typecheck PASS. Applied 0002 to LOCAL Supabase (Podman) — both migrations applied, NO SQL errors. Smoke-tested real DB: 6 lock columns present; all 5 RPCs exist + SECURITY DEFINER; execute granted to authenticated. Diff-check: 27 assertions, 0 skip/only; repo additions additive (serializeScene/pullBoard/pushBoard intact @ 37/61/87, 5 lock fns appended @ 193+).
- Wrappers (design §5, no userId arg — RPCs read auth.uid()): claimLock/renewLock/releaseLock/requestTakeover(client,sessionId), readLockState(client). client.rpc("<fn>",{p_session_id}).
- W01 done. Committing. Decision: spawn W02 (engine).

## [2026-06-16] phase=single-writer-impl action=verify+commit task=W02
- W02 returned PASS. INDEPENDENT verify: syncEngine.test 22/22 (10 new incl handoff success+fail, reader-gate, flush-success, lost-lock); typecheck PASS. Diff-check: reader-gate `role !== "writer"` on notifyChange(410)/syncNow(447)/flush(465)/runPush(536); performHandoff(822) does `ok=await flush()` then releaseLock+becomeReader ONLY in ok branch (835/843) = M1 satisfied. lint clean.
- Engine extensions: SyncEngineDeps +getSessionId?/setLock? (optional to keep untouched hook compiling — W03 tightens); SyncRole/SyncLockState exported; role default reader; start()→claimLock→writer/reader; heartbeat 5s renewLock (throw=retry, stillWriter:false=demote, takeover=handoff); flush()/runPush()→Promise<boolean> (pipeline moved to ungated pushScene); stop/dispose release.
- Deviations: (1) new deps optional not required; (2) HEARTBEAT_MS local const. Both sensible.
- W02 done. Committing. Decision: spawn W03 (lockAtom + hook).

## [2026-06-16] phase=single-writer-impl action=verify+commit task=W03
- W03 returned PASS. INDEPENDENT verify: useSupabaseSync+syncEngine 30/30 (engine 22 stayed green after seam edit, hook 8); app tests 67/67; typecheck + lint clean. Diff-check: viewModeEnabled = isSupabaseSyncEnabled() && !!userId && role==="reader" (flag-off safe, L426); getSessionId via sessionStorage per-tab + crypto.randomUUID (lockAtom.ts); constants SUPABASE_LOCK_POLL_MS/HEARTBEAT_MS/LEASE/ACK_GRACE + SESSION_STORAGE key in app_constants.
- W03: lockAtom.ts (LockState extends engine SyncLockState + holderIsMe/takeoverInFlight); hook reader-poll (4s, version-bump→pullLatest), takeOver flow (requestTakeover → poll-claims-on-free or immediatelyClaimable fast path), viewModeEnabled derived. Engine seam added (getRole/getLocalVersion/pullLatest/tryClaim/takeOver — reuse private machinery, role transitions stay engine-owned). Deviation: poll in hook per task spec (design put it in engine); deps left optional.
- W03 done. Committing. Decision: spawn W04 (UI).

## [2026-06-16] phase=single-writer-impl action=verify+commit task=W04
- W04 returned PASS. INDEPENDENT verify: app tests 67/67; typecheck clean; ReadOnlyBanner.{tsx,scss} exist; App.tsx wires viewModeEnabled (L1010), role (L1030), ReadOnlyBanner (L1124). lint clean.
- W04: SyncStatusButton +optional role/onTakeOver/takeoverInFlight (reader=muted 👁 Read-only pill + "Take over editing" popover item, spinner suppressed; writer=unchanged); ReadOnlyBanner top-center (pointer-events:none container so toolbar unobstructed); App passes viewModeEnabled={supabaseSync.viewModeEnabled} (false flag-off → unchanged). Props optional → disable.test old call site still compiles. No functional deviation.
- W04 done. Committing. Decision: spawn W05 (integration tests + full regression).

## [2026-06-16] phase=single-writer-impl action=verify+commit+close task=W05
- W05 returned PASS. INDEPENDENT final regression (orchestrator, captured exits): singleWriter 8/8; typecheck PASS; FULL suite VITEST_EXIT=0 → 1473 passed / 111 files / 0 failed (baseline 1434/109; +39 new, zero regressions); lint LINT_EXIT=0. No bug found by W05.
- W05: singleWriter.test.tsx (8 tests) — hook-level (roles, viewMode, reader-gate, takeover happy-path, server-clock liveness 5a/5b) + engine-level (handoff flush-success 3a / flush-fail 3b). Consolidated safety net; no production change.
- ALL single-writer tasks W01-W05 DONE, 0 blocked. Committing W05 + closing subrun. Re-applying 0002 to local Supabase so the running app has the lock schema.

## [2026-06-16] phase=single-writer-impl action=bugfix task=reader-viewport
- USER bug (reader): applying a writer's update zoomed out + moved the reader's camera. Root cause: applyRemoteScene passed restoreAppState(row.app_state,...) to updateScene; restoreAppState normalizes viewport (zoom→default 1, scroll→0) since the cloud row has no scroll/zoom (stripped on push) → updateScene reset the reader's camera.
- FIX (useSupabaseSync.ts applyRemoteScene): overlay current scrollX/scrollY/zoom from excalidrawAPI.getAppState() back onto the restored appState before updateScene. Benefits writer pull-on-login too (no camera yank).
- Locked in: strengthened hook test — mock getAppState now returns LOCAL_VIEWPORT {scrollX:123,scrollY:456,zoom:{value:2.5}}; assert applied appState preserves those exact values. 16/16 hook+singleWriter; full suite 1473/0 failed; typecheck+lint clean.
