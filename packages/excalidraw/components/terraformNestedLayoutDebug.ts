import type { ExcalidrawElement } from "@excalidraw/element/types";

import { getTerraformVisibilityKey } from "./terraformVisibility";

const DEBUG_ENDPOINT =
  "http://127.0.0.1:7923/ingest/de798ee9-b1d9-4571-a526-b10e653d3365";
const DEBUG_SESSION = "dbae01";

// #region agent log
const emitNestedLayoutLog = (
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) => {
  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": DEBUG_SESSION,
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};
// #endregion

type AxisBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const axisBounds = (el: {
  x: number;
  y: number;
  width: number;
  height: number;
}): AxisBounds => ({
  minX: el.x,
  minY: el.y,
  maxX: el.x + el.width,
  maxY: el.y + el.height,
});

const contains = (outer: AxisBounds, inner: AxisBounds, eps = 12) =>
  outer.minX <= inner.minX + eps &&
  outer.minY <= inner.minY + eps &&
  outer.maxX >= inner.maxX - eps &&
  outer.maxY >= inner.maxY - eps;

const intersects = (a: AxisBounds, b: AxisBounds) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

/**
 * Runtime diagnostics for nested topology frames, explode pinning, and containment.
 */
export function emitTerraformNestedLayoutDebug(
  elements: readonly ExcalidrawElement[],
  runId = "staging",
): void {
  const visibilityKeys = new Set<string>();
  const framesById = new Map<string, ExcalidrawElement>();
  const resourceRectsByKey = new Map<string, ExcalidrawElement>();

  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    const key = getTerraformVisibilityKey(el);
    if (key) {
      visibilityKeys.add(key);
    }
    if (el.type === "frame") {
      framesById.set(el.id, el);
    }
    const cd = el.customData as
      | {
          terraformVisibilityRole?: string;
          terraformAwsIconGlyph?: boolean;
        }
      | undefined;
    if (
      el.type === "rectangle" &&
      cd?.terraformVisibilityRole === "resource" &&
      !cd?.terraformAwsIconGlyph &&
      key
    ) {
      resourceRectsByKey.set(key, el);
    }
  }

  let orphanExplodeParents = 0;
  let stackQualifiedExplodeParents = 0;
  let unprefixedExplodeParents = 0;
  const orphanSamples: string[] = [];

  for (const el of elements) {
    if (el.isDeleted) {
      continue;
    }
    const cd = el.customData as
      | {
          terraformExplodeParentKeys?: string[];
          terraformExplodeParent?: string | null;
        }
      | undefined;
    const parents = new Set<string>();
    if (typeof cd?.terraformExplodeParent === "string") {
      parents.add(cd.terraformExplodeParent);
    }
    for (const p of cd?.terraformExplodeParentKeys ?? []) {
      if (typeof p === "string") {
        parents.add(p);
      }
    }
    for (const parent of parents) {
      if (parent.includes("::")) {
        stackQualifiedExplodeParents++;
      } else {
        unprefixedExplodeParents++;
      }
      if (!visibilityKeys.has(parent)) {
        orphanExplodeParents++;
        if (orphanSamples.length < 5) {
          orphanSamples.push(parent);
        }
      }
    }
  }

  let frameContainmentViolations = 0;
  const frameViolationSamples: Array<{
    role: string;
    frameId: string;
    childCount: number;
  }> = [];

  for (const frame of framesById.values()) {
    const cd = frame.customData as
      | { terraformTopologyRole?: string }
      | undefined;
    const role = cd?.terraformTopologyRole ?? "frame";
    const kids = elements.filter((e) => e.frameId === frame.id && !e.isDeleted);
    if (kids.length === 0) {
      continue;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const kid of kids) {
      const b = axisBounds(kid);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }
    const fb = axisBounds(frame);
    const kidBounds = { minX, minY, maxX, maxY };
    if (!contains(fb, kidBounds)) {
      frameContainmentViolations++;
      if (frameViolationSamples.length < 5) {
        frameViolationSamples.push({
          role,
          frameId: frame.id,
          childCount: kids.length,
        });
      }
    }
  }

  let stackFrameOutsideVpc = 0;
  const stackSamples: Array<{
    stackId: string;
    vpcFramesInside: number;
    vpcFramesTotal: number;
  }> = [];

  const stackFrames = [...framesById.values()].filter(
    (f) =>
      (f.customData as { terraformTopologyRole?: string } | undefined)
        ?.terraformTopologyRole === "stack",
  );
  const vpcFrames = [...framesById.values()].filter((f) => {
    const role = (
      f.customData as { terraformTopologyRole?: string } | undefined
    )?.terraformTopologyRole;
    return role === "subnetZone" || role === "vpc" || role === "primaryCluster";
  });

  for (const stackFrame of stackFrames) {
    const stackId = (
      stackFrame.customData as { terraformStackId?: string } | undefined
    )?.terraformStackId;
    if (!stackId) {
      continue;
    }
    const sb = axisBounds(stackFrame);
    let inside = 0;
    for (const vf of vpcFrames) {
      const vb = axisBounds(vf);
      if (intersects(sb, vb)) {
        inside++;
        if (!contains(sb, vb)) {
          stackFrameOutsideVpc++;
        }
      }
    }
    if (stackSamples.length < 3) {
      stackSamples.push({
        stackId,
        vpcFramesInside: inside,
        vpcFramesTotal: vpcFrames.length,
      });
    }
  }

  let edgeMissingRect = 0;
  const edgeMissingSamples: string[] = [];
  for (const el of elements) {
    if (el.isDeleted || (el.type !== "line" && el.type !== "arrow")) {
      continue;
    }
    const cd = el.customData as {
      terraformEdgeLayer?: string;
      relationship?: { source?: string; target?: string };
    };
    const layer = cd?.terraformEdgeLayer;
    if (
      layer !== "dependency" &&
      layer !== "dataFlow" &&
      layer !== "networking"
    ) {
      continue;
    }
    const rel = cd?.relationship;
    if (!rel?.source || !rel?.target) {
      continue;
    }
    if (
      !resourceRectsByKey.has(rel.source) ||
      !resourceRectsByKey.has(rel.target)
    ) {
      edgeMissingRect++;
      if (edgeMissingSamples.length < 5) {
        edgeMissingSamples.push(`${rel.source} -> ${rel.target}`);
      }
    }
  }

  let frameIdOrphans = 0;
  for (const el of elements) {
    if (el.isDeleted || !el.frameId) {
      continue;
    }
    if (!framesById.has(el.frameId)) {
      frameIdOrphans++;
    }
  }

  const primaryClusters = [...framesById.values()].filter(
    (f) =>
      (f.customData as { terraformTopologyRole?: string } | undefined)
        ?.terraformTopologyRole === "primaryCluster",
  );
  let satelliteOutsideCluster = 0;
  for (const cluster of primaryClusters) {
    const clusterKey = (
      cluster.customData as { terraformTopologyKey?: string } | undefined
    )?.terraformTopologyKey;
    if (!clusterKey) {
      continue;
    }
    const cb = axisBounds(cluster);
    const satellites = elements.filter((e) => {
      if (e.isDeleted || e.id === cluster.id) {
        return false;
      }
      const cd = e.customData as
        | { terraformExplodeParentKeys?: string[] }
        | undefined;
      return cd?.terraformExplodeParentKeys?.includes(clusterKey);
    });
    for (const sat of satellites) {
      if (!contains(cb, axisBounds(sat), 24)) {
        satelliteOutsideCluster++;
      }
    }
  }

  emitNestedLayoutLog(
    "F1",
    "terraformNestedLayoutDebug.ts:summary",
    "nested layout diagnostics",
    {
      runId,
      elementCount: elements.length,
      visibilityKeyCount: visibilityKeys.size,
      frameCount: framesById.size,
      stackFrameCount: stackFrames.length,
      orphanExplodeParents,
      stackQualifiedExplodeParents,
      unprefixedExplodeParents,
      orphanExplodeSamples: orphanSamples,
      frameContainmentViolations,
      frameViolationSamples,
      stackFrameOutsideVpc,
      stackSamples,
      edgeMissingRect,
      edgeMissingSamples,
      frameIdOrphans,
      primaryClusterCount: primaryClusters.length,
      satelliteOutsideCluster,
    },
  );
}

/** Same analysis without HTTP — for tests. */
export function analyzeTerraformNestedLayout(
  elements: readonly ExcalidrawElement[],
) {
  const visibilityKeys = new Set<string>();
  for (const el of elements) {
    const key = getTerraformVisibilityKey(el);
    if (key) {
      visibilityKeys.add(key);
    }
  }
  let orphanExplodeParents = 0;
  for (const el of elements) {
    const cd = el.customData as
      | { terraformExplodeParentKeys?: string[] }
      | undefined;
    for (const p of cd?.terraformExplodeParentKeys ?? []) {
      if (typeof p === "string" && !visibilityKeys.has(p)) {
        orphanExplodeParents++;
      }
    }
  }
  return { orphanExplodeParents, visibilityKeyCount: visibilityKeys.size };
}
