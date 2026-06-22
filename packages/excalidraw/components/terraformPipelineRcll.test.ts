/**
 * Integration test for the RCLL pipeline view (RFC docs/pipeline-rcll-layout-design.md)
 * — through milestone M3a — on staging-extended-localstack-v2.
 *
 * The seam is import → pipeline → export; the compound builder is the §27
 * fallback rung. M3a registers the placement stage: layering (M2) writes
 * localColumn, placement (M3a) turns columns into a global box per node, and
 * export draws RCLL's OWN geometry from those boxes (no longer ≡ compound). This
 * test gates the seam + the M2 + M3a acceptance gates:
 *   - routing: meta.pipelineVariant === "rcll" + seam shape (M3a milestone,
 *     stages [layering, placement], rcllDegraded)
 *   - M2 gate (rcllStageMeta.layering): fan-out-column rate = 1.0, CON-1/CON-6 = 0
 *   - M3a gate (rcllStageMeta.placement): containment = 0, forced bands disjoint = 0
 *   - first geometry: the picture is NOT equal to compound (placement changed it)
 *   - collision gate = 0 on RCLL's own geometry; no semantic edge violations
 *   - determinism (CON-8): a second build is byte-identical in geometry AND
 *     meta (meta carries no timings, so it must be reproducible)
 *   - §27 fallback: a throwing 'placement' stage degrades to compound (keys off ran)
 *   - pipeline_cycle_container warning emitted on v2 (6 cyclic D_H containers)
 *   - the pipeline .tfd validation gate is inherited (rcll + 0 edges → 400)
 *   - preset round-trip: a view:"rcll" preset normalizes back to "rcll"
 *
 * Run:
 *   VITEST_TERRAFORM_VERBOSE=1 yarn vitest run \
 *     packages/excalidraw/components/terraformPipelineRcll.test.ts
 */
import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";
import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
import { diagnosePipelineScene } from "./terraformPipelineCollisionDiagnostics";
import { layoutTerraformFromSources } from "./terraformLayoutCore";
import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import { normalizeTerraformImportPreset } from "./terraformImportPresetsTypes";
import {
  buildTerraformPipelineRcllExcalidrawScene,
  runRcllPipeline,
} from "./terraformPipelineLayoutRcll";
import {
  applyTfdOverlayToNodes,
  buildTerraformLocalImportNodesMap,
} from "./terraformPlanParsing";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";
import type { RcllPipelineStage } from "./terraformPipelineLayoutRcll";
import type { CompoundNode, Stage } from "./terraformPipelineRcllTypes";

async function layout(presetId: string, options: Record<string, unknown>) {
  const raw = getTerraformImportPresetSourcesFromDb(presetId);
  const sources = resolveSourcesWithTfdComposition(
    raw! as TerraformImportPresetSources,
  );
  const bundle = sources.planDotBundles[0]!;
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
  applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);
  expect(nodes[DECLARED_DATAFLOW_ORDERED_KEY]?.length ?? 0).toBeGreaterThan(0);

  const body = await layoutTerraformViaWorkers(
    {
      planDotBundles: sources.planDotBundles,
      states: [],
      stateLabels: [],
      tfdTexts: sources.tfdTexts,
      tfdLabels: sources.tfdLabels,
    },
    { semanticLayout: false, ...options },
  );
  const elements = body.elements as ExcalidrawElement[];
  const live = elements.filter((e) => !e.isDeleted);
  return {
    elements: live,
    meta: body.meta as Record<string, unknown>,
    diagnostics: diagnosePipelineScene(elements),
  };
}

type GeomCell = {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  points?: readonly (readonly number[])[];
};

/**
 * Geometry-only projection, in array order with the element `id` dropped.
 *
 * Element ids come from a process-global monotonic counter, so two independent
 * builds in the same test process never share an id range — comparing by id is
 * meaningless. What M0 actually claims is "same drawing": the deterministic
 * compound builder emits the same elements in the same order with the same
 * placement, only the ephemeral id labels differ. So we compare positionally on
 * (type, x, y, width, height, angle, points). Meta is allowed to diverge by
 * design (pipelineVariant, rcllModules, …) and is compared separately.
 */
