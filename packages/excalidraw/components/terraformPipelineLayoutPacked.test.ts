/**
 * Packed pipeline layout: rightward depth shifts for sink-only groups plus
 * hierarchical Y re-packing. Note: under `pipelinePacked`, fan-out targets in
 * different lanes may legitimately land in different columns (unlike the
 * default layout, where fan-out targets always share the next column); the
 * preserved invariants are TFD edge direction and overlap-free frames.
 */
import { describe, expect, it } from "vitest";

import graphlibDot from "@dagrejs/graphlib-dot";
import { getCommonBounds } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformImportPresetSourcesFromDb } from "../../../excalidraw-app/dev/terraformImportPresetDb.mjs";

import { STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS } from "../test-fixtures/terraformPresetFixtures";

import { resolveSourcesWithTfdComposition } from "./terraformImportCompositionResolve";
import { layoutTerraformViaWorkers } from "./terraformLayoutWorkerClient";
import {
  applyPackedDepthShifts,
  computePackedDepthShifts,
  placeClustersPackedGrid,
} from "./terraformPipelineLayoutPacked";
import {
  computeDepths,
  computeGlobalColumnX,
  placeClustersClassicGrid,
  type CollapsedPipelineEdge,
  type PipelineCluster,
  type PipelineLayoutPrep,
  type PipelinePlacement,
} from "./terraformPipelineLayoutShared";
import {
  applyTfdOverlayToNodes,
  buildTerraformLocalImportNodesMap,
} from "./terraformPlanParsing";

import type { TerraformImportPresetSources } from "./terraformImportPresetsTypes";

const placementOf = (
  accountId: string,
  region: string,
  vpcId: string | null = null,
  subnetSignature?: string,
): PipelinePlacement => ({
  providerFamily: "aws",
  accountId,
  region,
  vpcId,
  ...(subnetSignature != null ? { subnetSignature } : {}),
});

type ClusterDef = {
  id: string;
  placement: PipelinePlacement;
  width?: number;
  height?: number;
};

function makePrep(
  defs: ClusterDef[],
  edgePairs: Array<[string, string]>,
): PipelineLayoutPrep {
  const collapsedEdges: CollapsedPipelineEdge[] = edgePairs.map(
    ([source, target], sequence) => ({
      source,
      target,
      sequence,
      original: { source, target, sequence, origin: "tfd" } as never,
    }),
  );
  const ids = defs.map((d) => d.id);
  const depthResult = computeDepths(collapsedEdges, ids);
  const firstSeq = new Map<string, number>();
  for (const edge of collapsedEdges) {
    firstSeq.set(
      edge.source,
      Math.min(firstSeq.get(edge.source) ?? edge.sequence, edge.sequence),
    );
    firstSeq.set(
      edge.target,
      Math.min(firstSeq.get(edge.target) ?? edge.sequence, edge.sequence),
    );
  }
  const clusters: PipelineCluster[] = defs.map((def) => ({
    id: def.id,
    primaryAddress: def.id,
    firstSequence: firstSeq.get(def.id) ?? 0,
    depth: depthResult.depths.get(def.id) ?? 0,
    placement: def.placement,
    build: {
      skeleton: [],
      width: def.width ?? 260,
      height: def.height ?? 120,
      clusterFrameId: `tf-pipeline:cluster:${encodeURIComponent(def.id)}`,
    },
  }));
  const maxDepth = Math.max(0, ...clusters.map((c) => c.depth));
  return {
    clusters,
    collapsedEdges,
    maxDepth,
    columnX: computeGlobalColumnX(clusters, maxDepth),
    depthResult,
  };
}

function depthAfter(
  prep: PipelineLayoutPrep,
  shifts: ReturnType<typeof computePackedDepthShifts>,
  id: string,
): number {
  return (
    shifts.shiftedDepths.get(id) ??
    prep.clusters.find((c) => c.id === id)!.depth
  );
}

function expectEdgesMonotone(
  prep: PipelineLayoutPrep,
  shifts: ReturnType<typeof computePackedDepthShifts>,
): void {
  for (const edge of prep.collapsedEdges) {
    expect(depthAfter(prep, shifts, edge.source)).toBeLessThan(
      depthAfter(prep, shifts, edge.target),
    );
  }
}

const boxesOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  epsilon = 0.5,
): boolean =>
  a.x + epsilon < b.x + b.width &&
  b.x + epsilon < a.x + a.width &&
  a.y + epsilon < b.y + b.height &&
  b.y + epsilon < a.y + a.height;

