import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { buildTerraformCompoundPipelineExcalidrawScene } from "./terraformPipelineLayoutCompound";
import { diagnosePipelineScene } from "./terraformPipelineCollisionDiagnostics";
import {
  preparePipelineLayout,
  translateSkeleton,
} from "./terraformPipelineLayoutShared";
import {
  appendPipelineEdgeSkeletons,
  convertPipelineSkeletonToElements,
  pipelineCycleWarnings,
} from "./terraformPipelineLayoutFinalize";
import {
  applyCompoundHierarchicalLayout,
  assignCompoundEdgeFrameParents,
} from "./terraformPipelineLayoutCompoundHierarchy";
import { appendCompoundTopologyFrameEdgeSkeletons } from "./terraformPipelineLayoutCompoundSiblingEdges";
import { buildCompoundFramesFromLayoutBoxes } from "./terraformPipelineTopologyFrames";
import { layeringStage } from "./terraformPipelineRcllLayering";
import {
  backwardEdgeGate,
  boxByKey,
  placementStage,
} from "./terraformPipelineRcllPlacement";
import {
  buildRcllModel,
  summarizeRcllModel,
} from "./terraformPipelineRcllModel";

import type {
  CollapsedPipelineEdge,
  PipelineLayoutPrep,
} from "./terraformPipelineLayoutShared";
import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformImportWarning } from "./terraformImportMerge";
import type {
  CompoundNode,
  Lattice,
  RcllOptions,
  Stage,
  StageResult,
} from "./terraformPipelineRcllTypes";

/**
 * Options accepted by the RCLL builder. Mirrors the shared `pipelineOptions`
 * object the layout core passes to every pipeline builder; M0 reads only
 * `compact` / `includeAncillary` and tolerates the rest (like the v2 builder).
 */
type RcllBuildOptions = {
  compact?: boolean;
  includeAncillary?: boolean;
  packed?: boolean;
  packedPullLeft?: boolean;
  semanticPlacement?: boolean;
  experimentalLayout?: boolean;
  /** DEC-1 (default true): X-disjoint cyclic SCC groups rise to share Y. */
  staircaseBandOverlap?: boolean;
  /** M4 (default false): X-disjoint swimlane lanes rise to share Y rows. */
  swimlaneLaneRise?: boolean;
  /** M6 (default false): per-container barycenter crossing-min reorder. */
  reorder?: boolean;
  /** M5 (default false): Brandes–Köpf leaf coordinate-assignment / straightening. */
  straighten?: boolean;
};

export type RcllPipelineStage = { name: string; stage: Stage };

/**
 * Ordered stage pipeline.
 *
 * - **layering (M2, Stage 1a)** writes `localColumn` per container (TFD precedence
 *   + hull staircase + fan-out column pinning) — model-only.
 * - **placement (M3a, Stage 1d/2)** turns `localColumn` into a global `box` per
 *   node (forced bands / packed column-stack / mixed vpc; cyclic → M2 columns).
 *   This is the FIRST stage that produces geometry — when it runs, export draws
 *   from the boxes instead of delegating to the compound fallback rung.
 *
 * Each stage honors the §22.1 contract (optimize only its own tier, never violate
 * a higher one) and is deterministic. Later milestones push more stages.
 */
const RCLL_STAGES: readonly RcllPipelineStage[] = [
  { name: "layering", stage: layeringStage },
  { name: "placement", stage: placementStage },
];

/** Result of running the stage pipeline (§27/§29). */
export type RunRcllPipelineResult = {
  tree: CompoundNode;
  /** names of stages that ran (→ `rcllModules.stages`). */
  ran: string[];
  /** names skipped via the §27 fallback ladder (→ `rcllDegraded`). */
  degraded: string[];
  /** per-stage `StageResult.meta`, keyed by stage name (→ `rcllStageMeta`). */
  stageMeta: Record<string, unknown>;
};

/**
 * Run the stage pipeline over the internal model. Each stage is guarded (§27):
 * on a throw or an invalid result it is skipped, the prior tree is kept, and its
 * name is recorded in `degraded`. A stage that runs may surface stage-scoped
 * diagnostics via `StageResult.meta` (§28); those are collected by stage name so
 * the builder can stamp them into scene meta (§29). M0 exercises none of this
 * (empty `RCLL_STAGES`), but the seam is wired + typed + tested via injected
 * stages so M1+ register real stages without touching the builder.
 *
 * Exported for unit testing the guard in isolation (see terraformPipelineRcll.test.ts).
 */
