# Enforce Region and Subnet Vertical Bands

## Objective

Replace opportunistic vertical sharing at key topology levels with deterministic hierarchy bands.

Regions must always be pushed downward into distinct global vertical bands. Subnet zones must always stack vertically within their owning VPC. Compact horizontal packing must remain available inside each subnet and between non-overlapping VPCs.

## Intended Behavior

- Providers under the root occupy distinct vertical bands.
- Accounts under a provider occupy distinct vertical bands.
- Regions under an account occupy distinct vertical bands.
- Together, provider/account/region stacking ensures that every region is globally isolated in its own vertical band.
- Subnet zones within the same VPC occupy distinct vertical bands.
- Subnet zones belonging to different VPCs may reuse a vertical band when their VPC hulls remain disjoint.
- Primary clusters within a subnet zone retain compact horizontal packing.
- VPCs within a region retain horizontal-overlap-based vertical packing.
- Region-level resources without a VPC retain horizontal-overlap-based vertical packing.
- Increased scene height is acceptable when required to eliminate overlap and interleaving.

## Packing Changes

1. Add an explicit topology role to packed tree nodes.
2. Select each child's placement policy from its parent topology role.
3. Force unconditional vertical stacking for:
   - providers under the root;
   - accounts under a provider;
   - regions under an account;
   - subnet zones under a VPC.
4. Retain horizontal-overlap-based vertical packing for:
   - VPCs within a region;
   - primary clusters within a subnet zone;
   - region-level resources without a VPC.
5. Order every forced stack deterministically by:
   1. minimum descendant TFD sequence;
   2. stable topology key as the tie-breaker.
6. Use full title-aware collision hull heights when advancing each vertical band.
7. Keep the hierarchy post-pass limited to:
   - global normalization;
   - local-coordinate stamping.
8. The hierarchy post-pass must not alter packed relative positions.

## Collision Diagnostics

Replace the sibling-only collision check with final-scene collision checks.

The final-scene checks must distinguish:

- region-region rectangle or title collisions;
- subnet-subnet collisions within the same VPC;
- frame-title collisions with primary-cluster rectangles;
- other non-ancestor topology-frame collisions.

Ancestor containment is valid and must be excluded from overlap counts.

The v2 diagnostic must report, for every collision:

- colliding frame IDs;
- topology roles;
- topology keys;
- parent topology keys;
- collision category.

## Required Tests

Add or update tests to verify:

- Every region occupies a distinct vertical band across all providers and accounts.
- Subnet-zone siblings within one VPC occupy distinct vertical bands.
- Subnet zones in different VPCs may reuse a band when their VPC hulls remain disjoint.
- Primary clusters within one subnet still use compact horizontal packing.
- Compact Compound layouts have no:
  - region collisions;
  - subnet collisions;
  - frame-title collisions;
  - non-ancestor topology collisions.
- Full Compound layouts have no:
  - region collisions;
  - subnet collisions;
  - frame-title collisions;
  - non-ancestor topology collisions.

Preserve existing behavior and coverage for:

- strict left-to-right TFD ordering;
- dependency closure;
- deterministic repeated runs;
- packing-factor behavior;
- cycle fallback;
- Classic layout stability.

## Verification

Run the relevant unit and integration tests for Compound and Classic layouts.

Re-run `staging-extended-localstack-v2` and require:

- zero reported collisions;
- zero TFD ordering violations.

## Implementation Constraints

- Treat "pushed back" as moved downward into a separate vertical band.
- Region isolation is global and is achieved through forced provider/account/region stacking.
- Subnet isolation applies only within each owning VPC.
- Do not remove compact horizontal packing where it is explicitly retained.
- Do not let the hierarchy post-pass repair or rearrange packed relative positions.
- Keep ordering deterministic across repeated runs.

## Definition of Done

The task is complete when:

1. Packing policy is selected by explicit topology role.
2. Providers, accounts, regions, and same-VPC subnet zones use deterministic forced vertical stacks.
3. Retained compact-packing cases continue to pack horizontally when possible.
4. Final-scene diagnostics classify collisions and ignore valid ancestor containment.
5. All required tests pass.
6. `staging-extended-localstack-v2` reports zero collisions and zero TFD ordering violations.

---

## Repository Context

### Workspace State

- Repository root: `/Users/tusharsariya/Projects/excalidraw-tf`
- Current branch when this handoff was written: `terraform-feature`
- Base Compound-layout commit visible in history:
  - `9efad6145 Add compound pipeline layout with TFD co-layout and hierarchical group drag.`