/** Region chain a0..a4 in us-east-1, fan-out from a2 to three sink regions. */
function fanOutPrep(): PipelineLayoutPrep {
  const inUsEast1 = (id: string) => ({
    id,
    placement: placementOf("acct1", "us-east-1"),
  });
  return makePrep(
    [
      inUsEast1("a0"),
      inUsEast1("a1"),
      inUsEast1("a2"),
      inUsEast1("a3"),
      inUsEast1("a4"),
      { id: "r1", placement: placementOf("acct1", "us-west-1") },
      { id: "r2", placement: placementOf("acct1", "us-west-2") },
      { id: "r3", placement: placementOf("acct1", "eu-west-1") },
    ],
    [
      ["a0", "a1"],
      ["a1", "a2"],
      ["a2", "a3"],
      ["a3", "a4"],
      ["a2", "r1"],
      ["a2", "r2"],
      ["a2", "r3"],
    ],
  );
}

describe("computePackedDepthShifts", () => {
  it("pushes sink regions past the column span of their source region", () => {
    const prep = fanOutPrep();
    const shifts = computePackedDepthShifts(prep);

    // us-east-1 spans columns 0..4; the three receiver regions start at
    // column 3 and must end up past column 4 to sit beside it.
    expect(shifts.groupShiftCount).toBe(3);
    expect(shifts.shiftCount).toBe(3);
    for (const id of ["r1", "r2", "r3"]) {
      expect(depthAfter(prep, shifts, id)).toBe(5);
    }
    for (const id of ["a0", "a1", "a2", "a3", "a4"]) {
      expect(shifts.shiftedDepths.has(id)).toBe(false);
    }
    expectEdgesMonotone(prep, shifts);
  });

  it("pushes a pure-receiver lane past sibling lanes in the same VPC", () => {
    const app = (id: string) => ({
      id,
      placement: placementOf("acct1", "us-east-1", "vpc-1", "app"),
    });
    const prep = makePrep(
      [
        app("b0"),
        app("b1"),
        app("b2"),
        {
          id: "db0",
          placement: placementOf("acct1", "us-east-1", "vpc-1", "db"),
        },
      ],
      [
        ["b0", "b1"],
        ["b1", "b2"],
        ["b0", "db0"],
      ],
    );
    const shifts = computePackedDepthShifts(prep);
    expect(depthAfter(prep, shifts, "db0")).toBe(3);
    expectEdgesMonotone(prep, shifts);
  });

  it("keeps a receiver in place when an outgoing edge leaves no slack", () => {
    const app = (id: string) => ({
      id,
      placement: placementOf("acct1", "us-east-1", "vpc-1", "app"),
    });
    const prep = makePrep(
      [
        app("b0"),
        app("b1"),
        app("b2"),
        {
          id: "db0",
          placement: placementOf("acct1", "us-east-1", "vpc-1", "db"),
        },
        { id: "ext", placement: placementOf("acct1", "us-west-1") },
      ],
      [
        ["b0", "b1"],
        ["b1", "b2"],
        ["b0", "db0"],
        ["db0", "ext"],
      ],
    );
    const shifts = computePackedDepthShifts(prep);
    // us-west-1 (sink region) moves past us-east-1's span, but the db lane
    // cannot fully clear the app lane without overtaking its own target.
    expect(depthAfter(prep, shifts, "ext")).toBe(3);
    expect(shifts.shiftedDepths.has("db0")).toBe(false);
    expectEdgesMonotone(prep, shifts);
  });

  it("returns no shifts when the collapsed edge graph has a cycle", () => {
    const prep = makePrep(
      [
        { id: "x", placement: placementOf("acct1", "us-east-1") },
        { id: "y", placement: placementOf("acct1", "us-east-1") },
      ],
      [
        ["x", "y"],
        ["y", "x"],
      ],
    );
    expect(prep.depthResult.hasCycle).toBe(true);
    const shifts = computePackedDepthShifts(prep);
    expect(shifts.shiftCount).toBe(0);
    expect(shifts.groupShiftCount).toBe(0);
  });

  it("is deterministic", () => {
    const a = computePackedDepthShifts(fanOutPrep());
    const b = computePackedDepthShifts(fanOutPrep());
    expect([...a.shiftedDepths.entries()]).toEqual([
      ...b.shiftedDepths.entries(),
    ]);
    expect(a.groupShiftCount).toBe(b.groupShiftCount);
  });
});

