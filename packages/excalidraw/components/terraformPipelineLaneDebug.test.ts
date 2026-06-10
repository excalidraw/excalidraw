/**
 * Pipeline vertical-height diagnostic for agent / human debugging.
 *
 * Run:
 *   VITEST_TERRAFORM_VERBOSE=1 yarn vitest run \
 *     packages/excalidraw/components/terraformPipelineLaneDebug.test.ts
 *
 * Explains why pipeline diagrams are tall: lane stacking (account×region×subnet)
 * plus context-frame padding — not element count alone.
 */
import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";
import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { DECLARED_DATAFLOW_ORDERED_KEY } from "./terraformDeclaredDataFlow";
import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import { buildTerraformLocalImportNodesMap } from "./terraformPlanParsing";
import { applyTfdOverlayToNodes } from "./terraformPlanParsing";
import { filterPlanByProviderFamily } from "./terraformProviderClassification";
import {
  buildEnrichedTopologyPlacements,
  type TopologyAddressPlacement,
} from "./terraformTopologyPlacementBuild";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

/** Mirrors terraformPipelineLayout.ts */
const LANE_GAP_Y = 96;
const CLUSTER_GAP_Y = 36;
const FRAME_PAD = 28;
const LANE_TAIL_PAD = FRAME_PAD * 4;

type LooseElement = ExcalidrawElement & {
  customData?: Record<string, unknown>;
  name?: string | null;
};

function laneKey(p: TopologyAddressPlacement): string {
  return [
    p.providerFamily,
    p.accountId,
    p.region,
    p.vpcId ?? "",
    p.subnetSignature ?? "",
  ].join("\0");
}

function decodeLane(key: string) {
  const [providerFamily, accountId, region, vpcId, subnetSignature] =
    key.split("\0");
  return {
    providerFamily,
    accountId,
    region,
    vpcId: vpcId || null,
    subnetSignature: subnetSignature || null,
  };
}

function placementFromCard(
  cd: Record<string, unknown> | undefined,
): TopologyAddressPlacement | null {
  const raw = cd?.terraformPipelinePlacement as
    | {
        accountId?: string;
        region?: string;
        vpcId?: string | null;
        subnetTier?: string | null;
        subnetSignature?: string | null;
      }
    | undefined;
  if (!raw?.accountId || !raw?.region) {
    return null;
  }
  return {
    providerFamily: "aws",
    accountId: raw.accountId,
    region: raw.region,
    vpcId: raw.vpcId ?? null,
    subnetSignature: raw.subnetSignature ?? undefined,
    subnetTier: raw.subnetTier ?? undefined,
  };
}

function frameHeight(el: LooseElement): number {
  return typeof el.height === "number" && el.height > 0 ? el.height : 0;
}

