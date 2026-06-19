import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { spreadContextFrameColors } from "./terraformPrimaryVisibility";

import {
  boundsOf,
  laneKey,
  pipelineFrameCustomData,
  PIPELINE_FRAME_PAD,
  type PipelineCluster,
} from "./terraformPipelineLayoutShared";

import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";

export type TopologyFrameRole =
  | "subnetZone"
  | "vpc"
  | "region"
  | "account"
  | "provider";

export const PIPELINE_TOPOLOGY_LEVELS: Array<{
  role: TopologyFrameRole;
  keyOf: (c: PipelineCluster) => string | null;
}> = [
  {
    role: "subnetZone",
    keyOf: (c) =>
      c.placement.vpcId && c.placement.subnetSignature != null
        ? laneKey(c.placement)
        : null,
  },
  {
    role: "vpc",
    keyOf: (c) =>
      c.placement.vpcId
        ? [
            c.placement.providerFamily,
            c.placement.accountId,
            c.placement.region,
            c.placement.vpcId,
          ].join("\0")
        : null,
  },
  {
    role: "region",
    keyOf: (c) =>
      [
        c.placement.providerFamily,
        c.placement.accountId,
        c.placement.region,
      ].join("\0"),
  },
  {
    role: "account",
    keyOf: (c) =>
      [c.placement.providerFamily, c.placement.accountId].join("\0"),
  },
  {
    role: "provider",
    keyOf: (c) => c.placement.providerFamily,
  },
];

function childKeyForLevel(
  role: TopologyFrameRole,
  cluster: PipelineCluster,
): string {
  if (role === "subnetZone") {
    return cluster.id;
  }
  if (role === "vpc") {
    return laneKey(cluster.placement);
  }
  if (role === "region") {
    return cluster.placement.vpcId
      ? [
          cluster.placement.providerFamily,
          cluster.placement.accountId,
          cluster.placement.region,
          cluster.placement.vpcId,
        ].join("\0")
      : cluster.id;
  }
  if (role === "account") {
    return [
      cluster.placement.providerFamily,
      cluster.placement.accountId,
      cluster.placement.region,
    ].join("\0");
  }
  return [cluster.placement.providerFamily, cluster.placement.accountId].join(
    "\0",
  );
}

function frameNameForLevel(
  role: TopologyFrameRole,
  placement: PipelineCluster["placement"],
): string {
  if (role === "provider") {
    return placement.providerFamily;
  }
  if (role === "account") {
    return `Account ${placement.accountId}`;
  }
  if (role === "region") {
    return `Region ${placement.region}`;
  }
  if (role === "vpc") {
    return `VPC ${placement.vpcId}`;
  }
  return placement.subnetTier
    ? `${placement.subnetTier} subnet zone`
    : "subnet zone";
}

/**
 * Bottom-up hull frames from laid-out primary cluster boxes.
 * Shared by classic (post-hoc envelopes) and compound (co-layout) paths.
 */
export function emitTopologyContextFrames(
  skeleton: ExcalidrawElementSkeleton[],
  clusters: readonly PipelineCluster[],
  boxes: Map<string, TerraformDependencyLayoutBox>,
  subnetDeBand = false,
): void {
  const childIdsByKey = new Map<string, string[]>();
  for (const cluster of clusters) {
    childIdsByKey.set(cluster.id, [cluster.build.clusterFrameId]);
  }

  for (const level of PIPELINE_TOPOLOGY_LEVELS) {
    // Subnet de-band: suppress the subnetZone frame. The subnet level no longer
    // registers a `childIdsByKey` entry, so the VPC level's lookup falls back to each
    // cluster's own frame id (the `?? cluster.build.clusterFrameId` below) → the VPC
    // frame parents the cluster frames DIRECTLY. Subnet membership becomes a Phase-1b
    // annotation, not a containment frame.
    if (subnetDeBand && level.role === "subnetZone") {
      continue;
    }
    const groups = new Map<string, PipelineCluster[]>();
    for (const cluster of clusters) {
      const key = level.keyOf(cluster);
      if (!key) {
        continue;
      }
      groups.set(key, [...(groups.get(key) ?? []), cluster]);
    }
    for (const [key, group] of groups) {
      const childIds = group.map((cluster) => {
        const lower = childKeyForLevel(level.role, cluster);
        return childIdsByKey.get(lower)?.[0] ?? cluster.build.clusterFrameId;
      });
      const uniqueChildIds = [...new Set(childIds)];
      const b = boundsOf(uniqueChildIds, boxes);
      if (!b) {
        continue;
      }
      const placement = group[0]!.placement;
      const id = `tf-pipeline:${level.role}:${encodeURIComponent(key)}`;
      const pad = PIPELINE_FRAME_PAD;
      skeleton.push({
        type: "frame",
        id,
        name: frameNameForLevel(level.role, placement),
        x: b.x - pad,
        y: b.y - pad,
        width: b.width + 2 * pad,
        height: b.height + 2 * pad,
        children: uniqueChildIds,
        ...spreadContextFrameColors(level.role, {
          subnetTier:
            level.role === "subnetZone" ? placement.subnetTier : undefined,
        }),
        customData: pipelineFrameCustomData(level.role, placement, id, {
          terraformSubnetSignature: placement.subnetSignature,
          terraformSubnetTier: placement.subnetTier,
        }),
      });
      boxes.set(id, {
        x: b.x - pad,
        y: b.y - pad,
        width: b.width + 2 * pad,
        height: b.height + 2 * pad,
      });
      childIdsByKey.set(key, [id]);
    }
  }
}

/** Compound co-layout alias: frames derived from global TFD grid placement. */
export const buildCompoundFramesFromLayoutBoxes = emitTopologyContextFrames;

export function topologyFrameSkeletonId(
  role: TopologyFrameRole,
  key: string,
): string {
  return `tf-pipeline:${role}:${encodeURIComponent(key)}`;
}

export function topologyPathForCluster(
  cluster: PipelineCluster,
  subnetDeBand = false,
): string[] {
  const p = cluster.placement;
  if (!subnetDeBand && p.vpcId && p.subnetSignature != null) {
    return [
      p.providerFamily,
      p.accountId,
      p.region,
      p.vpcId,
      p.subnetSignature,
    ];
  }
  if (p.vpcId) {
    return [p.providerFamily, p.accountId, p.region, p.vpcId];
  }
  return [p.providerFamily, p.accountId, p.region];
}

export function topologyRoleAndKeyFromPath(
  path: readonly string[],
): { role: TopologyFrameRole; key: string } | null {
  if (path.length === 1) {
    return { role: "provider", key: path[0]! };
  }
  if (path.length === 2) {
    return { role: "account", key: path.join("\0") };
  }
  if (path.length === 3) {
    return { role: "region", key: path.join("\0") };
  }
  if (path.length === 4) {
    return { role: "vpc", key: path.join("\0") };
  }
  if (path.length >= 5) {
    return {
      role: "subnetZone",
      key: [path[0]!, path[1]!, path[2]!, path[3]!, path[4]!].join("\0"),
    };
  }
  return null;
}

export function lcaTopologyPath(
  pathA: readonly string[],
  pathB: readonly string[],
): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
    if (pathA[i] !== pathB[i]) {
      break;
    }
    out.push(pathA[i]!);
  }
  return out;
}
