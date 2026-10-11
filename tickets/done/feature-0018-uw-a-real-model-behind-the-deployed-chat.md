# feature-0018-uw-a-real-model-behind-the-deployed-chat

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** the deployed chat is backed by whatever model the operator points the bridge at, and the first choice **did not answer at all**. Measured 2026-10-11: the bridge was deployed against the server's own Ollama model (`qwen3.5:2b`), `/healthz` reported it healthy, and a real prompt streamed back **an empty reply** — no content, no `done` frame the panel could use.

**Expected:** a deployed model **answers with a usable diagram**, or the deployment says plainly that it cannot. A health check that reports `ok` while every prompt returns nothing is worse than no model: it looks configured and behaves as broken.

## Impact

**Affected:** every user of the deployed app. The chat is the most visible feature and the most sensitive to which model is behind it.

**Risk if not built:** the AI panel looks present and does nothing, and the team concludes the tool is broken rather than the model.

## Architecture intent

Two layers, and they must not be confused:

```
layers[2]{layer,who,purpose}:
  "the shared floor","the deployment","a model that always answers, modest but working — so a new user is never stuck"
  "the user's own","each user, in Settings","their key, their endpoint, their model — feature-0017"
```

The floor's job is to **work**. It is not a promise of quality; quality is the user's choice.

## Requirements

- A model is only attached to the deployment if a **real prompt completes** against it — health alone does not qualify. The verification is a one-line generation, run as part of the deploy.
- If no model can be attached, the app **says so** and the chat reports the reason inline, rather than a panel that accepts a prompt and answers nothing.
- The floor model is **named in the deploy output**, so "which model is answering" is never a guess.
- A model at a **tailnet address** is a legitimate source (`feature-0019`), and when one is used the dependency is stated: **the deployment then needs that machine awake.**

## Constraints

- No credential in the repo; the model endpoint comes from the deploy's environment.
- The bridge still refuses to start without a model — that stays.
- A shared model is a floor only: **it must never override a user's own choice** (`feature-0017`).

## Non-goals

- Not model-quality work; not a model router; not the mediated gateway of the team vault.
- Not the hosting itself (`feature-0019`).

## Test cases

- **Positive:** after a deploy, a prompt through the public AI door returns a Mermaid diagram, and the deploy names the model it used.
- **Negative:** a model that answers `ok` on `/healthz` but returns empty content is **rejected by the deploy**, with that fact printed.
- **Negative:** with no model attached, the chat states the reason inline and the panel stays usable.
- **Compatibility:** a user's own model in Settings still wins.

## Resolution

_(filled on close)_

---

## Resolution

**Landed** 2026-10-11 — and it caught a real one on its first run.

### The proof, in the deploy

`server/deploy/install.sh` now asks the model a question and **reads the answer**; health alone no longer qualifies. If no content comes back it says so in capitals, and the closing report reads `AI: DEPLOYED BUT NOT ANSWERING — … the chat will accept a prompt and answer nothing`.

**Measured, both directions:**

- against the server's own Ollama (`qwen3.5:2b`) → _"THE MODEL DID NOT ANSWER … returned no content"_, and the report warned rather than claimed success. Its `/healthz` had said `ok` throughout.
- against this machine's 35B (`qwen3.6-35b-a3b-3050@iq2_xxs`, over the tailnet) → _"the model answered — 3 content frame(s) came back"_, and the report named it, **proven by a real prompt**.

When the model lives on another machine the report says so: _"NOTE: that model lives on ANOTHER machine, so this deployment needs it awake."_

### A bug the new check found in itself

`grep -c` prints `0` **and exits non-zero**, so appending `|| echo 0` produced `"0\n0"` and the test could not read it (`[: 0\n0: integer expected`). The count is now sanitised to digits. A check that cannot read its own result is worth less than none, which is the point of the ticket.

### Verified

- Both directions run live against the real server; the public AI door returned `flowchart TD / Start --> Work --> Done`.
- The deployed app's `/healthz` on the AI host reports the model it is serving.