- The worktree is heavily modified and contains untracked files from the current Compound packing work.
- Do **not** reset, discard, or overwrite unrelated changes.
- In particular, `terraformPipelineLayoutPacked.ts` and its test are currently untracked but are active implementation files used by the modified builders.

Run this before editing:

```bash
git status --short
git diff --stat
```

The files already modified or added for the current packing implementation include:

```text
packages/excalidraw/components/terraformPipelineLayout.ts
packages/excalidraw/components/terraformPipelineLayoutCompound.ts
packages/excalidraw/components/terraformPipelineLayoutCompoundHierarchy.ts
packages/excalidraw/components/terraformPipelineLayoutPacked.ts
packages/excalidraw/components/terraformPipelineLayoutPacked.test.ts
packages/excalidraw/components/terraformPipelineTopologyFrames.ts
packages/excalidraw/components/terraformPipelineTopologyGeometry.ts
packages/excalidraw/components/terraformPipelineLaneDebug.test.ts
packages/excalidraw/components/terraformPipelineLayout.test.ts
packages/excalidraw/components/terraformPipelineLayoutCompound.test.ts
packages/excalidraw/components/terraformPipelinePackingOptions.ts
```

### Existing Deep Reference

Read this before implementation:

```text
docs/pipeline-compound-layout-agent-handoff.md
```

It documents the import flow, TFD-first design, frame hierarchy, Compound post-pass, and existing invariants. Some statements about packing being unimplemented are stale because the current worktree already contains a packed layout implementation.

## Current Architecture

### Layout Routing

`packages/excalidraw/components/terraformLayoutCore.ts`

- `pipelineLayoutVariant === "compound"` selects `buildTerraformCompoundPipelineExcalidrawScene`.
- Otherwise the Classic builder is selected.
- `pipelinePacked` and `pipelinePackingMaxColumnFactor` are forwarded to the selected builder.

### Shared Preparation

`packages/excalidraw/components/terraformPipelineLayoutShared.ts`

Important types and values:

```typescript
type PipelineCluster = {
  id: string;
  primaryAddress: string;
  firstSequence: number;
  depth: number;
  placement: PipelinePlacement;
  build: PipelinePrimaryClusterBuildResult;
};
```

```text
PIPELINE_MARGIN = 50
PIPELINE_FRAME_PAD = 28
PIPELINE_COLUMN_GAP = 150
PIPELINE_CLUSTER_GAP_Y = 36
PIPELINE_LANE_GAP_Y = 96
```

`preparePipelineLayout()`:

- collapses TFD endpoints into primary clusters;
- records each cluster's minimum TFD sequence as `firstSequence`;
- computes strict left-to-right dependency depths;
- builds compact or full primary-cluster skeletons;
- attaches topology placement metadata.

Use `cluster.firstSequence` as the minimum descendant TFD sequence for leaf clusters. For a topology node, compute the minimum over all descendant clusters.

### Topology Paths and Roles

`packages/excalidraw/components/terraformPipelineTopologyFrames.ts`

Existing roles:

```typescript
type TopologyFrameRole =
  | "subnetZone"
  | "vpc"
  | "region"
  | "account"
  | "provider";
```

`topologyPathForCluster(cluster)` returns:

```text
[provider]
[provider, account]
[provider, account, region]
[provider, account, region, vpc]
[provider, account, region, vpc, subnetSignature]
```

`topologyRoleAndKeyFromPath(path)` already maps path length to a stable role and topology key.

Primary clusters are synthetic leaves below the deepest applicable topology node. Their role should be represented explicitly as `"primaryCluster"`. The synthetic root should also have an explicit role such as `"root"`.

### Current Packed Tree

`packages/excalidraw/components/terraformPipelineLayoutPacked.ts`

The current implementation:

1. Builds a topology tree with `buildPackedTree()`.
2. Adds one synthetic primary-cluster leaf per `PipelineCluster`.
3. Recursively packs every node with `packNode()`.
4. Sorts children by width, then height, then key.
5. Places a child lower only when its hull horizontally overlaps an already placed sibling.
6. Uses `topologyFrameCollisionHull()` so topology-frame titles are included in packed hulls.
7. Scores candidate depth promotions by collision count, scene height, topology hull heights, area, width, edge span, promotion distance, and stable key.
8. Searches bounded extra TFD columns while preserving dependency closure.

The current `PackedTreeNode` does **not** store a role. Add one.

The current `countCollisions()` checks only sibling hulls in the packed tree. This is insufficient and is the diagnostic behavior that must be replaced.

### Current Compound Builder

`packages/excalidraw/components/terraformPipelineLayoutCompound.ts`

Current flow:

