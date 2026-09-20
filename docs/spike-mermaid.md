# Spike: `@excalidraw/mermaid-to-excalidraw` — diagram-type coverage

Date: 2026-09-20
Method: scratch Vite + React + TypeScript app, packages installed fresh (not from docs/memory), five mermaid samples run through `parseMermaidToExcalidraw` in a live browser, output read back from the DOM and console via a headless-browser session against the running dev server. Screenshot evidence attached.

## Versions installed

| Package | Version |
|---|---|
| `@excalidraw/excalidraw` | 0.18.1 |
| `@excalidraw/mermaid-to-excalidraw` | 2.2.2 |
| `mermaid` (transitive) | 11.17.2 |
| `react` / `react-dom` | 19.2.8 (npm installed react 19 by default; excalidraw's peer range flagged `ERESOLVE` warnings on install — not fatal, but confirm the target app pins a react version excalidraw officially supports before relying on this) |

**Mermaid is pulled in as a transitive dependency** — it is not a peer dependency you install yourself. It resolved to 11.17.2 without any manual pinning.

## Results table

| Diagram type | Parsed OK | Element count | Files map | Needed separate `convertToExcalidrawElements`? | Element shape returned | Console errors |
|---|---|---|---|---|---|---|
| `flowchart TD` | yes | 10 | empty | yes | native (`groupIds`, `id`, `label`, `link`, `strokeWidth`, `type`, `width`, `x`, `y`) | none |
| `flowchart LR` | yes | 5 | empty | yes | native, same shape as above | none |
| `mindmap` | yes | **1** | **non-empty (1 file)** | yes (no-op on a 1-element image) | image element (`fileId`, `height`, `status`, `type`, `width`, `x`, `y`) | none |
| `classDiagram` | yes | **1** | **non-empty (1 file)** | yes (no-op) | image element, same shape as mindmap | **yes** — internal parse errors, see below |
| `sequenceDiagram` | yes | 8 | empty | yes | native (`backgroundColor`, `fillStyle`, `id`, `label`, `strokeColor`, `strokeStyle`, `strokeWidth`, `type`, `width`, `x`, `y`) | none |

`classDiagram` threw internally during parsing but the call still resolved successfully:

```
Error processing Mermaid diagram: Error: DOM Node with id classId-Animal-0 not found
    at parseClasses (@excalidraw_mermaid-to-excalidraw.js:3876)
    at parseMermaidClassDiagram (@excalidraw_mermaid-to-excalidraw.js:4240)
```

It did not crash — it silently fell back to the flat-image path. That fallback is doing double duty: it's both "this diagram type isn't natively supported" and "this diagram type is nominally supported but broke on this input." From the caller's side those two cases are indistinguishable without inspecting element shape.

## Q1 — Which types convert to real elements?

**Native, editable elements:** flowchart (both `TD` and `LR`), sequence diagram.
**Flat image only:** mindmap, class diagram — in this installed version, neither produces discrete Excalidraw shapes. Both come back as a single image element wrapping a rendered SVG.

## Q2 — Is a non-empty `files` map a reliable signal of "flat image, not editable"?

Yes, and it's corroborated by a second, independent signal: element shape. Every image-fallback result had `elementCount === 1` and that one element's keys were `fileId`/`height`/`status`/`type`/`width`/`x`/`y` — the canonical Excalidraw image-element schema, with no `id`/`version`/`groupIds`/`label` that native shape elements carry. Every native-element result had `files` empty and elements carrying `label`/`groupIds`/`strokeWidth`.

Recommendation: don't gate on `files` alone. Check `files` non-empty **and** `elementCount === 1` **and** the element's `type === "image"`. Belt-and-suspenders, and it also catches a theoretical case where a diagram degenerates to one real shape plus no image (files-empty but count 1) without falsely flagging it as an image fallback.

## Q3 — Does `convertToExcalidrawElements` still need to be called separately?

Yes. `parseMermaidToExcalidraw` returns a skeleton form — none of the returned elements had `version`, `versionNonce`, or `seed`, which real scene elements require. Every sample needed a separate `convertToExcalidrawElements` call to get scene-ready elements before they could go into `updateScene`. This is not a version-specific quirk to route around — it's a required two-step pipeline: `parseMermaidToExcalidraw → convertToExcalidrawElements → updateScene`. `insertDiagram.ts`'s stubbed shape (mermaid → skeleton → elements → scene) is correct as specified.

## Q4 — Mind map: mermaid `mindmap` vs. `flowchart LR` radiating from a centre node

Screenshot: `docs/spike-mermaid-screenshot.jpg` (both canvases, full page).

- **Mermaid `mindmap` type**: renders visually — colored nodes, hand-drawn-style labels, looks like a real diagram at a glance. But it is one embedded image element (confirmed above), not editable Excalidraw shapes. A user cannot select "Branch A" individually, restyle it, drag one leaf, or delete one node — the whole diagram moves/resizes as a single blob. This fails the core value prop of an Excalidraw-native diagram.
- **`flowchart LR` radiating from a centre node**: renders as fully native elements — a circle labeled "Central Idea," rectangles for branches/leaves, individual arrows. Confirmed editable (native element shape, 0 files). Visually it's plainer (rectangles + arrows, not organic mind-map styling), but every node is a real, independently selectable Excalidraw element.

## Recommendation

**Do not route the mind-map template through mermaid's native `mindmap` type.** In this installed version it degrades to a flat image and directly contradicts the "removing a decision, not adding a decision" framing for templates — a template that produces an uneditable blob is worse than no template.

Build mind map on the `flowchart LR`-radiating-from-centre-node path instead (or an equivalent direct-to-skeleton-elements layout function, bypassing mermaid's `mindmap` grammar entirely). This confirms the concern flagged in the implementation plan: `insertDiagram.ts` needs a per-template-type branch, not one blind `mermaid → elements` pipe for all four templates. Concretely:

- Flowchart, process flow, org chart templates: mermaid `flowchart` (or a mermaid `graph`/`classDiagram`-free equivalent) → `parseMermaidToExcalidraw` → `convertToExcalidrawElements`. Straightforward, already proven native above.
- Mind map template: either (a) generate mermaid constrained to `flowchart LR` under the hood with the app's own radial/centre-node prompt scaffold (reuses the same pipeline, no separate code path), or (b) skip mermaid for this one template and build a small direct layout function in `insertDiagram.ts` that places a centre node and radiates children as native Excalidraw elements. (a) is less work and should be tried first since it reuses the whole existing pipeline unchanged.

Also carry this into `enforceHeader.ts`: since class diagrams silently degrade to a broken-then-fallback image in this version, if any future template maps to `classDiagram`, treat it the same as mind map — don't trust the mermaid type name alone, verify the returned element shape before accepting the result as "diagram inserted successfully."