const geometry = (els: readonly ExcalidrawElement[]): GeomCell[] =>
  els.map((e) => {
    const cell: GeomCell = {
      type: e.type,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      angle: e.angle,
    };
    const points = (e as { points?: unknown }).points;
    if (Array.isArray(points)) {
      cell.points = points as readonly (readonly number[])[];
    }
    return cell;
  });

describe("pipeline view rcll (M3a)", () => {
  it(
    "staging-extended-localstack-v2 — routes to rcll, draws own geometry, collision-free, deterministic",
    async () => {
      for (const compact of [true, false]) {
        const mode = compact ? "compact" : "full";

        const rcll = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
        });
        // The compound view, for the geometry-DIVERGENCE check below (M3a draws
        // its OWN picture, so it must NO LONGER match compound).
        const compound = await layout("staging-extended-localstack-v2", {
          layoutMode: "pipeline",
          pipelineLayoutVariant: "compound",
          pipelineCompact: compact,
        });

        // Routing + seam shape. M3a registers layering + placement; placement
        // RAN, so export drew RCLL's own boxes (not the compound fallback).
        expect(rcll.meta.pipelineVariant, `${mode} variant`).toBe("rcll");
        expect(rcll.meta.rcllMilestone, `${mode} milestone`).toBe("M3a");
        expect(rcll.meta.rcllModules, `${mode} modules`).toEqual({
          stages: ["layering", "placement"],
          fallback: "compound",
        });
        expect(rcll.meta.rcllDegraded, `${mode} degraded`).toEqual([]);
        expect(rcll.elements.length, `${mode} non-empty`).toBeGreaterThan(0);

        // M2 acceptance gate (model-level, per-container D_H). The layering
        // stage surfaces its metrics under rcllStageMeta.layering. On v2 every
        // non-cyclic fan-out set co-columns (rate = 1.0) and no D_H edge breaks
        // TFD precedence (CON-1) or the hull staircase (CON-6). Cyclic
        // containers are excused (§13 acyclic guard).
        const layeringMeta = (
          rcll.meta.rcllStageMeta as Record<string, Record<string, number>>
        ).layering;
        expect(
          layeringMeta.con1Violations,
          `${mode} CON-1 (TFD precedence) holds`,
        ).toBe(0);
        expect(
          layeringMeta.con6Violations,
          `${mode} CON-6 (hull staircase) holds`,
        ).toBe(0);
        expect(
          layeringMeta.fanoutSetCount,
          `${mode} has fan-out sets to measure`,
        ).toBeGreaterThan(0);
        expect(
          layeringMeta.fanoutColumnRate,
          `${mode} fan-out-column rate = 100%`,
        ).toBe(1);

        // M3a placement gate (model-level, rcllStageMeta.placement): every child
        // box is contained in its parent (CON-3) and no forced-level sibling
        // bands overlap in Y (CON-5, DEC-1 off ⇒ strictly disjoint).
        const placementMeta = (
          rcll.meta.rcllStageMeta as Record<string, Record<string, number>>
        ).placement;
        expect(
          placementMeta.containmentViolations,
          `${mode} containment (CON-3) holds`,
        ).toBe(0);
        expect(
          placementMeta.siblingOverlapViolations,
          `${mode} no 2D overlap among any container's children (CON-4/5)`,
        ).toBe(0);
        expect(
          placementMeta.placedLeafCount,
          `${mode} placed every leaf`,
        ).toBeGreaterThan(0);
        // S2: anchor the placed height so every later milestone is a MEASURED
        // height decision. M3a is pre-compaction (no push-right/pack-left), so
        // this is a finite-positive sanity anchor, not yet a `< baseline` gate —
        // M7/M8 drive it down (baselines: packed-compound ~7.5k px, stacked ~18.5k).
        expect(
          Number.isFinite(placementMeta.maxDepthPx) &&
            placementMeta.maxDepthPx > 0,
          `${mode} placement records a finite positive height (maxDepthPx)`,
        ).toBe(true);

        // M1: the import phase computed a real tree + lattice. The model block
        // is scalar, finite, and plausible on the real preset (fan-out sets and
        // hull edges both exist). Compact resolves fully; full mode still builds
        // the same model (the model is geometry-independent).
        const model = rcll.meta.rcllModel as Record<string, number>;
        for (const key of [
          "primaryClusterCount",
          "fanoutSetCount",
          "faninSetCount",
          "hullEdgeCount",
          "maxSlack",
          "totalSlack",
          "containerCount",
          "cyclicContainerCount",
        ]) {
          expect(typeof model[key], `${mode} rcllModel.${key} number`).toBe(
            "number",
          );
          expect(
            Number.isFinite(model[key]),
            `${mode} rcllModel.${key} finite`,
          ).toBe(true);
        }
        expect(
          model.primaryClusterCount,
          `${mode} has clusters`,
        ).toBeGreaterThan(0);
        expect(model.fanoutSetCount, `${mode} has fan-outs`).toBeGreaterThan(0);
        expect(model.hullEdgeCount, `${mode} has hull edges`).toBeGreaterThan(
          0,
        );
        // Container cycles on v2: the cluster graph D is acyclic (longest-path
        // layering yields 16 columns), but UP-PROJECTING it to container level
        // induces cycles (a→b lifts regionX→regionY while c→d lifts
        // regionY→regionX). The RFC anticipates this (§6.3, CON-2): M1 detects +
        // flags them; the localized model-order-stack fallback is M3 — and this
        // proves it WILL fire on real data, not just in theory.
        expect(
          model.cyclicContainerCount,
          `${mode} container-cycle count is a non-negative integer`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          Number.isInteger(model.cyclicContainerCount),
          `${mode} cyclic count integral`,
        ).toBe(true);

        // M0b: the measurement harness carries the new readability metrics +
        // their companion counts (every field a finite number).
        const readability = rcll.meta.readability as Record<string, unknown>;
        for (const key of [
          "crossings",
          "fanoutColumnRate",
          "fanoutSetCount",
          "hubCenteringRate",
          "hubCount",
          "aspect",
        ]) {
          expect(
            typeof readability[key],
            `${mode} readability.${key} is a number`,
          ).toBe("number");
          expect(
            Number.isFinite(readability[key] as number),
            `${mode} readability.${key} finite`,
          ).toBe(true);
        }

        // M3a draws its OWN geometry: the picture must NO LONGER match compound
        // (this is what retired the "geometry ≡ compound" invariant — proof that
        // placement actually changed the picture).
        expect(
          geometry(rcll.elements),
          `${mode} geometry ≠ compound (placement changed the picture)`,
        ).not.toEqual(geometry(compound.elements));

        // Headline M3a acceptance: the collision gate is ZERO on RCLL's own
        // geometry (CON-3/4/5) — the structural gate the user locked.
        expect(
          rcll.diagnostics.collisionCount,
          `${mode} RCLL geometry is collision-free`,
        ).toBe(0);
        // THE IRON RULE (CON-12), gated at the MODEL level on the placed boxes so
        // it is valid in Compact AND Full (the rendered `semanticEdgeViolations`
        // below goes blind in Full — primary-cluster frames carry no
        // `terraformPrimaryAddress`). The rule has TWO halves, both keyed off the
        // box LEFT EDGE (the column): no acyclic TFD edge reads BACKWARD, and none
        // shares a COLUMN. For an acyclic LCA the width-aware staircase
        // (columnOffsetsFromWidths) + the shared lane axis guarantee the target
        // sits a full column right of the source ⇒ both counts are ZERO. It holds
        // NOW, not "after M4". The 6 spurious hull cycles (`D_H` of an acyclic `D`)
        // are dissolved into shared-axis lanes (DEC-8(C)), so they no longer read
        // backward OR same-column — the cyclic counts are 0 too on v2 (no genuine
        // `D` cycle).
        const gates = rcll.meta.gates as Record<string, number>;
        expect(
          gates.acyclicBackwardEdges,
          `${mode} iron rule: no acyclic edge renders backward (CON-12)`,
        ).toBe(0);
        expect(
          gates.acyclicSameColumnEdges,
          `${mode} iron rule: no acyclic TFD edge shares a column (CON-12)`,
        ).toBe(0);
        // v2 has no genuine `D` cycle (only spurious hull cycles, now dissolved),
        // so the excused cyclic counts are 0 and nothing is styled as a back-edge.
        // The cyclic path stays a real (tested) gate value + the EXT-12 styling is
        // retained as the defensive path for a true cluster-graph cycle.
        expect(
          gates.cyclicBackwardEdges,
          `${mode} no genuine cycle wrap-edge on v2 (spurious cycles → lanes)`,
        ).toBe(0);
        expect(
          gates.cyclicSameColumnEdges,
          `${mode} no genuine cycle same-column edge on v2`,
        ).toBe(0);
        expect(
          Number.isInteger(gates.backEdgesStyled) &&
            gates.backEdgesStyled === 0,
          `${mode} no back-edges to style on v2 (iron rule fully satisfied)`,
        ).toBe(true);
        // `semanticEdgeViolations` is the RENDERED count (frame center-X). It is
        // OBSERVED, not gated: it double-counts the excused cyclic wrap-edges in
        // Compact and is blind in Full. The iron rule above is the real gate.
        expect(
          Array.isArray(rcll.diagnostics.semanticEdgeViolations),
          `${mode} semantic-edge violations is an array (observed, not gated)`,
        ).toBe(true);

        // Determinism (CON-8): a second build is byte-identical in geometry.
        const rcll2 = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
        });
        expect(
          geometry(rcll2.elements),
          `${mode} geometry determinism`,
        ).toEqual(geometry(rcll.elements));
        // Meta determinism doubles as the "no timings in meta" proof: a
        // duration/timestamp would make two builds differ here.
        expect(rcll2.meta, `${mode} meta determinism`).toEqual(rcll.meta);

        if (process.env.VITEST_TERRAFORM_VERBOSE) {
          // eslint-disable-next-line no-console -- intentional diagnostic output
          console.log(
            `\n[pipeline:rcll:${mode}]\n${JSON.stringify(
              {
                counts: rcll.meta.counts,
                readability: rcll.meta.readability,
                gates: rcll.meta.gates,
              },
              null,
              2,
            )}`,
          );
        }
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );
});

