import type { ExcalidrawElement } from "@excalidraw/element/types";

import { buildTerraformCompoundPipelineExcalidrawScene } from "./terraformPipelineLayoutCompound";
import { diagnosePipelineScene } from "./terraformPipelineCollisionDiagnostics";

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
};

export type RcllPipelineStage = { name: string; stage: Stage };

/**
 * Ordered stage pipeline. **M0 registers zero stages** — the list is empty, so
 * the pipeline is a no-op and control falls through to the compound fallback
 * rung in the builder. M1+ push real stages here (import/layer/order/center/…);
 * each must honor the §22.1 contract (optimize only its own tier, never violate
 * a higher one) and be deterministic.
 */
const RCLL_STAGES: readonly RcllPipelineStage[] = [];

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
      if (!result || !result.tree) {
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
 * RCLL pipeline builder (RFC docs/pipeline-rcll-layout-design.md).
 *
 * **Milestone M0** — stand up the ELK-style **import → pipeline → export** seam
 * plus the §29 observability/meta contract, with ZERO stages. The compound
 * builder is the §27 fallback rung, so output is identical to the compound view
 * (zero placement change). M0 proves the routing, the §28 contract types, and
 * the measurement baseline — *not* the algorithm. Rollback: the
 * `pipelineLayoutVariant` kill-switch (§33) reverts to compound/classic.
 */
export async function buildTerraformPipelineRcllExcalidrawScene(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  options?: RcllBuildOptions,
  // Injectable for tests (Issue 1, eng-review): defaults to the empty M0
  // registry, so production routing is unchanged. A test passes dummy stages to
  // exercise the §27 guard + the ran/degraded/stageMeta → scene-meta mapping
  // end-to-end. M1+ register real stages by editing RCLL_STAGES.
  stages: readonly RcllPipelineStage[] = RCLL_STAGES,
): Promise<{
  elements: ExcalidrawElement[];
  meta: Record<string, unknown>;
  warnings: TerraformImportWarning[];
}> {
  const compact = options?.compact !== false;
  const includeAncillary = options?.includeAncillary === true;
  const rcllOptions: RcllOptions = { compact, includeAncillary };

  // import (M0 stub: no tree/lattice yet — M1 builds them from the prep).
  const emptyTree: CompoundNode = {
    key: "__rcll_root__",
    role: "root",
    level: 0,
    minDescendantSequence: 0,
    children: [],
  };
  const emptyLattice: Lattice = {};

  // pipeline (M0: empty → no-op; control falls through to the fallback rung).
  const { ran, degraded, stageMeta } = runRcllPipeline(
    stages,
    emptyTree,
    emptyLattice,
    rcllOptions,
  );

  // export — §27 fallback rung: the compound builder. Geometry ≡ compound.
  const fallback = await buildTerraformCompoundPipelineExcalidrawScene(
    nodes,
    plan,
    { compact, includeAncillary },
  );

  // §29 readability + gates — reuse the existing diagnostics (deterministic,
  // read-only over elements). Counts/flags only in meta; NEVER timings (a
  // duration would break the byte-identical / determinism test).
  const diagnostics = diagnosePipelineScene(fallback.elements);

  return {
    elements: fallback.elements,
    meta: {
      layoutEngine: "pipeline",
      pipelineVariant: "rcll",
      rcllMilestone: "M0b",
      pipelineCompact: compact,
      rcllModules: { stages: ran, fallback: "compound" },
      rcllDegraded: degraded,
      // §29: per-stage diagnostics, keyed by stage name. Empty at M0 (no stages
      // emit meta); populated as M1+ stages surface StageResult.meta. Note the
      // §29 shape deviation: `rcllModules` is {stages,fallback} at M0, not the
      // spec's {layering,ordering,…} — that fills in as named stages land (M1+).
      rcllStageMeta: stageMeta,
      counts: {
        clusters: fallback.meta.pipelineClusterCount,
        edges: fallback.meta.pipelineEdgeCount,
        columns: fallback.meta.pipelineColumnCount,
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
      },
    },
    warnings: fallback.warnings,
  };
}
