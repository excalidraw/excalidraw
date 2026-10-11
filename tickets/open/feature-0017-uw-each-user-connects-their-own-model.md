# feature-0017-uw-each-user-connects-their-own-model

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** a model can be configured _per browser_ (Settings, `feature-0002`), but nothing tells a user they may, nothing makes it easy, and the only model a new user usually gets is whatever the deployment happens to point at. A teammate with their own Claude key, their own OpenCode Zen workspace, or their own machine on the tailnet has no obvious way to use it — and the app cannot tell the difference between "nobody configured a model" and "this person has one of their own".

**Expected:** **each user connects their own model**, in their own browser, without asking an administrator — and the app says plainly which model is answering.

## Impact

**Affected:** every teammate, and the deployment. A shared server model is a **floor**, not the only path: the person with a Claude key should not be limited to a 2B model running on a small server, and the person with a beefy local machine should not have to send their prompts anywhere at all.

**Risk if not built:** the tool's AI is only as good as the weakest model someone else chose, and the per-user path that already exists stays invisible.

## Architecture intent

Models resolve in a **chain**, first match wins, and the app names the one it used:

```
resolution[3]{order,source,who_sets_it}:
  "1","this browser's Settings","the user, themselves — a key, a URL, a model id"
  "2","the build's environment defaults","the install's administrator"
  "3","none — the AI panel says so","—"
```

Everything is already stored locally per browser, so this ticket is mostly **making the chain visible, safe and pleasant** rather than inventing storage.

## Requirements

- Settings opens on first use of the AI panel if no model is configured for that browser — the panel does not sit there silently unable to answer.
- The Settings model list accepts **a key per provider**, kept in that browser only, never sent anywhere except the provider it belongs to.
- **A credential is never committed, never put in a shared scene, and never rendered back** in plain text after saving (already true; restated because this ticket makes users type more keys).
- The AI panel **names the model answering**, so "which one am I talking to" is never a guess.
- A user's own model **wins over the install default** without changing it for anyone else.
- The app must refuse, with a reason, rather than silently falling back to a different model than the user chose.
- On a **shared** room, a user's prompts go to **their** model, not to another member's.

## Constraints

- No team-wide secret store in this ticket: a shared credential is the vault's business (`hodd/docs/security/2026-10-10-the-team-vault.md`), not the whiteboard's.
- Keys stay in browser storage; if that is judged too weak for a key the user cares about, the answer is the mediated gateway, not a second store here.
- Discovery (`GET {base}/models`) and _Test connection_ must work for a user-added provider exactly as they do now (`feature-0002`).

## Non-goals

- Not a hosted key-sharing service.
- Not per-room model policy.
- Not the ops work of hosting more models on the server (`feature-0018`).

## Test cases

- **Positive:** a user adds their own Claude key and model; the panel answers from it, and names it.
- **Positive:** the same browser's `aiBackend` is unset and a build default exists → the build default answers, and **the panel distinguishes that from the user's own**.
- **Negative:** a wrong key produces the provider's own error, inline, and no fallback silently answers instead.
- **Negative:** a saved key is not rendered back in Settings and does not appear in an exported scene.
- **Compatibility:** an existing per-browser configuration keeps working untouched.

## Resolution

_(filled on close)_
