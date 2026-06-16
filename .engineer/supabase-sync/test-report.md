# Test & Regression Report — supabase-sync

## New unit/integration tests added (31 tests, 5 files)
| File | Tests | Covers |
|---|---|---|
| `excalidraw-app/tests/supabase/boardRepository.test.ts` | 7 | serializeScene strips ephemeral keys + deleted elements; pushBoard insert path (v1); version-guarded update; 0-row→conflict; pullBoard mapping/null |
| `excalidraw-app/tests/supabase/supabaseFiles.test.ts` | 4 | saveFiles uploads to userId/fileId + returns savedFiles; upload error→erroredFiles (BinaryFileData); getFiles download+reconstruct; download error→erroredFiles (true) |
| `excalidraw-app/tests/supabase/syncEngine.test.ts` | 11 | debounced push; unchanged-scene no-op; file-error keeps dirty + reset() + no version bump; offline no-network; syncNow immediate; conflict/23505 repull; success persists meta; start() reconcile paths |
| `excalidraw-app/tests/supabase/useSupabaseSync.test.tsx` | 3 | login→pull→updateScene(NEVER)+addFiles+updateStaleImageStatuses via createSupabaseFileManager; status atom drives return; flag-off no-op |
| `excalidraw-app/tests/supabase/disable.test.tsx` | 6 | getCollaborationLinkData null under flag (+ flag-off control); SyncStatusButton present / collab trigger absent (component); **full-app render boots under flag without hanging (isLoading clears)** + collab UI absent + sync UI present |

## Bug found & fixed during TESTING (Self-Correction)
- **Symptom:** with `VITE_APP_FEATURE_SUPABASE_SYNC="true"`, the app hung on the loading spinner forever.
- **Root cause:** scene-init effect (`App.tsx`) early-returned when `(!isCollabDisabled && !collabAPI)`; under the
  flag `<Collab>` is unmounted so `collabAPI` is permanently null, and in a normal (non-iframe) context
  `isCollabDisabled` is false → `initializeScene` never ran → initial-state promise never resolved.
- **Fix:** guard now `if (!excalidrawAPI || (!isCollabDisabled && !collabAPI && !isSupabaseSyncEnabled())) return;`.
- **Proof:** new full-app render test asserts the spinner clears (`isLoading === false`) under the flag. This test
  would have caught the original bug.

## Full regression (vs baseline)
| Gate | Baseline | After | Result |
|---|---|---|---|
| `yarn test:typecheck` | PASS | PASS | ✓ no regression |
| `yarn vitest run` | 1403 passed / 104 files / 0 failed | **1434 passed / 109 files / 0 failed** | ✓ +31 tests (= new), 0 pre-existing broke |
| `yarn test:code` (lint, `--max-warnings=0`) | PASS | PASS (exit 0) | ✓ (fixed 8 warnings introduced in supabaseFiles test+impl: import order + 2 no-template-curly-in-string in test descriptions) |

48 skipped + 1 todo are pre-existing (unchanged). Stderr noise ("Error JSON parsing firebase config",
punycode DeprecationWarning, "MetaProperty could not be resolved") is identical to baseline — not failures.

## Not covered (by design / environment)
- **Live integration against a real Supabase project** — out of scope (stakeholder provides the hosted project;
  unit tests mock `@supabase/supabase-js`). The stakeholder validates end-to-end after running the migration +
  setting env. See `supabase/README.md`.
- Concurrent multi-user editing / Realtime — explicitly out of scope (LWW single-active-session).
