# feature-0023-uw-converse-before-drawing-and-let-the-model-act

**Type** feature · **Status** open · **Risk** high · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** the panel is a **one-shot generator**. A prompt produces Mermaid, the Mermaid is inserted, and that is the whole loop. So a user cannot refine ("not like that — put the database on the left"), the model never sees the board it is being asked about ("add a queue before the API" returns only the queue), and every change after generation is manual. **Expected:** a **conversation with the board in view**, and a model that can **act** on the scene through a small, named set of skills — with everything it proposes seen before it is applied.

## Impact

**Affected:** every user of the AI panel; this is the difference between a generator and a collaborator. **Risk if not built:** the AI is a parlour trick beside a drawing tool, and the manual work of turning its output into a real diagram stays with the person.

## Architecture intent

**Converse → propose → consent → apply.** Three layers, and the order is the design: the conversation can see, the skills can change, and **nothing changes unseen**.

Full reasoning, the skill list, the order of work and the open questions are in [`plans/03-talking-to-the-model.md`](../../../../../Documents/ymirhome/svartalfaheim/whynotproductions/projects/excalidraw/plans/03-talking-to-the-model.md).

## Requirements

- The panel supports a **multi-turn conversation**, and the model can be given **the board in view** (a summary, with detail fetched on demand — a large scene will not fit in a prompt).
- A **read-only** skill comes first: `scene.read` (summary) and `scene.inspect` (one element or a selection). Neither changes anything, so either can ship alone.
- Changing skills — `scene.add`, `element.update`, `selection.layout` — **propose** their change, naming the elements they would touch, and are applied **only** on the person's acceptance.
- An applied change lands as a **normal undoable action** in the history: one turn is one undo.
- **Refusal is a first-class outcome**, not an error.
- Every call still goes to **the user's own configured model** (`feature-0020`), through the bridge, under the same no-egress rule — the scene does not leave the client to be reasoned over.
- `scene.screenshot` exists so that `feature-0015`'s vision route finally has something to read.

## Constraints

- **No autonomy loop.** One turn, proposals, consent, done — never "edit until it looks right".
- Six skills, chosen and reviewed here; **no general plugin or tool-framework**.
- The conversation extends the **existing panel**; it does not become a second chat product.
- Skills run in the **browser**, where the scene is; the bridge carries the conversation only.

## Non-goals

Not an autonomous agent; not a general tool-calling framework; not shared or team memory (that collides with `feature-0021` and waits for it); not model fine-tuning.

## Test cases

- **Positive:** "what is on the board?" is answered from the scene, and the answer matches the scene.
- **Positive:** "add a queue before the API" proposes adding **one** element, names it, and on acceptance the rest of the board is untouched.
- **Negative:** a refused proposal changes **nothing** — checked by element version, not by reading the UI.
- **Negative:** a model that returns an unusable tool call produces a stated error, never a partial edit.
- **Compatibility:** the existing one-shot generation still works, and existing chat history still opens.

## Operations

**Rollout:** read-only skills first, then the conversation, then changing skills behind consent. **Observability:** every applied proposal is named with the elements it touched; a turn is one undo. **Rollback:** changing skills can be withheld entirely; the conversation and read-only skills stand alone.

## Resolution

_(filled on close)_