/**
 * §27 output validation: every `box` on the tree must be finite. A stage that
 * emits a non-finite coordinate (e.g. a future VPSC projection over degenerate
 * constraints at M5) is rejected like a throw — the prior rung is kept. Cheap
 * (one walk) and de-risks the milestones that do real numeric solving.
 */
function treeBoxesFinite(node: CompoundNode): boolean {
  const b = node.box;
  if (
    b &&
    !(
      Number.isFinite(b.x) &&
      Number.isFinite(b.y) &&
      Number.isFinite(b.width) &&
      Number.isFinite(b.height)
    )
  ) {
    return false;
  }
  for (const child of node.children) {
    if (!treeBoxesFinite(child)) {
      return false;
    }
  }
  return true;
}

export function runRcllPipeline(
  stages: readonly RcllPipelineStage[],
  tree: CompoundNode,
  lattice: Lattice,
  opts: RcllOptions,
): RunRcllPipelineResult {
  let current = tree;
  const ran: string[] = [];
  const degraded: string[] = [];
  const stageMeta: Record<string, unknown> = {};
  for (const { name, stage } of stages) {
    try {
      const result: StageResult = stage(current, lattice, opts);
      if (!result || !result.tree || !treeBoxesFinite(result.tree)) {
        degraded.push(name);
        continue;
      }
      current = result.tree;
      ran.push(name);
      // §28: collect stage-scoped meta. MUST be plain data — never
      // timings/wall-clock, or the byte-identical determinism test (CON-8) breaks.
      if (result.meta !== undefined) {
        stageMeta[name] = result.meta;
      }
    } catch {
      degraded.push(name);
    }
  }
  return { tree: current, ran, degraded, stageMeta };
}

/**
 * Build the scene from the **RCLL-placed tree** (M3a, when the placement stage
 * ran). Leaf cluster cards are emitted at their global `box`; every other piece
 * is the SAME placement-agnostic machinery the compound builder uses, so frames,
 * group-drag metadata, arrows, and parenting fall out for free:
 *
 *   leaf boxes ─► buildCompoundFramesFromLayoutBoxes (hulls = boundsOf+pad)
 *             ─► applyCompoundHierarchicalLayout (provider reanchor + group-drag)
 *             ─► append edge + hull-connector skeletons ─► assign frame parents
 *             ─► convertPipelineSkeletonToElements
 *
 * Note: ancillary ("Unconnected") strips are NOT drawn here — the RCLL model has
 * no ancillary (M1), and the RCLL view does not enable it; a documented M3a
 * limitation (same class as multi-provider banding).
 */