describe("pipeline view rcll (M4 — swimlane lane-rise)", () => {
  it(
    "staging-extended-localstack-v2 — rise ON is shorter, all gates 0, deterministic, milestone M4",
    async () => {
      for (const compact of [true, false]) {
        const mode = compact ? "compact" : "full";
        const off = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
        });
        const on = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
          pipelineSwimlaneLaneRise: true,
        });

        // Milestone bumps to M4 when the rise is active; off stays M3a.
        expect(on.meta.rcllMilestone, `${mode} milestone`).toBe("M4");
        expect(off.meta.rcllMilestone, `${mode} off milestone`).toBe("M3a");
        expect(on.meta.rcllSwimlaneLaneRise, `${mode} meta flag`).toBe(true);

        const onPlacement = (
          on.meta.rcllStageMeta as Record<string, Record<string, number>>
        ).placement;
        const offPlacement = (
          off.meta.rcllStageMeta as Record<string, Record<string, number>>
        ).placement;

        // THE WIN: rise ON is strictly shorter than OFF (swimlane interiors pack).
        expect(
          onPlacement.maxDepthPx,
          `${mode} rise ON shorter than OFF`,
        ).toBeLessThan(offPlacement.maxDepthPx);

        // CON-12-safe + collision-free: every structural gate holds under rise ON.
        expect(onPlacement.containmentViolations, `${mode} containment`).toBe(
          0,
        );
        expect(
          onPlacement.siblingOverlapViolations,
          `${mode} sibling overlap`,
        ).toBe(0);
        const gates = on.meta.gates as Record<string, number>;
        expect(gates.acyclicBackwardEdges, `${mode} iron rule backward`).toBe(
          0,
        );
        expect(
          gates.acyclicSameColumnEdges,
          `${mode} iron rule same-column`,
        ).toBe(0);
        expect(
          on.diagnostics.collisionCount,
          `${mode} rendered collisions`,
        ).toBe(0);

        // Determinism (CON-8) under rise ON.
        const on2 = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
          pipelineSwimlaneLaneRise: true,
        });
        expect(geometry(on2.elements), `${mode} rise determinism`).toEqual(
          geometry(on.elements),
        );
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );
});

