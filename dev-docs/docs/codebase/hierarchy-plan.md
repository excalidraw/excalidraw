## Excalidraw Hierarchical Model Plan

### Background & Goals

Introduce a fully in-memory hierarchical (tree) model on top of the existing flat `elements[]` storage for more efficient complex operations (queries, selection, collision), while keeping flat arrays as the persistence/collab projection. Gradually move to tree-first edits with flat projection.

### Capabilities To Preserve

- z-index via fractional indices
- add/remove to frame
- group/ungroup
- bound texts (containerId)
- arrow bindings (start/endBinding)
- history (undo/redo) and collab (delta broadcast)
- load/save the flat array

### Existing Reusable Capabilities

- Deltas & History: `element/src/delta.ts` (ElementsDelta/AppStateDelta/StoreDelta), `excalidraw/history.ts` (HistoryDelta), auto rebind, text bbox redraw, z-index normalization.
- Store & Snapshot: `element/src/store.ts` provides commit levels, batching, and delta emission.
- Scene & Relationships: `element/src/Scene.ts`, `element/src/frame.ts`, `element/src/groups.ts` for frames and groups logic.
- Rendering: `excalidraw/renderer/staticScene.ts` with order by fractional index.
- Restore/Import: `excalidraw/data/restore.ts`.

### Data Model & Invariants

- Node types: `ElementNode`, logical `GroupNode` (id=groupId), `FrameNode` (bound to frame element). `Table*Node` reserved.
- Parent priority: container > group (deep→shallow) > frame > root; single parent per node.
- Groups must not span multiple frames.
- Drawing order remains by fractional index; the tree offers structural and sibling-order views only.

### Flat→Tree Build (`buildFromFlat`)

- Input: `elements[]`/`elementsMap` (optionally including deleted).
- Output: `{ nodesById, roots, orderHints, diagnostics }`.
- Rules:
  - Bound text attaches to its container; groups form deep→shallow parent chains from `groupIds`; frame parent from `frameId`; otherwise root.
  - Sibling order: ascending by the minimum `index` across the node’s represented elements.
  - Diagnostics: cross-frame groups, invalid container, cycles, missing refs (error/warn).

### Tree → Flat Projection (`flattenToArray`)

- Input: tree, optional "apply recommended reorder".
- Output: `{ nextFieldsByElementId, reorderIntent? }`.
- Rules:
  - `frameId` from nearest frame ancestor; `groupIds` nearest→farthest; `containerId` from nearest container.
  - Do not change draw order by default; any reordering is applied by the caller via `Scene.insert*` and `syncMovedIndices`.

### Operations Mapping (Tree edits → Flat deltas)

- z-index: sibling reordering → index deltas; normalized with `syncMovedIndices`.
- Frame membership: reparent to `FrameNode`/root → `frameId` updates; cross-frame groups disallowed.
- Group/ungroup: modify `GroupNode` structure → update `groupIds` chains.
- Bound text: reparent to container → update `containerId`/`boundElements`; text bbox redraw handled by `ElementsDelta`.
- Arrow binding: does not change parentage; only update start/endBinding; `ElementsDelta` handles rebind/unbind.

### History & Collab

- Transactional edits on the tree via `HierarchyManager.begin/commit/rollback`; commit projects to a minimal flat diff, wrapped as `StoreDelta`, and submitted via `Store.scheduleMicroAction` (IMMEDIATELY).
- Undo/redo uses `HistoryDelta`; replay re-emits flat deltas for sync.
- Collab remains flat-delta based; peers rebuild the tree deterministically from flats.

### Rendering Strategy

- Add a tree-backed rendering adapter beside `renderStaticScene` behind a feature flag, preserving draw-order semantics (fractional index). In the short term, use the tree for selection/collision pruning (frame → group → element).

### Challenges & Risks

- Cross-frame group handling (block or guided fix).
- Reorder consistency (tree sibling order vs fractional index).
- Collab conflicts (use `ElementsDelta.applyLatestChanges`).
- Performance (build O(n), queries O(1)/O(k)); cache/incremental via `sceneNonce`.
- Test coverage (round-trip, collab equivalence, history replay, deep groups/large frames/binding chains).

### Phased Plan

- Phase 0 Rules & Contracts
  - Lock invariants and priorities; define diagnostics (error/warn).
- Phase 1 Pure functions & Validation
  - Implement `buildFromFlat`, `flattenToArray`, `validateIntegrity`; cache by `sceneNonce`; add round-trip tests.
- Phase 2 Read-only integration
  - Tree-backed selection and collision pruning; measure wins.
- Phase 3 Parallel render adapter
  - Tree render adapter (flag) with preserved order semantics.
- Phase 4 Projection & Transactions
  - `HierarchyManager.begin/commit/rollback`; commit→`StoreDelta`→Store.
- Phase 5 Migrate operations
  - Frame membership and group/ungroup → tree+projection; then bound text; optional z-index reorder intent.
- Phase 6 Extensions & Tables
  - Introduce `Table*Node` (in-memory first, then projection), with validation and UI.

### Success Criteria

- Correctness: same flat → same tree; unchanged structure round-trip no-ops; existing operations equivalent.
- History/Collab: still record and broadcast minimal flat deltas; deterministic tree on peers.
- Performance: selection/collision candidate reduction on large scenes; build/query latency targets met.
- Rollback: feature flag to fall back to legacy path at any time.

### Next Steps

- Finalize invariants and IO contracts; implement `buildFromFlat`/`flattenToArray` and `validateIntegrity`; add round‑trip and failure-case tests; prototype read-only integration and render adapter.