```text
preparePipelineLayout
→ placeClustersHierarchicalPacked, unless disabled or cyclic
→ buildCompoundFramesFromLayoutBoxes
→ applyCompoundHierarchicalLayout
→ appendPipelineEdgeSkeletons
→ assignCompoundEdgeFrameParents
→ convertPipelineSkeletonToElements
```

Compound defaults to packed placement unless:

- `pipelinePacked: false`; or
- the collapsed TFD graph contains a cycle.

Cycle fallback must remain intact.

### Current Hierarchy Post-Pass

`packages/excalidraw/components/terraformPipelineLayoutCompoundHierarchy.ts`

`applyCompoundHierarchicalLayout()` currently:

1. computes one global translation from provider-frame minimum X/Y to `PIPELINE_MARGIN`;
2. applies that same translation to the entire skeleton and all layout boxes;
3. stamps `terraformCompoundLocal` metadata recursively.

This is the intended behavior. Do not reintroduce provider-by-provider or subtree-by-subtree repositioning here. Relative packed positions must remain unchanged.

### Title-Aware Geometry

`packages/excalidraw/components/terraformPipelineTopologyGeometry.ts`

Use the existing helpers:

```typescript
topologyFrameRectangleFromChildHull(childHull);
topologyFrameCollisionHull(frame);
unionTopologyHulls(boxes);
```

`topologyFrameCollisionHull(frame)` extends the frame upward by:

```typescript
PIPELINE_FRAME_TITLE_HEIGHT =
  FRAME_STYLE.nameFontSize * FRAME_STYLE.nameLineHeight +
  FRAME_STYLE.nameOffsetY;
```

Forced-band advancement must use the full collision hull, including title height.

## Exact Packing Policy

Select the child-placement policy from the **parent role**, not from the child role.

| Parent role | Children being placed | Policy |
| --- | --- | --- |
| `root` | providers | forced vertical stack |
| `provider` | accounts | forced vertical stack |
| `account` | regions | forced vertical stack |
| `region` | VPCs and region-level primary clusters | overlap-aware compact packing |
| `vpc` | subnet zones and VPC-direct primary clusters | subnet zones must be forced apart; preserve compact behavior for any direct primary clusters |
| `subnetZone` | primary clusters | overlap-aware compact packing |

The VPC case requires care because a VPC can potentially contain both subnet-zone frames and direct primary-cluster leaves. The required invariant is:

- every pair of subnet-zone children in one VPC occupies a distinct vertical band;
- primary clusters inside one subnet remain compact;
- do not unnecessarily prevent different VPCs from reusing the same Y band.

A conservative implementation is to make the VPC child-placement policy role-aware:

- subnet-zone children advance the forced vertical cursor unconditionally;
- any VPC-direct primary-cluster children remain collision-aware but cannot overlap a forced subnet-zone hull.

For every forced stack:

1. Sort children by minimum descendant `firstSequence`.
2. Tie-break by stable topology key.
3. Place the first child at its packed local Y.
4. Place each later child below the prior forced band using the complete title-aware child hull plus `PIPELINE_CLUSTER_GAP_Y`.
5. Translate all descendant positions and hulls by the same delta.

Do not sort forced stacks by width or height. Width/height ordering may remain for compact overlap-aware packing if needed, but deterministic TFD/key ordering is preferable wherever it does not regress compactness.

Suggested node shape:

```typescript
type PackedTreeRole = "root" | TopologyFrameRole | "primaryCluster";

type PackedTreeNode = {
  key: string;
  role: PackedTreeRole;
  level: number;
  minDescendantSequence: number;
  clusters: PipelineCluster[];
  children: PackedTreeNode[];
  cluster?: PipelineCluster;
};
```

## Collision Diagnostic Specification

### Current Limitation

`terraformPipelineLaneDebug.test.ts` currently computes `collisionCount` by comparing only topology frames with the same immediate `frameId`. It reports a number but not collision details.

That check can miss:

- regions under different accounts/providers;
- frame titles intersecting primary-cluster rectangles;
- non-sibling, non-ancestor topology-frame collisions;
- collisions introduced after final frame construction or normalization.

### Final-Scene Inputs

Run collision checks on converted final scene elements, not only intermediate packed-tree hulls.

Relevant final element metadata:

```text
element.id
element.frameId
customData.terraformTopologyRole
customData.terraformTopologyKey
customData.terraformTopologyPath
customData.terraformPrimaryAddress
```

Build an ID map and ancestry helper from `frameId`, or use topology paths for topology frames. Exclude valid ancestor/descendant topology-frame containment from overlap counts.

### Geometry