async function buildSceneFromBoxedTree(
  tree: CompoundNode,
  prep: PipelineLayoutPrep,
  nodes: TerraformPlanNodesMap,
): Promise<{
  elements: ExcalidrawElement[];
  frameEdgeCount: number;
  backEdgesStyled: number;
}> {
  const skeleton: ExcalidrawElementSkeleton[] = [];
  const layoutBoxes = new Map<string, TerraformDependencyLayoutBox>();

  const emitLeaves = (node: CompoundNode): void => {
    if (node.cluster && node.box) {
      const built = node.cluster.build;
      // A cluster skeleton is NOT origin-normalized: its frame element sits at a
      // local (frameX, frameY) offset (e.g. a card whose content starts below a
      // label). Translate so the frame's top-left lands EXACTLY at the placed
      // box — otherwise layoutBoxes (box-based, drives the derived hull frames)
      // and the rendered card (offset by the skeleton origin) disagree, and a
      // card renders outside its own band → frame-title-primary-cluster
      // collisions. (`layoutLaneClusters` solves the same problem by reading the
      // frame's actual post-translate box; we pre-compensate instead so the
      // box == placement coordinate the banding math already reasoned about.)
      const frameEl = built.skeleton.find(
        (el) => el.id === built.clusterFrameId,
      );
      const flx = typeof frameEl?.x === "number" ? frameEl.x : 0;
      const fly = typeof frameEl?.y === "number" ? frameEl.y : 0;
      skeleton.push(
        ...translateSkeleton(
          built.skeleton,
          node.box.x - flx,
          node.box.y - fly,
        ),
      );
      const placed = {
        x: node.box.x,
        y: node.box.y,
        width:
          typeof frameEl?.width === "number" ? frameEl.width : node.box.width,
        height:
          typeof frameEl?.height === "number"
            ? frameEl.height
            : node.box.height,
      };
      layoutBoxes.set(node.cluster.id, { ...placed });
      layoutBoxes.set(built.clusterFrameId, { ...placed });
    }
    for (const child of node.children) {
      emitLeaves(child);
    }
  };
  emitLeaves(tree);

  buildCompoundFramesFromLayoutBoxes(skeleton, prep.clusters, layoutBoxes);
  applyCompoundHierarchicalLayout(skeleton, layoutBoxes, prep.clusters);
  appendPipelineEdgeSkeletons(
    nodes,
    prep.collapsedEdges,
    skeleton,
    layoutBoxes,
  );
  // EXT-12: mark cycle wrap-edges. The iron rule (CON-12) guarantees no ACYCLIC
  // edge renders backward, so any TFD arrow whose target box reads left of its
  // source is an intra-cycle wrap-edge — style it as an explicit back-edge so it
  // reads as an intentional cycle, not a layout error (DEC-8(B) + EXT-12).
  const backEdgesStyled = styleRcllBackEdges(
    skeleton,
    prep.collapsedEdges,
    layoutBoxes,
  );
  const frameEdgeCount = appendCompoundTopologyFrameEdgeSkeletons(
    prep.collapsedEdges,
    prep.clusters,
    skeleton,
    layoutBoxes,
  );
  assignCompoundEdgeFrameParents(skeleton, prep.clusters);
  const elements = await convertPipelineSkeletonToElements(skeleton);
  return { elements, frameEdgeCount, backEdgesStyled };
}

/** EXT-12 back-edge styling colour — a distinct cycle marker (Excalidraw orange). */
const RCLL_BACK_EDGE_COLOR = "#e8590c";

/**
 * Re-style the cycle wrap-edges in place: dashed + a distinct colour + a
 * `terraformBackEdge` flag (for a future legend/hover). A wrap-edge is a TFD
 * arrow whose target box LEFT EDGE reads left of its source's — which, given the
 * CON-12 gate (acyclic backward = 0; spurious hull cycles dissolved into lanes,
 * DEC-8(C)), is always a *genuine* intra-cycle edge. Aggregated hull connectors are
 * left alone. Returns the count styled (**0 on v2** — no genuine `D` cycle; this is
 * the defensive path for a real cluster-graph cycle).
 */
function styleRcllBackEdges(
  skeleton: ExcalidrawElementSkeleton[],
  collapsedEdges: readonly CollapsedPipelineEdge[],
  layoutBoxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
): number {
  const leftX = (id: string): number | null => {
    const b = layoutBoxes.get(id);
    return b ? b.x : null;
  };
  const backKeys = new Set<string>();
  for (const e of collapsedEdges) {
    const xs = leftX(e.source);
    const xt = leftX(e.target);
    if (xs != null && xt != null && xt < xs - 1) {
      backKeys.add(`${e.source} ${e.target}`);
    }
  }
  if (backKeys.size === 0) {
    return 0;
  }
  let styled = 0;
  for (const el of skeleton) {
    const cd = el.customData as
      | {
          relationship?: {
            source?: unknown;
            target?: unknown;
            aggregated?: unknown;
          };
        }
      | undefined;
    const rel = cd?.relationship;
    if (
      !rel ||
      rel.aggregated === true ||
      typeof rel.source !== "string" ||
      typeof rel.target !== "string" ||
      !backKeys.has(`${rel.source} ${rel.target}`)
    ) {
      continue;
    }
    (el as { strokeStyle?: string }).strokeStyle = "dashed";
    (el as { strokeColor?: string }).strokeColor = RCLL_BACK_EDGE_COLOR;
    (el.customData as Record<string, unknown>).terraformBackEdge = true;
    styled += 1;
  }
  return styled;
}

