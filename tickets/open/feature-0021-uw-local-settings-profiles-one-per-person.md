# feature-0021-uw-local-settings-profiles-one-per-person

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** settings live in `localStorage` under one key, which is **per browser profile, not per person**. Two people on one workstation therefore share every endpoint **and share the API key** — and the last person to leave has left their key in a place the next can read. There is no way to tell them apart, and no way for one person's settings to reach their second machine. **Expected:** settings belong to a **person**, and a shared machine does not pool them.

Found by audit: `docs/2026-10-11-ai-model-audit.md` §3.2 and §3.7.

## Impact

**Affected:** any shared workstation, and any user with two machines. **Risk if not built:** a credential leak by design on shared hardware, and retyping every endpoint on a second machine.

## Architecture intent

**Local profiles, not accounts.** The problem is two people on one browser, not scale. A named settings slot selected at the door fixes the leak in full; export/import covers the second machine. Server-side identity is explicitly **not** this ticket — the mediated gateway in the team vault owns shared credentials, and a second identity system here would be a second place to get authorization wrong.

## Requirements

- Settings are stored **per named local profile**; the active profile is chosen by the user, and the choice is visible in Settings.
- A profile carries: models, agents, servers and the vision flag — everything the store holds today.
- **Switching profiles switches every credential**; nothing leaks across the switch, and the previous profile's key is never rendered while another is active.
- A profile can be **exported and imported** as a file, with keys included, and the export **states that it contains keys** — a silent secret in a file is how a leak starts.
- A profile can be **deleted**, and deleting it removes its credentials from storage.
- With exactly one profile, the app behaves as it does today — no new step for a single user.

## Constraints

No server, no account, no sync service. Keys stay in the browser; the export is the user's own file and their own risk, and it says so.

## Non-goals

Not multi-tenancy, not SSO, not a shared credential vault — those are the team vault's.

## Test cases

- **Positive:** two profiles on one browser, each with its own key → switching shows each person their own endpoints, and never the other's key.
- **Positive:** export then import on another machine reproduces the configuration, and the panel names the same model.
- **Negative:** deleting a profile removes its key from storage (checked by reading storage, not by trusting the UI).
- **Compatibility:** an existing single-key store becomes one profile named for the machine, so nothing is lost on upgrade.

## Resolution

_(filled on close)_