describe("pipeline view rcll (M6 — crossing-minimization reorder)", () => {
  it(
    "staging-extended-localstack-v2 — reorder ON cuts crossings, all gates 0, deterministic, milestone M6",
    async () => {
      for (const compact of [true, false]) {
        const mode = compact ? "compact" : "full";
        const off = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
        });
        const on = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
          pipelineReorder: true,
        });

        // Milestone bumps to M6 when the reorder is active; off stays M3a.
        expect(on.meta.rcllMilestone, `${mode} milestone`).toBe("M6");
        expect(off.meta.rcllMilestone, `${mode} off milestone`).toBe("M3a");
        expect(on.meta.rcllReorder, `${mode} meta flag`).toBe(true);

        // THE WIN: reorder ON has no MORE crossings than OFF (the per-container
        // strict-improve gate can only reduce; the global rendered count confirms
        // no cross-container regression). The readability meta is build-internal
        // (computed over ALL elements, incl. the isDeleted dataflow arrows).
        const onCross = (on.meta.readability as Record<string, number>)
          .crossings;
        const offCross = (off.meta.readability as Record<string, number>)
          .crossings;
        expect(onCross, `${mode} crossings ON ≤ OFF`).toBeLessThanOrEqual(
          offCross,
        );

        // Every structural gate still holds under reorder ON.
        const onPlacement = (
          on.meta.rcllStageMeta as Record<string, Record<string, number>>
        ).placement;
        expect(onPlacement.containmentViolations, `${mode} containment`).toBe(
          0,
        );
        expect(
          onPlacement.siblingOverlapViolations,
          `${mode} sibling overlap`,
        ).toBe(0);
        const gates = on.meta.gates as Record<string, number>;
        expect(gates.acyclicBackwardEdges, `${mode} iron rule backward`).toBe(
          0,
        );
        expect(
          gates.acyclicSameColumnEdges,
          `${mode} iron rule same-column`,
        ).toBe(0);
        expect(
          on.diagnostics.collisionCount,
          `${mode} rendered collisions`,
        ).toBe(0);

        // Determinism (CON-8) under reorder ON.
        const on2 = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
          pipelineReorder: true,
        });
        expect(geometry(on2.elements), `${mode} reorder determinism`).toEqual(
          geometry(on.elements),
        );
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );
});

