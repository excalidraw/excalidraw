/**
 * Integration test for the RCLL pipeline view (RFC docs/pipeline-rcll-layout-design.md)
 * — through milestone M2 — on staging-extended-localstack-v2.
 *
 * The seam is import → pipeline → export; the compound builder is the §27
 * fallback rung. Through M2 the layering stage writes localColumn on the model
 * but the compound builder still draws the picture, so RCLL output stays
 * geometrically identical to the compound view (M3 turns columns into pixels).
 * This test gates the seam + the M2 model-level acceptance gate:
 *   - routing: meta.pipelineVariant === "rcll" + seam shape
 *     (rcllMilestone / rcllModules / rcllDegraded)
 *   - M2 gate (rcllStageMeta.layering): fan-out-column rate = 1.0, CON-1/CON-6 = 0
 *   - delegate ≡ compound: equality over an element-geometry projection
 *     (NOT the whole scene/meta — meta diverges by design)
 *   - gates unchanged vs compound (collisions, semanticEdgeViolations)
 *   - determinism (CON-8): a second build is byte-identical in geometry AND
 *     meta (meta carries no timings, so it must be reproducible)
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

describe("pipeline view rcll (M2)", () => {
  it(
    "staging-extended-localstack-v2 — routes to rcll, geometry ≡ compound, gates unchanged, deterministic",
    async () => {
      for (const compact of [true, false]) {
        const mode = compact ? "compact" : "full";

        const rcll = await layout("staging-extended-localstack-v2", {
          layoutMode: "rcll",
          pipelineCompact: compact,
        });
        // Same two knobs the RCLL builder re-passes to the fallback rung; the
        // rest (packed/pullLeft/semantic) default off on both sides.
        const compound = await layout("staging-extended-localstack-v2", {
          layoutMode: "pipeline",
          pipelineLayoutVariant: "compound",
          pipelineCompact: compact,
        });

        // Routing + seam shape. M2 registers the layering stage; it writes
        // localColumn on the model but changes NO geometry (still ≡ compound).
        expect(rcll.meta.pipelineVariant, `${mode} variant`).toBe("rcll");
        expect(rcll.meta.rcllMilestone, `${mode} milestone`).toBe("M2");
        expect(rcll.meta.rcllModules, `${mode} modules`).toEqual({
          stages: ["layering"],
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

        // Delegate ≡ compound: identical drawing (geometry projection only).
        expect(geometry(rcll.elements), `${mode} geometry ≡ compound`).toEqual(
          geometry(compound.elements),
        );

        // Gates unchanged vs compound.
        expect(
          rcll.diagnostics.collisionCount,
          `${mode} collisions == compound`,
        ).toBe(compound.diagnostics.collisionCount);
        expect(
          rcll.diagnostics.semanticEdgeViolations,
          `${mode} edge violations == compound`,
        ).toEqual(compound.diagnostics.semanticEdgeViolations);

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
      // Stages operate on the internal tree only; geometry still comes from the
      // compound fallback, so the scene is non-empty and unaffected by injection.
      expect(scene.elements.length).toBeGreaterThan(0);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 2,
  );
});
