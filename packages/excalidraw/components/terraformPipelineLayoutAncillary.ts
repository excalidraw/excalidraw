/**
 * Ancillary resource hydration for pipeline view: enumerate plan resources
 * that are not part of the .tfd dataflow graph and bundle them into
 * per-topology-scope "Unconnected" strips (see terraformPipelineLayoutShared
 * for strip geometry and placement integration).
 */

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  isPrimaryVisibleResourceType,
  isTopologyPlacementResourceType,
} from "./terraformPrimaryVisibility";
import {
  buildCompactPipelinePrimaryCluster,
  buildTopologyPrimaryClusterSkeletonForPipeline,
} from "./terraformTopologyLayout";
import {
  ancillaryStripFrameId,
  accountScopeKey,
  buildFallbackCluster,
  providerScopeKey,
  regionScopeKey,
  resourceTypeFor,
  vpcScopeKey,
  type AncillaryStrip,
  type PipelineLayoutPrep,
  type PipelinePlacement,
} from "./terraformPipelineLayoutShared";

import type { TerraformPlanNodesMap } from "./terraformPlanParsing";

function ancillaryScopeForPlacement(placement: PipelinePlacement): {
  scopeRole: AncillaryStrip["scopeRole"];
  scopeKey: string;
  placement: PipelinePlacement;
} {
  const vKey = vpcScopeKey(placement);
  if (vKey) {
    return {
      scopeRole: "vpc",
      scopeKey: vKey,
      placement: {
        ...placement,
        subnetSignature: undefined,
        subnetTier: undefined,
      },
    };
  }
  if (placement.region && placement.region !== "unknown-region") {
    return {
      scopeRole: "region",
      scopeKey: regionScopeKey(placement),
      placement: {
        ...placement,
        vpcId: null,
        subnetSignature: undefined,
        subnetTier: undefined,
      },
    };
  }
  if (placement.accountId && placement.accountId !== "unknown-account") {
    return {
      scopeRole: "account",
      scopeKey: accountScopeKey(placement),
      placement: {
        ...placement,
        region: "unknown-region",
        vpcId: null,
        subnetSignature: undefined,
        subnetTier: undefined,
      },
    };
  }
  return {
    scopeRole: "provider",
    scopeKey: providerScopeKey(placement),
    placement: {
      ...placement,
      accountId: "unknown-account",
      region: "unknown-region",
      vpcId: null,
      subnetSignature: undefined,
      subnetTier: undefined,
    },
  };
}

/**
 * Plan addresses that belong on the canvas but are absent from the TFD graph:
 * placement-worthy managed resources that are neither a TFD cluster nor a
 * satellite of a drawn primary. A satellite whose owner is itself drawn (as a
 * cluster or as another ancillary card) is excluded — it is rendered (or
 * revealed on expand) under that owner instead of as a standalone card.
 */
export function collectAncillaryAddresses(
  nodes: TerraformPlanNodesMap,
  clusterIds: ReadonlySet<string>,
  satelliteOwners: ReadonlyMap<string, string>,
): string[] {
  const candidates = new Set<string>();
  for (const address of Object.keys(nodes)) {
    if (address.startsWith("__") || clusterIds.has(address)) {
      continue;
    }
    if (!isTopologyPlacementResourceType(resourceTypeFor(nodes, address))) {
      continue;
    }
    candidates.add(address);
  }
  const out: string[] = [];
  for (const address of candidates) {
    const owner = satelliteOwners.get(address);
    if (owner && (clusterIds.has(owner) || candidates.has(owner))) {
      continue;
    }
    out.push(address);
  }
  return out.sort();
}

function stampAncillary(
  skeleton: ExcalidrawElementSkeleton[],
): ExcalidrawElementSkeleton[] {
  return skeleton.map((el) => ({
    ...el,
    customData: {
      ...(el.customData ?? {}),
      terraformPipelineAncillary: true,
    },
  }));
}

export function buildAncillaryStrips(
  nodes: TerraformPlanNodesMap,
  plan: unknown,
  prep: PipelineLayoutPrep,
  options: { compact: boolean },
): AncillaryStrip[] {
  const clusterIds = new Set(prep.clusters.map((c) => c.id));
  const addresses = collectAncillaryAddresses(
    nodes,
    clusterIds,
    prep.satelliteOwners,
  );
  const byScope = new Map<string, AncillaryStrip>();

  for (const address of addresses) {
    const placement: PipelinePlacement = prep.placementByAddress.get(
      address,
    ) ?? {
      providerFamily: "terraform",
      accountId: "unknown-account",
      region: "unknown-region",
      vpcId: null,
    };
    const scope = ancillaryScopeForPlacement(placement);
    const { scopeRole, scopeKey } = scope;
    let strip = byScope.get(scopeKey);
    if (!strip) {
      strip = {
        scopeRole,
        scopeKey,
        placement: scope.placement,
        stripFrameId: ancillaryStripFrameId(scopeKey),
        cards: [],
      };
      byScope.set(scopeKey, strip);
    }

    const clusterPlacement = {
      accountId: placement.accountId,
      region: placement.region,
      vpcId: placement.vpcId,
      subnetTier: placement.subnetTier,
      subnetSignature: placement.subnetSignature,
    };
    const buildInvalid = (b: {
      skeleton: unknown[];
      width: number;
      height: number;
    }) => b.skeleton.length === 0 || b.width <= 0 || b.height <= 0;
    let build = options.compact
      ? buildCompactPipelinePrimaryCluster(
          address,
          nodes,
          plan,
          clusterPlacement,
        )
      : buildTopologyPrimaryClusterSkeletonForPipeline(
          address,
          nodes,
          plan,
          clusterPlacement,
        );
    // A primary-visible resource (Lambda / S3 / ECS / SQS / RDS / KMS / module)
    // must never degrade to a bare fallback card: it carries the same primary
    // grouping connected primaries get. If the full builder bailed (empty/zero
    // skeleton), fall back to the compact primary cluster — a category-colored,
    // expandable card (satellites revealed on expand) — *before* the generic
    // bare fallback. Only genuinely non-primary leftovers take the bare path.
    if (
      buildInvalid(build) &&
      isPrimaryVisibleResourceType(resourceTypeFor(nodes, address))
    ) {
      build = buildCompactPipelinePrimaryCluster(
        address,
        nodes,
        plan,
        clusterPlacement,
      );
    }
    if (buildInvalid(build)) {
      build = buildFallbackCluster(address, nodes, plan, placement);
    }
    strip.cards.push({
      address,
      placement,
      build: { ...build, skeleton: stampAncillary(build.skeleton) },
    });
  }

  return [...byScope.values()].sort((a, b) =>
    a.scopeKey.localeCompare(b.scopeKey),
  );
}

export function countAncillaryCards(strips: readonly AncillaryStrip[]): number {
  return strips.reduce((total, strip) => total + strip.cards.length, 0);
}