Use strict rectangle overlap:

```typescript
a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;
```

Touching edges are not collisions.

For topology frames, distinguish:

- frame rectangle: `{ x, y, width, height }`;
- frame title rectangle: `{ x, y: y - titleHeight, width, height: titleHeight }`;
- full title-aware hull: rectangle plus title area.

Primary-cluster collision checks use the primary-cluster frame rectangle, not every nested resource/card rectangle.

### Required Categories

Return collision records, not only a count. Suggested record:

```typescript
type FinalSceneCollision = {
  category:
    | "region-region"
    | "same-vpc-subnet-subnet"
    | "frame-title-primary-cluster"
    | "non-ancestor-topology-frame";
  a: {
    id: string;
    role: string;
    key: string | null;
    parentKey: string | null;
  };
  b: {
    id: string;
    role: string;
    key: string | null;
    parentKey: string | null;
  };
};
```

Classification:

1. `region-region`
   - Any two distinct region frames whose full title-aware hulls overlap.
   - Check globally across providers and accounts.
2. `same-vpc-subnet-subnet`
   - Any two subnet-zone frames with the same VPC parent whose full title-aware hulls overlap.
3. `frame-title-primary-cluster`
   - Any topology-frame title rectangle overlapping a primary-cluster frame rectangle.
   - Count this even when the primary cluster is a descendant of that frame; title space is not valid content space.
4. `non-ancestor-topology-frame`
   - Any other pair of topology frames whose full title-aware hulls overlap and neither frame is an ancestor of the other.

Avoid double-reporting a pair in both a specific and generic category. Prefer the first applicable category in the order above.

The v2 report should include:

```text
packingDiagnostics.collisionCount
packingDiagnostics.collisions
packingDiagnostics.collisionsByCategory
semanticEdgeViolations
```

## Test Implementation Guidance

### Low-Level Packing Tests

Primary file:

```text
packages/excalidraw/components/terraformPipelineLayoutPacked.test.ts
```

The existing helper currently hardcodes one account and region and accepts only `vpcId`. Extend it to accept a full placement override, including:

```text
providerFamily
accountId
region
vpcId
subnetSignature
subnetTier
firstSequence
```

Add helpers for:

- retrieving a packed cluster frame box from `layoutBoxes`;
- retrieving topology frame boxes from the final scene when testing frame behavior;
- checking whether two vertical bands overlap:

```typescript
const verticalBandsOverlap = (a, b) =>
  a.y < b.y + b.height && b.y < a.y + a.height;
```

Required low-level cases:

1. Regions under different accounts/providers never share a vertical band.
2. Two subnet zones in one VPC never share a vertical band.
3. Subnet zones in different VPCs may share a vertical band when VPC hulls are horizontally disjoint.
4. Two primary clusters in one subnet can remain on the same vertical band when horizontally disjoint.
5. Forced-stack order follows `firstSequence`, then topology key.
6. Repeated runs return identical depths and positions.
7. Dependency closure and horizon rejection still work.

### Scene-Level Compound Tests

Primary files:

```text
packages/excalidraw/components/terraformPipelineLayout.test.ts
packages/excalidraw/components/terraformPipelineLayoutCompound.test.ts
```

Add compact and full Compound fixtures with multiple:

- providers;
- accounts;
- regions;
- VPCs;
- subnet signatures;
- primary clusters per subnet.

For each fixture:

- build the scene twice and compare relevant geometry;
- assert every declared TFD edge remains strictly left-to-right;
- run the final-scene collision classifier and expect no collisions;
- assert region vertical bands are globally disjoint;
- assert same-VPC subnet vertical bands are disjoint;
- assert a deliberately horizontally separated pair of VPCs can reuse a subnet Y band;
- assert primary clusters within one subnet use compact horizontal packing.

Do not weaken existing tests for:

- packed default and explicit opt-out;
- cycle fallback;
- packing-factor clamping;
- deterministic runs;
- Classic pixel stability;
- Classic/Compound role-chain parity;
- cross-provider and cross-region arrow parenting.

### Staging Diagnostic

Primary file:

```text
packages/excalidraw/components/terraformPipelineLaneDebug.test.ts
```

Important correction: `diagnosePreset()` currently passes `pipelinePacked`, but it does **not** pass:

```typescript
pipelineLayoutVariant: "compound";
```

Therefore the current staging packed test exercises the Classic builder with optional packing, not the Compound builder requested by this plan. Update the v2 acceptance path so it explicitly exercises Compound.

The current v2 diagnostic's sibling-only `collisionCount` must be replaced with the final-scene categorized diagnostic described above.

