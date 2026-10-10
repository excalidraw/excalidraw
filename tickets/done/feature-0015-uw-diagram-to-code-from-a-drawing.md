# feature-0015-uw-diagram-to-code-from-a-drawing

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-10 · **Owner** @zerwiz

## Problem

**Current:** the bridge answers the panel's `diagram-to-code` route with an explicit _"not implemented yet"_ error frame. The panel offers **Wireframe to code** and gets nothing. **Expected:** a drawing goes in, code comes out — or the feature is **hidden**, not offered.

## Impact

**Affected:** anyone who clicks the button. An offered-but-refused feature is worse than an absent one: it reads as a defect.

## Architecture intent

This needs the **vision** path — an image in — which is a different capability from text-to-diagram, not a variation of it. It therefore gets its own decision about which model serves it.

## Requirements

- Either implement the route against a vision-capable model configured in Settings, or **hide the entry** when no vision model is configured.
- The panel's request contract is unchanged: an SSE stream of the same frame shapes.
- The image is sent to the model the operator configured, and to no other host.
- A failed or timed-out generation produces an error frame the panel renders, never a hang.

## Non-goals

Not a code-quality promise; not a general screenshot-to-app generator; not a new UI.

## Test cases

- **Positive:** with a vision model configured, a drawing returns streamed code.
- **Negative:** with no vision model, the entry is hidden (or the route says exactly what is missing, and the panel shows it).
- **Negative:** an upstream error becomes an error frame, not a spinner.

## Constraints

No new dependency; the bridge logs timing and token counts, never a prompt or an image.

## Resolution

_(filled on close)_

---

## Resolution

**Landed** 2026-10-10 — both halves of the ticket: the route **implements** vision, **and** the entry is **hidden** without one.

### The route

`buildVisionRequest` in `bridge.mjs` and `handleDiagramToCode` in `index.mjs`:

- The panel's request contract is **unchanged** — `{texts, image, theme}` in, the same content/done/error SSE frames out.
- The image travels as an OpenAI `image_url` content part carrying the data URL the panel already produced, with the drawing's own text beside it as a text part, and a prompt demanding **code only** (same reason as the Mermaid prompt: a general model wraps the answer in prose).
- **`TTD_VISION_MODEL` is separate from `TTD_MODEL`** — seeing is a different model from writing, so it is configured separately, and with it unset the route **refuses with exactly that reason** instead of pretending.
- **`/healthz` advertises `vision: true|false`**, so a client never has to guess.
- The log carries **timing and the model name only** — never the prompt, and never the image.

### The panel

`settings.visionEnabled` (env `VITE_APP_VISION_ENABLED`) gates the **Wireframe to code** entry: without a vision model the entry is **hidden**, because an offered feature that always errors reads as a defect. Configured, it appears.

### Verified

- **31 bridge tests** (up from 26), including: the request carries an `image_url` part with the exact data URL; the drawing's texts ride along; `hasImage` is false with no image; no `Authorization` without a key; and `readConfig` reports vision **unset by default**.
- **Live, against the real rail:**
  - with no vision model → `/healthz` says `vision:false`, and the route answers _"No vision model is configured for this bridge. Set TTD_VISION_MODEL…"_;
  - with `TTD_VISION_MODEL` set → **the image reached the model**, and llama.cpp answered **`image input is not supported - hint: … you may need to provide the mmproj`** — a vision-specific diagnostic, which means the request shape was accepted at the model layer, not rejected as malformed;
  - the error surfaced as a proper `ttdError` frame the panel renders, **not a hang**, and the log held only `{"event":"ttd-vision","ok":true,"ms":37,"firstDeltaMs":null,"model":"…"}`.

### A real bug found on the way, and fixed

`.env` **overrode the caller's environment**, the opposite of what every README in this repo promises — so `TTD_VISION_MODEL=… ./start.sh` was silently discarded in favour of an empty line in the file. `server/.env-loader.sh` now sets a key **only when the caller has not**, and both `ttd-bridge/start.sh` and `collab/start.sh` use it. Verified: `/healthz` flipped from `vision:false` to `vision:true` the moment the caller could win.

### Not verified — a hardware limit, measured

**No vision-capable model can be served on this machine as it stands.** The eGPU is detached, so the only GPU is the internal RTX 3050 Ti with **4096 MiB, 3421 MiB in use, 348 MiB free**; every vision-capable entry in the model registry needs ≥ 6000 MiB, and the 4 GB-sized variants (`4b-local`, `lfm`, `35b-local`) deliberately ship **without** an `mmproj` projector because it does not fit. `llama-igpu` never passes `--mmproj` at all.

So a successful **generation** is owed on a machine with a vision model — the eGPU attached, or a model small enough to carry its projector. The transport is proven; the hardware is not there.