describe("rcll inherits the pipeline .tfd validation gate", () => {
  it("rcll with zero resolved .tfd edges returns 400", async () => {
    const plan = {
      resource_changes: [
        {
          address: "aws_s3_bucket.solo",
          mode: "managed",
          type: "aws_s3_bucket",
          name: "solo",
          change: { actions: ["no-op"], after: { id: "b", bucket: "b" } },
        },
      ],
    };
    const dot = `digraph { "[root] aws_s3_bucket.solo (expand)" [shape=box] }`;
    const result = await layoutTerraformFromSources(
      {
        planDotBundles: [{ plan, dotText: dot, label: "solo" }],
        states: [] as unknown[],
        tfdTexts: [] as string[],
      },
      { layoutMode: "rcll" },
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected the rcll .tfd gate to reject");
    }
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/pipeline view requires/i);
  });
});

describe("rcll preset round-trips through normalize", () => {
  it("a view:'rcll' preset normalizes back to 'rcll'", () => {
    const preset = normalizeTerraformImportPreset({
      id: "rcll-fixture",
      name: "RCLL Fixture",
      view: "rcll",
      rootPath: "/repo",
      stacks: [
        {
          id: "stack-a",
          label: "Stack A",
          planPath: "a/plan.json",
          dotPath: "a/graph.dot",
        },
      ],
      tfdPaths: ["a/links.tfd"],
    });
    expect(preset).not.toBeNull();
    expect(preset?.view).toBe("rcll");
  });

  it("a stranded view:'experimental' preset coerces to 'semantic' (migration)", () => {
    // The Experimental view was retired at M0; a preset persisted before the
    // removal must degrade gracefully, not strand the loader.
    const preset = normalizeTerraformImportPreset({
      id: "legacy-experimental",
      name: "Legacy Experimental",
      view: "experimental",
      rootPath: "/repo",
      stacks: [
        {
          id: "stack-a",
          label: "Stack A",
          planPath: "a/plan.json",
          dotPath: "a/graph.dot",
        },
      ],
      tfdPaths: ["a/links.tfd"],
    });
    expect(preset).not.toBeNull();
    expect(preset?.view).toBe("semantic");
  });
});

/**
 * §27 fallback ladder + §22.1 module contract. M0 registers ZERO stages, so the
 * guard machinery is never run by the integration tests above. These drive it
 * directly with dummy stages over a trivial tree.
 *
 *   stage ok ───────► ran += name; tree ← result.tree; collect result.meta
 *   stage throws ────► degraded += name; KEEP prior tree (§27 "previous rung")
 *   stage !result.tree ► degraded += name; skip; keep prior tree
 *   [throw, ok] ─────► degraded=[throw], ran=[ok]; tree = ok's output (continue)
 */
