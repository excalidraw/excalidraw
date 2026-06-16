# 01 — Requirements

## Problem statement
The Excalidraw app currently persists scenes locally (localStorage + IndexedDB) and offers
**live collaboration** (socket.io + Firebase) and **shareable links** (Firebase + a backend
service). For a self-hosted deployment we want each user's whiteboard to **sync to their own
Supabase project** so their boards follow them across devices, behind a login. The collaborative
and link-sharing features are out of scope for this deployment and must be made unreachable.

## Goals
1. **Authenticated cloud sync** of a user's whiteboard scene to Supabase, scoped per user.
2. **Automatic background sync**: local scene changes are debounced and pushed to Supabase;
   on load (and login) the user's cloud scene is pulled.
3. **Manual sync control**: an explicit "Sync now" button (and clear sync status indication).
4. **Binary file (image) sync** via a Supabase Storage bucket so image-bearing scenes are
   complete across devices.
5. **Disable live collaboration** and **shareable links** — users cannot reach either feature.
6. Preserve the existing **offline-first local experience** (app works without network/login;
   local storage remains the immediate source of truth).

## Users
- Self-hosted single-tenant/few-tenant users who sign in (Supabase Auth) and want their own
  boards persisted to the cloud and available on multiple devices.

## Definition of Done
- A logged-in user's scene auto-syncs to Supabase (debounced) and pulls on load/login.
- A manual "Sync now" action exists with visible status (synced / syncing / error / offline).
- Images in a scene round-trip through Supabase Storage across devices.
- Live-collaboration and share-link entry points are removed/hidden; no way to start a room
  or create a share link from the UI or URL.
- Supabase schema + RLS migrations exist; an anon user can only read/write their own rows/files.
- `.env.example` documents required `VITE_APP_SUPABASE_*` variables.
- Typecheck, the new unit tests, and the full existing test suite pass (no new regressions vs
  baseline); lint passes.

## Non-goals (out of scope)
- Real-time multi-user collaboration through Supabase Realtime (auto sync is last-write-wins,
  single-user-per-board; not concurrent editing).
- Migrating legacy data from the existing Firebase/backend share infrastructure.
- Multiple named boards / board management UI (this deployment syncs the user's single working
  scene unless HLD decides a lightweight board row keyed by user is trivially extendable).
- Deleting the dormant collab/share code or removing socket.io/Firebase dependencies (we only
  disable reachability — see Constraints).
- Production-grade conflict resolution / OT/CRDT merging.

## Constraints & decisions (from stakeholder Q&A)
- **Auth model:** Supabase Auth (email/OAuth login). Boards owned by `user_id`; Row-Level
  Security enforces per-user isolation.
- **Sync model:** Auto background sync (debounced push, pull on load) **and** a manual
  "Sync now" button.
- **File storage:** Supabase Storage bucket keyed by file ID, RLS-protected. Replaces Firebase
  for this app's file needs.
- **Removal depth:** **Hide/disable UI and URL handling**, keep the underlying Collab / share /
  socket.io / Firebase code dormant in the tree (low risk, revertible). No dependency removal.
- **Deployment:** Brand-new self-hosted application — **no legacy user data to migrate.** First
  login may simply push the current local scene to the cloud if the cloud is empty.
- **Supabase environment:** Stakeholder provides a **hosted Supabase project**. We deliver code,
  SQL migrations, bucket setup, and `.env.example`; the stakeholder supplies URL + anon key.
  **No live integration tests** against their instance — unit tests mock the Supabase client.

## Q&A (verbatim)
**Round 1 (setup):**
- Q: How should I run this engineering effort? — A: **Supervised (Recommended).**
- Q: Auth/identity model for sync? — A: **Supabase Auth (login).**
- Q: What sync behavior? — A: **"auto sync and manual button for sync as well."**

**Round 2 (requirements):**
- Q: How should binary files (images) be synced? — A: **Supabase Storage (Recommended).**
- Q: Scope of removal for disabled features? — A: **Hide UI, keep code.**
- Q: What happens to existing local board on first login? — A: **"this will be a new
  application that I will host myself"** (⇒ no legacy migration; treat first login as
  push-local-if-cloud-empty).
- Q: Where will the Supabase project come from? — A: **"I'll provide a hosted project"**
  (⇒ code + migrations + `.env.example`; no live integration tests; mock in unit tests).

## Assumptions
- A1: The synced unit is the user's **single working scene** (elements + appState subset +
  files), stored as one row per user (`boards` keyed by `user_id`, extensible to multiple
  boards later). HLD will confirm the row model.
- A2: Sync conflict policy is **last-write-wins** using an updated-at / version field; the app
  is effectively single-active-session per user.
- A3: We keep `LocalData` (localStorage + IndexedDB) as the offline source of truth and layer
  Supabase sync on top, rather than replacing local storage.
- A4: "Hide UI, keep code" means: remove render of `LiveCollaborationTrigger`, neutralize
  ShareDialog open triggers and the export-to-backend action, and ignore/strip `#room=` /
  `#json=` URL handling — without deleting `collab/`, `share/`, or `data/firebase.ts`.
- A5: Auth UI can be minimal (sign-in / sign-out; email magic-link or OAuth — exact provider
  decided in HLD/LLD; default to email magic link as it needs no extra provider config).
