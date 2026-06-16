# 02 — Scope

## In scope
1. **Supabase client + config**
   - Add `@supabase/supabase-js`; create a singleton Supabase client from
     `VITE_APP_SUPABASE_URL` + `VITE_APP_SUPABASE_ANON_KEY`.
   - Add typings to `excalidraw-app/vite-env.d.ts` (`ImportMetaEnv`).
   - `.env.example` documenting the new vars; feature flag `VITE_APP_FEATURE_SUPABASE_SYNC`.
2. **Auth (Supabase Auth)**
   - Sign-in / sign-out UI (default: email magic link; provider finalized in LLD).
   - Auth state available to the app (session, user id), reactive to login/logout.
3. **Scene sync**
   - Pull the user's cloud scene on load/login; merge into the editor.
   - Auto background push: on `onChange`, debounce and upsert scene to Supabase
     (`boards` row keyed by `user_id`). Last-write-wins via `updated_at`/version.
   - Manual **"Sync now"** action with status (synced / syncing / error / offline).
   - First login with empty cloud → push current local scene up.
4. **File (image) sync**
   - Supabase Storage bucket; a `FileManager`-compatible adapter that saves/loads
     binary files by id (mirrors the existing `FileManager` `saveFiles`/`getFiles` shape).
5. **Disable live collaboration + share links (hide UI, keep code)**
   - Remove/neutralize `LiveCollaborationTrigger` in `renderTopRightUI`.
   - Gate `<Collab>` render behind a disable flag.
   - Neutralize ShareDialog open triggers (menu commands, `collaborationOnly`) and the
     export-to-backend action.
   - Neutralize `#room=` / `#json=` / `#url=` URL handling so external scenes/rooms don't load.
6. **Schema + security**
   - SQL migration(s): `boards` table (user-owned), RLS policies, Storage bucket + policies.
7. **Tests**: unit tests for the Supabase data layer (mocked client), sync controller logic,
   and that collab/share entry points are disabled. Update snapshots as needed.
8. **Docs**: `06-docs.md`, `.env.example`, and a short README/setup note for provisioning the
   stakeholder's Supabase project (run migrations, create bucket, set env).

## Out of scope
- Supabase Realtime / concurrent multi-user editing (auto sync is single-active-session LWW).
- Deleting collab/share code or removing socket.io-client / Firebase deps.
- Migrating legacy Firebase/backend share data.
- Full board-management UI (multiple named boards). Schema will be *extensible* to it, but UI
  syncs the single working scene.
- CRDT/OT conflict merging.
- Live integration tests against the stakeholder's hosted Supabase (unit tests mock the client).

## Measurable success criteria
- SC1: With valid Supabase env + a logged-in user, editing the canvas results in an upserted
  `boards` row (verifiable via the data-layer unit test asserting `upsert` is called with the
  scene payload after debounce).
- SC2: On load/login, the app calls the cloud-pull path and applies returned scene (unit test).
- SC3: "Sync now" triggers an immediate push and transitions status syncing→synced (unit test).
- SC4: Image save/load round-trips through the Supabase Storage adapter (unit test on the
  adapter using a mocked storage client).
- SC5: No UI path opens live collaboration or creates a share link; `#room=`/`#json=` URLs do
  not start a room or import a backend scene (unit/integration test + code review).
- SC6: RLS migration present; policies restrict `select/insert/update/delete` to
  `auth.uid() = user_id`; Storage policies restrict to the owner's path.
- SC7: `yarn test:typecheck` passes; new unit tests pass; `yarn vitest run` shows no NEW
  failures vs baseline (1403 passed); `yarn test:code` (lint) passes.

## Affected areas (confirmed in exploration-scope.md)
- `excalidraw-app/App.tsx`: `onChange` (~677-727; syncElements ~682-684, LocalData.save ~689),
  `initializeScene` (~215-371; hash detection ~248, collab start ~327-359), `renderTopRightUI`
  (~955-978; `LiveCollaborationTrigger` ~969-976), `<Collab>` render (~1038-1040), ShareDialog
  render + open triggers (~791-793, ~1082-1109, ~1127), `onExportToBackend`, hash-change handler
  (~532-556), MainMenu block (for Sync + Sign-in/out items), `excalidrawAPI` scene readers
  (`getSceneElements*`, `getAppState`, `getFiles`).
- `excalidraw-app/data/`: `LocalData.save/flushSave/pauseSave` (LocalData.ts), `FileManager`
  (constructor expects `{ getFiles(ids)→{loadedFiles,erroredFiles}, saveFiles({addedFiles})→
  {savedFiles,erroredFiles} }`), `importFromLocalStorage`, `localStorage.ts` keys,
  `data/index.ts` (`getCollaborationLinkData` ~138-146, `isCollaborationLink`, import-from-backend).
- `excalidraw-app/vite-env.d.ts` (`ImportMetaEnv` ~4-49), `excalidraw-app/vite.config.mts`
  (`loadEnv(mode, "../")`, test setup).
- **New files** (planned): `excalidraw-app/data/supabase/` (client, auth, board repo, storage
  file manager, sync controller), `supabase/migrations/*.sql`, `supabase/config.toml` (optional),
  auth UI component(s), `.env.example`.

## Risks & mitigations
- **R1 — onChange is a hot path.** Adding sync work there can jank the editor. *Mitigation:*
  reuse the existing debounce; do sync off the critical path (debounced, async, fire-and-forget
  with status), never block onChange.
- **R2 — Pull-on-load vs local scene race / clobbering local edits.** *Mitigation:* defined
  LWW policy with `updated_at`/version; on load, choose newer of local vs cloud; first-login
  push-if-empty; document the rule in HLD; cover with tests.
- **R3 — Disabling collab/share by editing a 1000-line App.tsx may break unrelated tests
  (snapshots, collab tests).** *Mitigation:* gate behind a flag, keep code present; run full
  suite in REGRESSION; update only legitimately-changed snapshots (never weaken tests).
- **R4 — No live Supabase to test against.** *Mitigation:* mock `@supabase/supabase-js` in
  unit tests (pattern reused from existing firebase/collab test mocks); deliver `.env.example`
  + setup doc so stakeholder can validate live.
- **R5 — Auth provider config (OAuth) needs stakeholder setup.** *Mitigation:* default to email
  magic link (no extra provider config); make provider a documented config point.
- **R6 — Storage bucket RLS/path correctness is easy to get subtly wrong.** *Mitigation:*
  explicit policies in migration; unit-test the path/key derivation in the adapter.

## Assumptions (carried from requirements, may be refined in HLD)
- A1: Sync unit = single working scene → one `boards` row per `user_id` (extensible).
- A2: LWW conflict policy via `updated_at`/version; single active session per user.
- A3: `LocalData` remains offline source of truth; Supabase layered on top.
- A4: "Hide UI, keep code" = neutralize triggers/URL handling; do not delete collab/share/firebase.
- A5: Email magic-link auth by default.