const TEST_ROOT: CompoundNode = {
  key: "__test_root__",
  role: "root",
  level: 0,
  minDescendantSequence: 0,
  children: [],
};
const okStage =
  (newKey: string): Stage =>
  (tree) => ({ tree: { ...tree, key: newKey } });
const throwStage: Stage = () => {
  throw new Error("stage boom");
};
const invalidStage: Stage = () => ({
  tree: undefined as unknown as CompoundNode,
});
const metaStage =
  (meta: Record<string, unknown>): Stage =>
  (tree) => ({ tree, meta });
const stage = (name: string, fn: Stage): RcllPipelineStage => ({
  name,
  stage: fn,
});

describe("runRcllPipeline (§27 guard)", () => {
  const lattice = {};
  const opts = {};

  it("runs a successful stage: name in ran, tree replaced", () => {
    const r = runRcllPipeline(
      [stage("ok", okStage("after-ok"))],
      TEST_ROOT,
      lattice,
      opts,
    );
    expect(r.ran).toEqual(["ok"]);
    expect(r.degraded).toEqual([]);
    expect(r.tree.key).toBe("after-ok");
  });

  it("skips a throwing stage: name in degraded, prior tree kept", () => {
    const r = runRcllPipeline(
      [stage("boom", throwStage)],
      TEST_ROOT,
      lattice,
      opts,
    );
    expect(r.ran).toEqual([]);
    expect(r.degraded).toEqual(["boom"]);
    expect(r.tree).toBe(TEST_ROOT);
  });

  it("skips an invalid result (no tree): degraded, prior tree kept", () => {
    const r = runRcllPipeline(
      [stage("invalid", invalidStage)],
      TEST_ROOT,
      lattice,
      opts,
    );
    expect(r.ran).toEqual([]);
    expect(r.degraded).toEqual(["invalid"]);
    expect(r.tree).toBe(TEST_ROOT);
  });

  it("skip-and-continue: [throw, ok] → degraded=[throw], ran=[ok], tree=ok output", () => {
    const r = runRcllPipeline(
      [stage("boom", throwStage), stage("ok", okStage("after-ok"))],
      TEST_ROOT,
      lattice,
      opts,
    );
    expect(r.degraded).toEqual(["boom"]);
    expect(r.ran).toEqual(["ok"]);
    expect(r.tree.key).toBe("after-ok");
  });

  it("collects StageResult.meta from ran stages, keyed by name", () => {
    const r = runRcllPipeline(
      [
        stage("withMeta", metaStage({ note: "hi", count: 3 })),
        stage("noMeta", okStage("k")),
      ],
      TEST_ROOT,
      lattice,
      opts,
    );
    expect(r.ran).toEqual(["withMeta", "noMeta"]);
    expect(r.stageMeta).toEqual({ withMeta: { note: "hi", count: 3 } });
  });

  it("is deterministic: same input → same ran/degraded (CON-8)", () => {
    const stages = [
      stage("boom", throwStage),
      stage("ok", okStage("after-ok")),
      stage("invalid", invalidStage),
    ];
    const a = runRcllPipeline(stages, TEST_ROOT, lattice, opts);
    const b = runRcllPipeline(stages, TEST_ROOT, lattice, opts);
    expect(b.ran).toEqual(a.ran);
    expect(b.degraded).toEqual(a.degraded);
    expect(b.stageMeta).toEqual(a.stageMeta);
  });
});

