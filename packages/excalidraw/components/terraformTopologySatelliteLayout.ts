/**
 * Scoped layout keys and nested satellite cluster frames for SG / IAM under compute primaries.
 */

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import type { TopologyIamEdge } from "./terraformTopologyIamLinks";
import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

/** Inner padding around SG / IAM sub-frames inside a primaryCluster. */
export const TOPOLOGY_SATELLITE_CLUSTER_FRAME_PAD_PX = 8;

export type SatelliteClusterBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export function growSatelliteClusterBounds(
  prev: SatelliteClusterBounds | null,
  x: number,
  y: number,
  w: number,
  h: number,
): SatelliteClusterBounds {
  const maxX = x + w;
  const maxY = y + h;
  if (!prev) {
    return { minX: x, minY: y, maxX, maxY };
  }
  return {
    minX: Math.min(prev.minX, x),
    minY: Math.min(prev.minY, y),
    maxX: Math.max(prev.maxX, maxX),
    maxY: Math.max(prev.maxY, maxY),
  };
}

/** Unique skeleton id per (parent primary × canonical Terraform node path). */
export function terraformSatelliteLayoutElementId(
  parentPrimary: string,
  nodePath: string,
): string {
  return `tf-topo:sat:${encodeURIComponent(parentPrimary)}:${encodeURIComponent(nodePath)}`;
}

export function terraformSatelliteSgRuleLayoutElementId(
  parentPrimary: string,
  rulePath: string,
): string {
  return `tf-topo:sat-sgr:${encodeURIComponent(parentPrimary)}:${encodeURIComponent(rulePath)}`;
}

export function satelliteClusterSkeletonId(
  parentPrimary: string,
  rootNodePath: string,
): string {
  return `tf-topo:sat-cluster:${encodeURIComponent(parentPrimary)}:${encodeURIComponent(rootNodePath)}`;
}

function getResourceTypeFromPath(
  nodePath: string,
  node?: TerraformPlanGraphNode,
): string {
  const first = Object.values(node?.resources || {})[0];
  const t = first && typeof first === "object" ? (first as { type?: string }).type : undefined;
  if (typeof t === "string") {
    return t;
  }
  const parts = nodePath.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (i < parts.length && parts[i] === "data") {
    return typeof parts[i + 1] === "string" ? String(parts[i + 1]) : "";
  }
  return typeof parts[i] === "string" ? String(parts[i]) : "";
}

/** Split flat IAM stack into per-role groups: `[role, ...policies]`. */
export function groupIamStackIntoRoleStacks(
  nodes: TerraformPlanNodesMap,
  stack: readonly string[],
): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const path of stack) {
    const t = getResourceTypeFromPath(
      path,
      nodes[path] as TerraformPlanGraphNode | undefined,
    );
    if (t === "aws_iam_role") {
      if (current.length > 0) {
        groups.push(current);
      }
      current = [path];
    } else if (current.length > 0) {
      current.push(path);
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }
  return groups;
}

function layoutIdForNode(
  parentPrimary: string,
  nodePath: string,
  nodes: TerraformPlanNodesMap,
): string {
  const t = getResourceTypeFromPath(
    nodePath,
    nodes[nodePath] as TerraformPlanGraphNode | undefined,
  );
  if (
    t === "aws_security_group_rule" ||
    t === "aws_vpc_security_group_ingress_rule" ||
    t === "aws_vpc_security_group_egress_rule"
  ) {
    return terraformSatelliteSgRuleLayoutElementId(parentPrimary, nodePath);
  }
  return terraformSatelliteLayoutElementId(parentPrimary, nodePath);
}

/** Remap edge endpoints to scoped layout ids for one parent primary. */
export function remapScopedSatelliteEdges(
  edges: readonly TopologyIamEdge[],
  parentPrimary: string,
  nodes: TerraformPlanNodesMap,
): TopologyIamEdge[] {
  const remap = (path: string): string => {
    if (path === parentPrimary) {
      return path;
    }
    return layoutIdForNode(parentPrimary, path, nodes);
  };
  return edges.map((e) => ({
    ...e,
    source: remap(e.source),
    target: remap(e.target),
  }));
}

export type PushSatelliteClusterFrameParams = {
  skeleton: ExcalidrawElementSkeleton[];
  frameId: string;
  bounds: SatelliteClusterBounds;
  childIds: readonly string[];
  name: string;
  parentPrimary: string;
  rootNodePath: string;
  accountId: string;
  region: string;
  vpcId: string | null;
  addClusterMember: (
    id: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
  ) => void;
};

/** Emit nested `satelliteCluster` frame wrapping SG or IAM role satellites. */
export function pushSatelliteClusterFrame(
  params: PushSatelliteClusterFrameParams,
): void {
  const pad = TOPOLOGY_SATELLITE_CLUSTER_FRAME_PAD_PX;
  const { bounds, frameId, childIds, name, parentPrimary, rootNodePath } =
    params;
  const x = bounds.minX - pad;
  const y = bounds.minY - pad;
  const w = bounds.maxX - bounds.minX + 2 * pad;
  const h = bounds.maxY - bounds.minY + 2 * pad;

  params.addClusterMember(frameId, x, y, w, h);
  params.skeleton.push({
    type: "frame",
    id: frameId,
    name: name.slice(0, 48),
    x,
    y,
    width: w,
    height: h,
    children: childIds as readonly string[],
    customData: {
      terraform: true as const,
      terraformSemanticOverview: true as const,
      terraformTopologyRole: "satelliteCluster" as const,
      terraformTopologyKey: frameId,
      terraformTopologyPath: [
        params.accountId,
        params.region,
        params.vpcId ?? "",
        parentPrimary,
        rootNodePath,
      ].filter(Boolean),
      terraformPrimaryAddress: parentPrimary,
      terraformSatelliteRoot: rootNodePath,
    },
  });
}

/** Extra vertical space for nested satelliteCluster frames under one primary. */
export function nestedSgGroupsExtraHeightPx(
  groupCount: number,
  innerPad: number = TOPOLOGY_SATELLITE_CLUSTER_FRAME_PAD_PX,
): number {
  if (groupCount <= 0) {
    return 0;
  }
  return groupCount * (2 * innerPad);
}

export function nestedIamRoleStacksExtraHeightPx(
  roleStackCount: number,
  innerPad: number = TOPOLOGY_SATELLITE_CLUSTER_FRAME_PAD_PX,
): number {
  if (roleStackCount <= 0) {
    return 0;
  }
  return roleStackCount * (2 * innerPad);
}
