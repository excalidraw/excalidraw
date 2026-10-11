# feature-0023-uw-converse-before-drawing-and-let-the-model-act

**Type** feature · **Status** open · **Risk** high · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** the panel is a **one-shot generator**. A prompt produces Mermaid, the Mermaid is inserted, and that is the whole loop. So a user cannot refine ("not like that — put the database on the left"), the model never sees the board it is being asked about ("add a queue before the API" returns only the queue), and every change after generation is manual. **Expected:** a **conversation with the board in view**, and a model that can **act** on the scene through a small, named set of skills — with everything it proposes seen before it is applied.

## Impact

**Affected:** every user of the AI panel; this is the difference between a generator and a collaborator. **Risk if not built:** the AI is a parlour trick beside a drawing tool, and the manual work of turning its output into a real diagram stays with the person.

## Architecture intent

**Converse → propose → consent → apply.** Three layers, and the order is the design: the conversation can see, the skills can change, and **nothing changes unseen**.

### Why tools rather than a better prompt

A prompt can only describe; a **tool** can read.

| Ask | Today | With skills |
| --- | --- | --- |
| "what is on the board?" | impossible | _read the scene_, summarised |
| "add a queue before the API" | a fresh diagram, losing everything else | _read_, then _add one element_ |
| "tidy this into a grid" | a description of a grid | _lay out the selection_ |
| "make the boxes the same width" | the same, if the model guesses | _set width on these elements_ |

A tool call is also **auditable**: "the model changed seven elements" is a fact; "the model said it changed seven elements" is not.

### The six skills, in the order they earn their place

```
skills[6]{skill,reads,changes,risk}:
  "scene.read","the whole scene — a summary plus elements","nothing","none"
  "scene.inspect","one element or a selection, in detail","nothing","none"
  "scene.add","—","new elements","medium — additive, and undoable"
  "element.update","the elements it names","those elements' fields","medium"
  "selection.layout","the selection's bounds","positions","low"
  "scene.screenshot","the board as an image","nothing","none — this is what a vision model needs"
```

**Everything starts read-only.** A `scene.read` that works is worth more than an `element.update` that misfires, and it is the tool every other one depends on.

### The shape of a changing turn

1. The model **proposes**: a tool call rendered as a sentence — _"Add a rectangle labelled 'Queue' above 'API'?"_ — naming the elements it would touch.
2. The person **accepts or refuses**, per proposal or for the turn.
3. Only then is it **applied**, as a normal undoable action: one turn is one undo.

### The order of work

```
order[5]{step,why_first}:
  "1 — the ACTIVE model","nothing here can be tested while models[0] is the only choice (feature-0020)"
  "2 — scene.read","what every other tool and every honest conversation depends on; changes nothing, so it ships alone"
  "3 — the conversation","a real multi-turn chat with the scene in view, still generating only on request"
  "4 — scene.screenshot + vision","the vision route (feature-0015) has been missing something to read"
  "5 — proposals that change things","scene.add and element.update, behind consent, last — they are the only irreversible ones"
```

### Open questions, recorded rather than assumed

- **Do skills run in the browser or the bridge?** Browser: they reach the scene directly. Bridge: testable without one. Leaning **browser**, with the bridge carrying only the conversation.
- **How much of the scene is a prompt?** A large board will not fit. Summarise, and let `scene.inspect` fetch detail on demand.
- **Does the conversation persist, and is it shared?** Chat history already persists per browser. A _shared room's_ conversation is a separate decision and collides with `feature-0021`.

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