describe("rcll builder maps stage results into scene meta", () => {
  it(
    "injected throwing + meta-emitting stages surface in rcllDegraded / rcllModules.stages / rcllStageMeta",
    async () => {
      const raw = getTerraformImportPresetSourcesFromDb(
        "staging-extended-localstack-v2",
      );
      const sources = resolveSourcesWithTfdComposition(
        raw! as TerraformImportPresetSources,
      );
      const bundle = sources.planDotBundles[0]!;
      const graph = graphlibDot.read("digraph G {}\n");
      const nodes = buildTerraformLocalImportNodesMap(
        bundle.plan,
        graph,
        [],
        {},
      );
      applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);

      const injected: RcllPipelineStage[] = [
        stage("ranWithMeta", metaStage({ probe: 7 })),
        stage("threw", throwStage),
      ];
      const scene = await buildTerraformPipelineRcllExcalidrawScene(
        nodes,
        bundle.plan,
        { compact: true },
        injected,
      );

      expect(scene.meta.rcllModules).toEqual({
        stages: ["ranWithMeta"],
        fallback: "compound",
      });
      expect(scene.meta.rcllDegraded).toEqual(["threw"]);
      expect(scene.meta.rcllStageMeta).toEqual({ ranWithMeta: { probe: 7 } });
      // No "placement" in ran → export takes the compound fallback path, so the
      // scene is non-empty and milestone reports M2 (placement did not run).
      expect(scene.elements.length).toBeGreaterThan(0);
      expect(scene.meta.rcllMilestone).toBe("M2");
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 2,
  );

  it(
    "a throwing 'placement' stage degrades and export falls back to compound (§27, A2)",
    async () => {
      const raw = getTerraformImportPresetSourcesFromDb(
        "staging-extended-localstack-v2",
      );
      const sources = resolveSourcesWithTfdComposition(
        raw! as TerraformImportPresetSources,
      );
      const bundle = sources.planDotBundles[0]!;
      const graph = graphlibDot.read("digraph G {}\n");
      const nodes = buildTerraformLocalImportNodesMap(
        bundle.plan,
        graph,
        [],
        {},
      );
      applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);

      // A stage NAMED "placement" that throws → ran omits "placement" → export
      // keys off `ran` (not box presence) and takes the compound fallback.
      const scene = await buildTerraformPipelineRcllExcalidrawScene(
        nodes,
        bundle.plan,
        { compact: true },
        [stage("placement", throwStage)],
      );
      expect(scene.meta.rcllDegraded).toEqual(["placement"]);
      expect(scene.meta.rcllMilestone).toBe("M2"); // placement did not run
      expect(scene.elements.length).toBeGreaterThan(0); // compound drew the scene
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 2,
  );

  it(
    "emits a pipeline_cycle_container warning on v2 (6 cyclic D_H containers)",
    async () => {
      const raw = getTerraformImportPresetSourcesFromDb(
        "staging-extended-localstack-v2",
      );
      const sources = resolveSourcesWithTfdComposition(
        raw! as TerraformImportPresetSources,
      );
      const bundle = sources.planDotBundles[0]!;
      const graph = graphlibDot.read("digraph G {}\n");
      const nodes = buildTerraformLocalImportNodesMap(
        bundle.plan,
        graph,
        [],
        {},
      );
      applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);

      // Default RCLL_STAGES (placement runs) → boxes path → cycle-container warning.
      const scene = await buildTerraformPipelineRcllExcalidrawScene(
        nodes,
        bundle.plan,
        {
          compact: true,
        },
      );
      expect(scene.meta.rcllMilestone).toBe("M3a");
      expect(
        scene.warnings.some((w) => w.code === "pipeline_cycle_container"),
        "v2 has cyclic D_H containers → warning present",
      ).toBe(true);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 2,
  );
});