describe("placeClustersPackedGrid", () => {
  it("packs shifted regions beside the source region without overlaps", () => {
    const basePrep = fanOutPrep();
    const classic = placeClustersClassicGrid(basePrep);
    const prep = applyPackedDepthShifts(
      basePrep,
      computePackedDepthShifts(basePrep),
    );
    const packed = placeClustersPackedGrid(prep);

    const clusterBoxes = prep.clusters.map((c) => ({
      id: c.id,
      box: packed.layoutBoxes.get(c.build.clusterFrameId)!,
    }));
    for (const entry of clusterBoxes) {
      expect(entry.box).toBeTruthy();
    }
    for (let i = 0; i < clusterBoxes.length; i++) {
      for (let j = i + 1; j < clusterBoxes.length; j++) {
        expect(boxesOverlap(clusterBoxes[i]!.box, clusterBoxes[j]!.box)).toBe(
          false,
        );
      }
    }

    for (const edge of prep.collapsedEdges) {
      const source = packed.layoutBoxes.get(edge.source)!;
      const target = packed.layoutBoxes.get(edge.target)!;
      expect(source.x).toBeLessThan(target.x);
    }

    const heightOf = (
      boxes: Map<string, { y: number; height: number }>,
    ): number => {
      let min = Infinity;
      let max = -Infinity;
      for (const box of boxes.values()) {
        min = Math.min(min, box.y);
        max = Math.max(max, box.y + box.height);
      }
      return max - min;
    };
    expect(heightOf(packed.layoutBoxes)).toBeLessThan(
      heightOf(classic.layoutBoxes),
    );
  });
});

type LooseElement = ExcalidrawElement & {
  customData?: Record<string, unknown>;
};

function expectNoOverlappingFramesPerRole(
  elements: readonly LooseElement[],
): void {
  const byRole = new Map<string, LooseElement[]>();
  for (const el of elements) {
    if (el.type !== "frame" || el.isDeleted) {
      continue;
    }
    const role = el.customData?.terraformTopologyRole;
    if (typeof role !== "string") {
      continue;
    }
    byRole.set(role, [...(byRole.get(role) ?? []), el]);
  }
  expect(byRole.size).toBeGreaterThan(0);
  for (const [role, frames] of byRole) {
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        const a = frames[i]!;
        const b = frames[j]!;
        const overlap = boxesOverlap(
          { x: a.x, y: a.y, width: a.width, height: a.height },
          { x: b.x, y: b.y, width: b.width, height: b.height },
        );
        if (overlap) {
          throw new Error(
            `Overlapping ${role} frames: ${a.id} [${a.x},${a.y},${a.width},${a.height}] vs ${b.id} [${b.x},${b.y},${b.width},${b.height}]`,
          );
        }
      }
    }
  }
}

async function buildPresetPipelineScene(presetId: string, packed: boolean) {
  const raw = getTerraformImportPresetSourcesFromDb(presetId);
  expect(raw).not.toBeNull();
  const sources = resolveSourcesWithTfdComposition(
    raw! as TerraformImportPresetSources,
  );
  expect(sources.compositionErrors ?? []).toEqual([]);
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
      pipelineLayoutVariant: "compound",
      pipelinePacked: packed,
    },
  );
  const elements = body.elements as LooseElement[];
  const [, minY, , maxY] = getCommonBounds(elements as ExcalidrawElement[]);
  return {
    elements,
    meta: (body.meta ?? {}) as Record<string, unknown>,
    sources,
    height: maxY - minY,
  };
}

describe("packed compound pipeline on staging-extended-localstack-v2", () => {
  it(
    "reduces scene height, keeps frames overlap-free, and respects TFD direction",
    async () => {
      const presetId = "staging-extended-localstack-v2";
      const stacked = await buildPresetPipelineScene(presetId, false);
      const packed = await buildPresetPipelineScene(presetId, true);

      expect(stacked.meta.pipelinePackedApplied).toBeUndefined();
      expect(packed.meta.pipelinePackedApplied).toBe(true);
      expect(
        packed.meta.pipelinePackedGroupShiftCount as number,
      ).toBeGreaterThan(0);
      expect(packed.height).toBeLessThan(stacked.height);

      expectNoOverlappingFramesPerRole(stacked.elements);
      expectNoOverlappingFramesPerRole(packed.elements);

      // TFD direction at the cluster-frame level: rebuild prep with the same
      // inputs and assert every collapsed edge points left to right.
      const bundle = packed.sources.planDotBundles[0]!;
      const graph = graphlibDot.read("digraph G {}\n");
      const nodes = buildTerraformLocalImportNodesMap(
        bundle.plan,
        graph,
        [],
        {},
      );
      applyTfdOverlayToNodes(
        nodes,
        packed.sources.tfdTexts,
        packed.sources.tfdLabels,
      );
      const { preparePipelineLayout } = await import(
        "./terraformPipelineLayoutShared"
      );
      const basePrep = preparePipelineLayout(nodes, bundle.plan, true);
      const shifts = computePackedDepthShifts(basePrep);
      expectEdgesMonotone(basePrep, shifts);

      const shifted = applyPackedDepthShifts(basePrep, shifts);
      const placed = placeClustersPackedGrid(shifted);
      for (const edge of shifted.collapsedEdges) {
        const source = placed.layoutBoxes.get(edge.source)!;
        const target = placed.layoutBoxes.get(edge.target)!;
        expect(source.x).toBeLessThan(target.x);
      }
    },
    STAGING_SEMANTIC_LAYOUT_TEST_TIMEOUT_MS * 2,
  );
});
