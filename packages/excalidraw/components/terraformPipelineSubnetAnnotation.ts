/**
 * Subnet membership annotation (RCLL subnet de-band, Phase 1b).
 *
 * When subnet de-band collapses subnet lanes (so a VPC's resources share one column
 * stack, see `collapseSubnetsForDeBand`), the subnet containment frame is suppressed —
 * which subnet a card belongs to becomes invisible. This restores it WITHOUT
 * re-introducing the overlapping boxes the merge removed (the corpus — MapSets /
 * BubbleSets — disfavours overlapping group regions): each card gets a thin colored
 * **rail** on its left edge keyed by subnet TIER (public / private / intra), and a
 * compact **legend** maps each rail color to its tier.
 *
 * The rails + legend are plain `rectangle`s with NO `terraformTopologyRole`, so the
 * placement gates and the final-scene collision diagnostics (which key off topology-role
 * frames) ignore them — they are annotation, not containment.
 */
import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { getContextFrameColorForTopologyRole } from "./terraformPrimaryVisibility";
import type { PipelineCluster } from "./terraformPipelineLayoutShared";
import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";

/** Width of the per-card subnet-tier rail (px), drawn inside the card's left edge. */
const RAIL_WIDTH = 14;
/** Gap between the rail and the card's left edge (rail sits in the column/pad margin,
 * NOT over the card — a card frame draws over a same-position sibling). */
const RAIL_GAP = 4;
/** A legend row's size + the gap above the scene where the legend sits. */
const LEGEND_ROW_W = 240;
const LEGEND_ROW_H = 30;
const LEGEND_ROW_GAP = 8;
const LEGEND_ABOVE_GAP = 64;

/** Subnet tier → the human label shown in the legend. */
function tierLabel(tier: string | null | undefined): string {
  switch (tier) {
    case "public":
      return "Public subnet";
    case "private":
      return "Private subnet";
    case "intra":
      return "Intra subnet";
    default:
      return "Subnet";
  }
}

/** Normalize a cluster's subnet tier to a stable legend/rail key. */
function tierKey(tier: string | null | undefined): string {
  return tier === "public" || tier === "private" || tier === "intra"
    ? tier
    : "default";
}

/**
 * Append the subnet-membership annotation (per-card rails + a tier legend) for the
 * de-banded clusters. Returns the number of rails emitted (the coverage count: every
 * cluster that carries a subnet gets exactly one rail). Pure append — never mutates an
 * existing element, never adds a `terraformTopologyRole`.
 */
export function appendSubnetMembershipAnnotations(
  skeleton: ExcalidrawElementSkeleton[],
  clusters: readonly PipelineCluster[],
  boxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
): { railCount: number; tiers: string[] } {
  const railColor = (tier: string | null | undefined) =>
    getContextFrameColorForTopologyRole("subnetZone", { subnetTier: tier });

  const tiersPresent = new Set<string>();
  let railCount = 0;
  let sceneMinX = Number.POSITIVE_INFINITY;
  let sceneMinY = Number.POSITIVE_INFINITY;

  // Deterministic order: clusters arrive in a stable model order; iterate as given.
  for (const cluster of clusters) {
    const box = boxes.get(cluster.id);
    if (!box) {
      continue;
    }
    sceneMinX = Math.min(sceneMinX, box.x);
    sceneMinY = Math.min(sceneMinY, box.y);
    const tier = cluster.placement.subnetTier;
    // Only de-banded clusters (those that actually sat in a subnet) get a rail.
    if (cluster.placement.subnetSignature == null) {
      continue;
    }
    const colors = railColor(tier);
    tiersPresent.add(tierKey(tier));
    skeleton.push({
      type: "rectangle",
      id: `tf-subnet-rail:${cluster.id}`,
      x: box.x - RAIL_WIDTH - RAIL_GAP,
      y: box.y,
      width: RAIL_WIDTH,
      height: box.height,
      strokeWidth: 1,
      strokeColor: colors.strokeColor,
      backgroundColor: colors.strokeColor,
      fillStyle: "solid",
      roundness: null,
      customData: {
        terraform: true,
        terraformSubnetChip: true,
        terraformSubnetTier: tierKey(tier),
        terraformSubnetSignature: cluster.placement.subnetSignature,
      },
    });
    railCount += 1;
  }

  // Legend: one labeled swatch row per tier present, stacked above the scene's top-left.
  const tiers = [...tiersPresent].sort();
  if (tiers.length > 0 && Number.isFinite(sceneMinX) && Number.isFinite(sceneMinY)) {
    const legendHeight =
      tiers.length * LEGEND_ROW_H + (tiers.length - 1) * LEGEND_ROW_GAP;
    const legendTop = sceneMinY - LEGEND_ABOVE_GAP - legendHeight;
    tiers.forEach((tier, i) => {
      const colors = railColor(tier === "default" ? null : tier);
      skeleton.push({
        type: "rectangle",
        id: `tf-subnet-legend:${tier}`,
        x: sceneMinX,
        y: legendTop + i * (LEGEND_ROW_H + LEGEND_ROW_GAP),
        width: LEGEND_ROW_W,
        height: LEGEND_ROW_H,
        strokeWidth: 1,
        strokeColor: colors.strokeColor,
        backgroundColor: colors.backgroundColor,
        roundness: { type: 3, value: 6 },
        label: {
          text: `▍ ${tierLabel(tier === "default" ? null : tier)}`,
          fontSize: 16,
          strokeColor: colors.strokeColor,
        },
        customData: {
          terraform: true,
          terraformSubnetChip: true,
          terraformSubnetLegend: true,
          terraformSubnetTier: tier,
        },
      });
    });
  }

  return { railCount, tiers };
}