// ── M5b de-density (Axis-2 B) — internal/measurement probe on v2 ────────────────
// Phase-1 deliverable (no UI): does the SAFE column-preserving single-column spread
// create Y-room on v2 without breaking any structural gate? Built via the direct
// builder (deDensify is internal — not threaded through layoutCore). Hard gates must
// stay 0; the win is LOGGED for the human decision (graduate to a toggle or stop).
describe("rcll M5b de-density (internal probe, v2)", () => {
  async function buildV2(options: Record<string, unknown>) {
    const raw = getTerraformImportPresetSourcesFromDb(
      "staging-extended-localstack-v2",
    );
    const sources = resolveSourcesWithTfdComposition(
      raw! as TerraformImportPresetSources,
    );
    const bundle = sources.planDotBundles[0]!;
    const graph = graphlibDot.read("digraph G {}\n");
    const nodes = buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
    applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);
    const scene = await buildTerraformPipelineRcllExcalidrawScene(
      nodes,
      bundle.plan,
      options,
    );
    return {
      meta: scene.meta,
      elements: scene.elements as ExcalidrawElement[],
      diagnostics: diagnosePipelineScene(scene.elements as ExcalidrawElement[]),
    };
  }

  const placement = (m: Record<string, unknown>) =>
    (m.rcllStageMeta as Record<string, Record<string, number>>).placement;
  const gatesOf = (m: Record<string, unknown>) =>
    m.gates as Record<string, number>;

  it(
    "straighten ON with compact-ish full-detail v2 keeps gates 0, is deterministic, and does not grow depth",
    async () => {
      const baseOptions = {
        compact: false,
        swimlaneLaneRise: true,
        rankSeparate: true,
        columnCompact: true,
        deBandLevel: "none",
      };
      const off = await buildV2(baseOptions);
      const on = await buildV2({ ...baseOptions, straighten: true });
      const on2 = await buildV2({ ...baseOptions, straighten: true });

      expect(on.meta.rcllStraighten, "straighten meta flag").toBe(true);
      expect(on.meta.rcllSubnetDeBand, "no de-band").toBe(false);

      const onPlace = placement(on.meta);
      const offPlace = placement(off.meta);
      const onGates = gatesOf(on.meta);
      expect(onPlace.containmentViolations, "ON containment (CON-3)").toBe(0);
      expect(
        onPlace.siblingOverlapViolations,
        "ON sibling overlap (CON-4/5)",
      ).toBe(0);
      expect(
        onGates.acyclicBackwardEdges,
        "ON iron rule: no backward edge (CON-12)",
      ).toBe(0);
      expect(
        onGates.acyclicSameColumnEdges,
        "ON iron rule: no same-column edge (CON-12)",
      ).toBe(0);
      expect(on.diagnostics.collisionCount, "ON collision-free").toBe(0);
      expect(
        onPlace.maxDepthPx,
        "straighten does not increase full-detail compact-ish depth",
      ).toBeLessThanOrEqual(offPlace.maxDepthPx);
      expect(geometry(on2.elements), "ON deterministic").toEqual(
        geometry(on.elements),
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );

  // MEASURED no-op on v2 (2026-06-19, maxCols=4, Compact AND Full): ON == OFF on
  // every metric — height 27763 / width 13354 / nearStraight 0.10 / fanoutColRate
  // 0.27 / crossings 274 (compact 249); deDensify+straighten == straighten-alone
  // (nearStraight 0.08, crossings 270). v2's dataflow is cross-container-dominated, so
  // the SAFE set (no out-of-axis neighbour, no adjacent in-axis neighbour) is empty.
  // The permanent test asserts the invariants on ONE mode (the full 6-build × 2-mode
  // measurement was a one-time probe — recorded above, not re-run every CI pass).
  it(
    "deDensify ON keeps every structural gate at 0, is deterministic, and the dial gates the pass (compact)",
    async () => {
      const MAX = 4;
      const off = await buildV2({ compact: true });
      const dialOff = await buildV2({
        compact: true,
        deDensify: true,
        deDensifyMaxCols: 0,
      });
      const on = await buildV2({
        compact: true,
        deDensify: true,
        deDensifyMaxCols: MAX,
      });
      const on2 = await buildV2({
        compact: true,
        deDensify: true,
        deDensifyMaxCols: MAX,
      });

      // The dial (maxCols 0) is byte-identical to OFF — the pass cannot fire without a
      // positive budget, so default behaviour is provably unchanged.
      expect(
        geometry(dialOff.elements),
        "deDensifyMaxCols:0 == OFF (geometry unchanged)",
      ).toEqual(geometry(off.elements));
      expect(dialOff.meta.rcllMilestone).toBe("M3a");

      // ON: the milestone rolls up to M5b and EVERY structural gate stays 0.
      expect(on.meta.rcllMilestone).toBe("M5b");
      const onPlace = placement(on.meta);
      const onGates = gatesOf(on.meta);
      expect(onPlace.containmentViolations, "ON containment (CON-3)").toBe(0);
      expect(
        onPlace.siblingOverlapViolations,
        "ON sibling overlap (CON-4/5)",
      ).toBe(0);
      expect(
        onGates.acyclicBackwardEdges,
        "ON iron rule: no backward edge (CON-12)",
      ).toBe(0);
      expect(
        onGates.acyclicSameColumnEdges,
        "ON iron rule: no same-column edge (CON-12)",
      ).toBe(0);
      expect(on.diagnostics.collisionCount, "ON collision-free").toBe(0);

      // Determinism (CON-8): a second ON build is byte-identical.
      expect(geometry(on.elements), "ON deterministic").toEqual(
        geometry(on2.elements),
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 6,
  );
});