The final staging assertion must require:

```typescript
expect(report.semanticEdgeViolations).toEqual([]);
expect(report.packingDiagnostics.collisionCount).toBe(0);
expect(report.packingDiagnostics.collisions).toEqual([]);
```

Height will increase after forced region bands. Existing packed height budget assertions may need to be replaced with behavior-focused assertions. Do not preserve the old height ceiling at the cost of collisions.

## Known Baseline Before This Change

The following focused tests passed before implementing forced bands:

```bash
yarn vitest run \
  packages/excalidraw/components/terraformPipelineLayoutPacked.test.ts \
  packages/excalidraw/components/terraformPipelineLayoutCompound.test.ts \
  packages/excalidraw/components/terraformPipelineLayout.test.ts
```

Result:

```text
3 test files passed
23 tests passed
```

The existing staging packed diagnostic also passed:

```bash
VITEST_TERRAFORM_VERBOSE=1 yarn vitest run \
  packages/excalidraw/components/terraformPipelineLaneDebug.test.ts \
  -t "staging-extended-localstack-v2 — packed layout meets height and width budget"
```

Observed baseline:

```text
stacked height: 18583.5
stacked width: 8038
packed height: 10035
packed width: 9442
semantic edge violations: 0
sibling-only reported collisions: 0
```

These collision results are not sufficient because the current checker is sibling-only and the test did not explicitly request Compound.

## Verification Commands

Start with focused tests:

```bash
yarn vitest run \
  packages/excalidraw/components/terraformPipelineLayoutPacked.test.ts \
  packages/excalidraw/components/terraformPipelineLayoutCompound.test.ts \
  packages/excalidraw/components/terraformPipelineLayout.test.ts
```

Run the staging diagnostic:

```bash
VITEST_TERRAFORM_VERBOSE=1 yarn vitest run \
  packages/excalidraw/components/terraformPipelineLaneDebug.test.ts \
  -t "staging-extended-localstack-v2"
```

Then run related regressions:

```bash
yarn vitest run \
  packages/excalidraw/components/terraformPipelinePackingOptions.test.ts \
  packages/excalidraw/components/terraformSceneApply.test.ts \
  packages/excalidraw/components/TerraformImportDialog.test.tsx
```

Finally run:

```bash
yarn test:typecheck
npx prettier --write \
  REGION_SUBNET_VERTICAL_BANDS_PLAN.md \
  packages/excalidraw/components/terraformPipelineLayoutPacked.ts \
  packages/excalidraw/components/terraformPipelineLayoutPacked.test.ts \
  packages/excalidraw/components/terraformPipelineLaneDebug.test.ts
```

Do not use `yarn prettier --write <files>` for scoped formatting in this repository. The `prettier` package script expands its own repository-wide glob and ignores the intended scope. Use `npx prettier --write <files>` instead. Do not run broad formatting over the repository because the worktree contains unrelated user changes.

## Implementation Sequence

1. Read the current dirty-worktree files and preserve existing changes.
2. Add explicit roles and minimum descendant sequence to packed tree nodes.
3. Refactor `packNode()` to select placement policy from the parent role.
4. Implement deterministic forced stacks for root/provider/account and subnet zones under VPC.
5. Preserve overlap-aware compact packing for region children and subnet primary clusters.
6. Keep `applyCompoundHierarchicalLayout()` normalization-only.
7. Add low-level role-policy and band tests.
8. Implement reusable final-scene categorized collision diagnostics.
9. Add compact and full Compound scene collision tests.
10. Update the staging v2 diagnostic to explicitly request Compound.
11. Run focused tests, staging diagnostic, related regressions, typecheck, and scoped formatting.

## Common Failure Modes

- Sorting forced stacks by hull size instead of minimum descendant TFD sequence.
- Using frame rectangle height but forgetting title height when advancing a band.
- Globally forcing all VPCs or all subnet zones, preventing valid band reuse between disjoint VPCs.
- Treating ancestor containment as a collision.
- Ignoring a parent frame title that overlaps its own primary-cluster descendant.
- Repositioning packed subtrees again in `applyCompoundHierarchicalLayout()`.
- Breaking strict left-to-right dependency closure while promoting clusters.
- Testing packed Classic while assuming the diagnostic exercised Compound.
- Resetting or replacing the current uncommitted packing implementation.

## Layout Research Note

The local graph-layout RAG corpus was queried for compound/nested separation constraints. The relevant practical takeaway is to model forced bands as explicit vertical separation constraints while retaining compact placement where no such constraint exists. The current task does not require introducing a general constraint solver; deterministic role-based stacking is the scoped implementation.