function reportPipelineLaneHeight(
  presetId: string,
  elements: readonly LooseElement[],
  meta: Record<string, unknown>,
  enrichedZoneStats: {
    total: number;
    supplementary: number;
    supplementaryEmpty: number;
  },
) {
  const [minX, minY, maxX, maxY] = getCommonBounds(elements);
  const sceneHeight = maxY - minY;
  const sceneWidth = maxX - minX;

  const framesByRole = new Map<string, { count: number; heightSum: number }>();
  const regionFrames: Array<{ name: string; y: number; height: number }> = [];

  for (const el of elements) {
    if (el.type !== "frame" || el.isDeleted) {
      continue;
    }
    const role = el.customData?.terraformTopologyRole;
    if (typeof role !== "string") {
      continue;
    }
    const h = frameHeight(el);
    const prev = framesByRole.get(role) ?? { count: 0, heightSum: 0 };
    framesByRole.set(role, {
      count: prev.count + 1,
      heightSum: prev.heightSum + h,
    });
    if (role === "region" && typeof el.name === "string") {
      regionFrames.push({ name: el.name, y: el.y, height: h });
    }
  }

  regionFrames.sort((a, b) => a.y - b.y);

  const lanes = new Map<
    string,
    { clusters: string[]; placement: TopologyAddressPlacement }
  >();
  const unknownClusters: string[] = [];

  for (const el of elements) {
    if (
      el.isDeleted ||
      el.customData?.terraformTopologyRole !== "primaryCluster"
    ) {
      continue;
    }
    const address =
      typeof el.customData.terraformPrimaryAddress === "string"
        ? el.customData.terraformPrimaryAddress
        : null;
    if (!address) {
      continue;
    }
    const childCard = elements.find(
      (c) =>
        !c.isDeleted &&
        c.type === "rectangle" &&
        c.customData?.terraformPipelineExpandable === true &&
        (c.frameId === el.id || c.id === address),
    );
    const placement =
      placementFromCard(childCard?.customData) ??
      placementFromCard(el.customData);
    if (!placement) {
      unknownClusters.push(address);
      continue;
    }
    const key = laneKey(placement);
    const existing = lanes.get(key);
    if (existing) {
      existing.clusters.push(address);
    } else {
      lanes.set(key, { clusters: [address], placement });
    }
  }

  const laneReport = [...lanes.entries()]
    .map(([key, { clusters, placement }]) => ({
      ...decodeLane(key),
      subnetTier: placement.subnetTier ?? null,
      clusterCount: clusters.length,
      clusters: clusters.slice(0, 4),
    }))
    .sort(
      (a, b) =>
        b.clusterCount - a.clusterCount ||
        a.accountId.localeCompare(b.accountId) ||
        a.region.localeCompare(b.region),
    );

  const singleClusterLanes = laneReport.filter((l) => l.clusterCount === 1);
  const approxMinLaneOverhead =
    lanes.size * (LANE_GAP_Y + LANE_TAIL_PAD) +
    laneReport.reduce(
      (sum, l) => sum + Math.max(0, l.clusterCount - 1) * CLUSTER_GAP_Y,
      0,
    );

  const contextFrameHeight = [
    "subnetZone",
    "vpc",
    "region",
    "account",
    "provider",
  ]
    .map((role) => framesByRole.get(role)?.heightSum ?? 0)
    .reduce((a, b) => a + b, 0);

  const report = {
    presetId,
    layoutMeta: meta,
    elementCount: elements.length,
    sceneBounds: {
      minX: round(minX),
      minY: round(minY),
      maxX: round(maxX),
      maxY: round(maxY),
      width: round(sceneWidth),
      height: round(sceneHeight),
    },
    heightDrivers: {
      laneCount: lanes.size,
      singleClusterLaneCount: singleClusterLanes.length,
      approxLaneStackOverheadPx: approxMinLaneOverhead,
      contextFrameHeightSumPx: round(contextFrameHeight),
      contextFrameCounts: Object.fromEntries(
        [...framesByRole.entries()].map(([role, v]) => [role, v.count]),
      ),
      zoneStats: enrichedZoneStats,
      unknownPlacementClusters: unknownClusters.slice(0, 20),
    },
    interpretation: [
      "Pipeline height ≈ sum of lane bands, not resource count.",
      "Each unique account+region+vpc+subnetSignature is one lane (terraformPipelineLayout laneKey).",
      "Each lane costs ~208px overhead (LANE_GAP_Y=96 + FRAME_PAD*4=112) before cluster cards.",
      "region/vpc/subnetZone context frames add FRAME_PAD=28 per nesting level.",
      "Many single-cluster lanes (often db/intra/private subnets or org-global nodes) inflate height.",
    ],
    topLanesByClusterCount: laneReport.slice(0, 20),
    regionFramesTopToBottom: regionFrames.slice(0, 25).map((r) => ({
      ...r,
      y: round(r.y),
      height: round(r.height),
    })),
  };

  // eslint-disable-next-line no-console -- intentional diagnostic output for agents
  console.log(
    "\n[pipeline:lane-height-diagnostic]\n",
    JSON.stringify(report, null, 2),
  );

  expect(lanes.size).toBeGreaterThan(0);
  expect(sceneHeight).toBeGreaterThan(0);
  return report;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

async function diagnosePreset(
  presetId: string,
  options?: { pipelinePacked?: boolean },
) {
  const raw = getTerraformImportPresetSourcesFromDb(presetId);
  expect(raw).not.toBeNull();
  const sources = resolveSourcesWithTfdComposition(
    raw! as TerraformImportPresetSources,
  );
  expect(sources.compositionErrors ?? []).toEqual([]);

  const bundle = sources.planDotBundles[0]!;
  const graph = graphlibDot.read("digraph G {}\n");
  const nodes = buildTerraformLocalImportNodesMap(bundle.plan, graph, [], {});
  applyTfdOverlayToNodes(nodes, sources.tfdTexts, sources.tfdLabels);

  const awsPlan = filterPlanByProviderFamily(bundle.plan as never, "aws");
  const enriched = buildEnrichedTopologyPlacements(awsPlan, nodes);
  const supplementary = enriched.zones.filter(
    (z) => z.topologyZoneSource === "supplementary",
  );
  const zoneStats = {
    total: enriched.zones.length,
    supplementary: supplementary.length,
    supplementaryEmpty: supplementary.filter((z) => z.addresses.length === 0)
      .length,
  };

  const declared = nodes[DECLARED_DATAFLOW_ORDERED_KEY];
  expect(declared?.length ?? 0).toBeGreaterThan(0);

  const body = await layoutTerraformViaWorkers(
    {
      planDotBundles: sources.planDotBundles,
      states: [],
      stateLabels: [],
      tfdTexts: sources.tfdTexts,
      tfdLabels: sources.tfdLabels,
    },
    {
      semanticLayout: false,
      layoutMode: "pipeline",
      pipelinePacked: options?.pipelinePacked === true,
    },
  );

  return reportPipelineLaneHeight(
    presetId,
    body.elements as LooseElement[],
    (body.meta ?? {}) as Record<string, unknown>,
    zoneStats,
  );
}

describe("pipeline lane height diagnostic", () => {
  it(
    "staging-extended-localstack-v2 — lane breakdown and scene height",
    async () => {
      await diagnosePreset("staging-extended-localstack-v2");
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS,
  );

  it(
    "staging-extended-localstack-v2 — packed layout option sets meta flag",
    async () => {
      const stacked = await diagnosePreset("staging-extended-localstack-v2");
      const packed = await diagnosePreset("staging-extended-localstack-v2", {
        pipelinePacked: true,
      });
      const comparison = {
        stacked: {
          height: stacked.sceneBounds.height,
          width: stacked.sceneBounds.width,
        },
        packed: {
          height: packed.sceneBounds.height,
          width: packed.sceneBounds.width,
        },
      };
      // eslint-disable-next-line no-console -- intentional diagnostic output
      console.log(
        "\n[pipeline:packed-height-comparison]\n",
        JSON.stringify(comparison, null, 2),
      );
      expect(packed.layoutMeta.pipelinePacked).toBe(true);
      // Cross-lane column slack packing is not implemented yet; heights match
      // until pipelinePacked layout logic lands (see pipeline-layout-improvement-agent-prompt.md).
      expect(packed.sceneBounds.height).toBe(stacked.sceneBounds.height);
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 2,
  );

  it(
    "staging-extended-localstack-v2 vs staging-localstack — compare lane count",
    async () => {
      const v2 = await diagnosePreset("staging-extended-localstack-v2");
      const base = await diagnosePreset("staging-localstack");
      const comparison = {
        v2: {
          laneCount: v2.heightDrivers.laneCount,
          sceneHeight: v2.sceneBounds.height,
          elementCount: v2.elementCount,
        },
        localstack: {
          laneCount: base.heightDrivers.laneCount,
          sceneHeight: base.sceneBounds.height,
          elementCount: base.elementCount,
        },
      };
      // eslint-disable-next-line no-console -- intentional diagnostic output
      console.log(
        "\n[pipeline:lane-height-comparison]\n",
        JSON.stringify(comparison, null, 2),
      );
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 2,
  );
});