/**
 * RCLL pipeline builder (RFC docs/pipeline-rcll-layout-design.md).
 *
 * **Through M3a** — the ELK-style **import → pipeline → export** seam + the §29
 * observability/meta contract. Import (M1) builds the tree + lattice; the pipeline
 * runs layering (M2, `localColumn`) then placement (M3a, global `box`). **Export
 * branches on whether placement RAN** (`ran.includes("placement")` — the §27
 * guard's own bookkeeping, not a box-presence sniff): if it ran, the picture is
 * drawn from the RCLL boxes (first real geometry — no longer ≡ compound); if it
 * degraded, export falls back to the compound builder (the §27 fallback rung).
 * Rollback: the `pipelineLayoutVariant` kill-switch (§33) reverts to
 * compound/classic.
 */
export async function buildTerraformPipelineRcllExcalidrawScene(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  options?: RcllBuildOptions,
  // Injectable for tests (eng-review): defaults to the production RCLL_STAGES.
  // A test passes dummy stages to exercise the §27 guard + the
  // ran/degraded/stageMeta → scene-meta mapping end-to-end.
  stages: readonly RcllPipelineStage[] = RCLL_STAGES,
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  const compact = options?.compact !== false;
  const includeAncillary = options?.includeAncillary === true;
  const rcllOptions: RcllOptions = {
    compact,
    includeAncillary,
    staircaseBandOverlap: options?.staircaseBandOverlap,
    swimlaneLaneRise: options?.swimlaneLaneRise === true,
    reorder: options?.reorder === true,
    straighten: options?.straighten === true,
  };

  // import: build the compound tree + lattice from the shared prep, ONCE.
  // `preparePipelineLayout` also enforces the .tfd gate (CON-10) — a throw here
  // surfaces as the same HTTP-400 the compound path raises. No try/catch: the
  // model is data-only and degenerate inputs are covered by no-throw tests
  // (a model-build bug should surface loudly, not silently blank the view).
  const prep = preparePipelineLayout(nodes, plan, compact, {});
  const { tree, lattice } = buildRcllModel(prep);

  // pipeline: layering (M2 → `localColumn`) then placement (M3a → global `box`).
  // We READ the stage output tree (`laidOutTree`) — placement mutates geometry
  // through it, and scene meta reflects the laid-out model.
  const {
    tree: laidOutTree,
    ran,
    degraded,
    stageMeta,
  } = runRcllPipeline(stages, tree, lattice, rcllOptions);

  // export — M3a branch (eng-review A2): if placement RAN, draw RCLL's own
  // geometry from the placed boxes; otherwise fall back to the compound builder
  // (the §27 fallback rung, fed the SAME prep so the skeleton build runs once).
  // Branching on `ran` (not a box-presence sniff) keeps export in lockstep with
  // the guard's bookkeeping — a degraded placement can never take the boxes path.
  const placed = ran.includes("placement");
  let elements: ExcalidrawElement[];
  let warnings: TerraformImportWarning[];
  let backEdgesStyled = 0;
  if (placed) {
    const built = await buildSceneFromBoxedTree(laidOutTree, prep, nodes);
    elements = built.elements;
    backEdgesStyled = built.backEdgesStyled;
    // Cluster-level cycle warning (D) + the container-level cycle warning (D_H,
    // the 6 cyclic containers on v2 — dissolved into shared-axis lanes, DEC-8(C),
    // so their interior reads strictly left→right by dependency).
    warnings = [...pipelineCycleWarnings(prep.depthResult)];
    if ((lattice.cyclicContainers?.size ?? 0) > 0) {
      warnings.push({
        code: "pipeline_cycle_container",
        message:
          "Pipeline view detected a dependency cycle between sibling topology hulls (a side effect of grouping resources into hulls; the underlying resources are acyclic); those containers were laid out as dependency-ordered swimlanes.",
      });
    }
  } else {
    const fallback = await buildTerraformCompoundPipelineExcalidrawScene(
      nodes,
      plan,
      { compact, includeAncillary, prep },
    );
    elements = fallback.elements;
    warnings = fallback.warnings;
  }

  // §29 readability + gates — reuse the existing diagnostics (deterministic,
  // read-only over elements). Counts/flags only in meta; NEVER timings (a
  // duration would break the byte-identical / determinism test). Now reflects
  // RCLL's OWN geometry when placement ran (no longer ≡ compound).
  const diagnostics = diagnosePipelineScene(elements);

  // The iron rule (CON-12), measured on the placed boxes — valid in Compact AND
  // Full (the rendered `semanticEdgeViolations` goes blind in Full). Only when
  // placement ran (the fallback rung has no RCLL boxes).
  const backward = placed
    ? backwardEdgeGate(
        boxByKey(laidOutTree),
        prep.collapsedEdges,
        prep.clusters,
      )
    : {
        acyclicBackwardEdges: 0,
        cyclicBackwardEdges: 0,
        acyclicSameColumnEdges: 0,
        cyclicSameColumnEdges: 0,
      };

  return {
    elements,
    meta: {
      layoutEngine: "pipeline",
      pipelineVariant: "rcll",
      rcllMilestone: placed
        ? rcllOptions.straighten
          ? "M5"
          : rcllOptions.reorder
            ? "M6"
            : rcllOptions.swimlaneLaneRise
              ? "M4"
              : "M3a"
        : "M2",
      // M4: whether the swimlane lane-rise (DEC-1 in swimlane interiors) is active.
      rcllSwimlaneLaneRise: rcllOptions.swimlaneLaneRise === true,
      // M6: whether the barycenter crossing-min reorder is active.
      rcllReorder: rcllOptions.reorder === true,
      // M5: whether Brandes–Köpf leaf straightening is active.
      rcllStraighten: rcllOptions.straighten === true,
      pipelineCompact: compact,
      rcllModules: { stages: ran, fallback: "compound" },
      rcllDegraded: degraded,
      // §29: import-phase facts (the tree + lattice this build computed),
      // distinct from per-stage rcllStageMeta. Scalars only (CON-8 determinism):
      // a count makes the model observable for the acceptance gate without
      // serializing the maps. Computed from the LAID-OUT tree (the pipeline output).
      rcllModel: summarizeRcllModel(laidOutTree, lattice),
      // §29: per-stage diagnostics, keyed by stage name — layering (M2) +
      // placement (M3a) gate metrics. The §29 shape deviation noted at M2 holds:
      // `rcllModules` is {stages,fallback}, not the spec's {layering,ordering,…}.
      rcllStageMeta: stageMeta,
      counts: {
        clusters: prep.clusters.length,
        edges: prep.collapsedEdges.length,
        columns: prep.maxDepth + 1,
      },
      readability: {
        crossings: diagnostics.dataflow.crossings,
        tfdArrowCount: diagnostics.dataflow.tfdArrowCount,
        medianDeltaYPx: diagnostics.dataflow.medianVerticalDeviationPx,
        meanDeltaYPx: diagnostics.dataflow.meanVerticalDeviationPx,
        nearStraightPct: diagnostics.dataflow.fractionNearStraight,
        fanoutColumnRate: diagnostics.dataflow.fanoutColumnRate,
        fanoutSetCount: diagnostics.dataflow.fanoutSetCount,
        hubCenteringRate: diagnostics.dataflow.hubCenteringRate,
        hubCount: diagnostics.dataflow.hubCount,
        aspect: diagnostics.dataflow.aspect,
      },
      gates: {
        collisions: diagnostics.collisionCount,
        semanticEdgeViolations: diagnostics.semanticEdgeViolations.length,
        // CON-12 iron rule (model-level, both modes) — TWO halves, both MUST be 0
        // for an acyclic LCA: no TFD edge reads backward AND none shares a column
        // (spurious hull cycles are dissolved into lanes, DEC-8(C), so they no
        // longer surface here). The `cyclic*` counts are excused (a genuine `D`
        // cycle, CON-2) + drawn as explicit back-edges (EXT-12: dashed + distinct
        // colour + `terraformBackEdge`) — expected 0 on v2 (no genuine `D` cycle).
        acyclicBackwardEdges: backward.acyclicBackwardEdges,
        cyclicBackwardEdges: backward.cyclicBackwardEdges,
        acyclicSameColumnEdges: backward.acyclicSameColumnEdges,
        cyclicSameColumnEdges: backward.cyclicSameColumnEdges,
        backEdgesStyled,
      },
    },
    warnings,
  };
}
