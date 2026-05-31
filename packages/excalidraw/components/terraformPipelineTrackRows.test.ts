import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";

import { loadStagingMultiStatePlanDotBundlesFromDb } from "../test-fixtures/terraformPresetFixtures";

import { applyDeclaredDataFlowFromMany } from "./terraformDeclaredDataFlow";
import { buildPipelineAtomGraph } from "./terraformPipelineAtoms";
import {
  assignPipelineColumnPackedY,
  buildColumnPackInputs,
} from "./terraformPipelineColumnPack";
import { buildPipelineLayoutPlan } from "./terraformPipelineContainers";
import { buildPipelineAtomGeoMap } from "./terraformPipelineGeo";
import {
  mergePlanJsons,
  namespacePlanDotBundles,
} from "./terraformImportMerge";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { buildTfdPrimaryParentMap } from "./terraformPipelineTfd";
import { applyPipelineVerticalSolver } from "./terraformPipelineVerticalSolver";
import { baseRowCenterYForTrack } from "./terraformPipelineTrackRows";
import { DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE } from "./terraformPipelineLayoutMode";

const NOMINAL_SLOT = 96;
const GAP = 24;
const TRACK_GAP = 32;
const ROW_PITCH = NOMINAL_SLOT + GAP + TRACK_GAP;
const Y_ALIGN_EPS = 2;

function readStagingPipelineTfdFromRepo(): string {
  return readFileSync(
    join(
      process.cwd(),
      "packages/backend/terraform/staging-multi-state/pipeline.tfd",
    ),
    "utf8",
  );
}

describe("terraformPipelineTrackRows", () => {
  it("defaults vertical solver to track-rows", () => {
    expect(DEFAULT_TERRAFORM_PIPELINE_VERTICAL_SOLVER_MODE).toBe("track-rows");
  });

  it("places api11 at api11 row index", () => {
    const y = baseRowCenterYForTrack("api11", ROW_PITCH, NOMINAL_SLOT);
    expect(y).toBe(NOMINAL_SLOT / 2 + 10 * ROW_PITCH);
  });

  it("aligns west api11 ECS with Aurora on staging global-relayer", async () => {
    const bundles = loadStagingMultiStatePlanDotBundlesFromDb();
    const { bundles: namespaced, stackIds } = namespacePlanDotBundles(bundles);
    const merged = mergePlanJsons(
      namespaced.map((b) => b.plan),
      namespaced.map((b) => b.label),
    );
    const graph = graphlibDot.read("digraph G {}\n");
    const nodes = buildTerraformLocalImportNodesMap(merged.plan, graph, [], {
      adjacency: {},
      priorStatePlans: merged.sourcePlans,
      stackIds,
    });
    const tfd = readStagingPipelineTfdFromRepo();
    applyDeclaredDataFlowFromMany(nodes, [tfd]);

    const atomGraph = buildPipelineAtomGraph(nodes, merged.plan, [tfd])!;
    const geoMap = buildPipelineAtomGeoMap(atomGraph, nodes, merged.plan);
    const layoutPlan = buildPipelineLayoutPlan(
      atomGraph,
      geoMap,
      "global-relayer",
    );

    const slotHeight = new Map(
      layoutPlan.placements.map((p) => [p.primaryAddress, NOMINAL_SLOT]),
    );
    const { colByAtom } = buildColumnPackInputs(layoutPlan, slotHeight);
    assignPipelineColumnPackedY(
      layoutPlan.placements,
      layoutPlan.columns,
      atomGraph.edges,
      slotHeight,
      colByAtom,
    );

    const pick = (parts: string[]) =>
      [...atomGraph.atoms.keys()].find((a) =>
        parts.every((p) => a.includes(p)),
      )!;

    const api11Cmp = pick(["53-west-api-11", "aws_ecs_service"]);
    const api11Gw = pick(["53-west-api-11", "aws_api_gateway"]);
    const api11Store = pick(["api11_aurora", "aws_rds_cluster"]);

    const primaryParent = buildTfdPrimaryParentMap(atomGraph.edges);
    await applyPipelineVerticalSolver(
      layoutPlan.placements,
      layoutPlan.columns,
      atomGraph.edges,
      slotHeight,
      colByAtom,
      { mode: "track-rows", primaryParent },
    );

    const y = (addr: string) =>
      layoutPlan.placements.find((p) => p.primaryAddress === addr)!
        .packedOffsetY!;

    expect(Math.abs(y(api11Cmp) - y(api11Store))).toBeLessThan(Y_ALIGN_EPS);
    expect(Math.abs(y(api11Gw) - y(api11Cmp))).toBeLessThan(Y_ALIGN_EPS);
    expect(y(api11Cmp)).toBe(baseRowCenterYForTrack("api11", ROW_PITCH, NOMINAL_SLOT));
  }, 120_000);
});
