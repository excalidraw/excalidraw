/**
 * De-band membership annotation (RCLL de-band, Phase 1b).
 *
 * When de-band dissolves one or more container levels (so a subtree's resources share one
 * column stack, see `collapseTreeForDeBand`), the dissolved containment frames are
 * suppressed — which container a card belonged to becomes invisible. This restores it
 * WITHOUT re-introducing the overlapping boxes the merge removed (the corpus — MapSets /
 * BubbleSets — disfavours overlapping group regions): each card gets a thin colored **rail**
 * per dissolved level, stacked in its left margin (subnet innermost, then VPC, region,
 * account, provider as the de-band depth increases), and a compact **legend** maps each
 * rail color to its level. The subnet rail keeps its public/private/intra tier coloring;
 * the higher levels are colored by their topology role.
 *
 * The rails + legend are plain `rectangle`s with NO `terraformTopologyRole`, so the
 * placement gates and the final-scene collision diagnostics (which key off topology-role
 * frames) ignore them — they are annotation, not containment.
 */
import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import {
  getContextFrameColorForTopologyRole,
  type TerraformContextFrameRole,
} from "./terraformPrimaryVisibility";
import {
  deBandLevelRank,
  topologyRoleDeBandRank,
  type DeBandLevel,
} from "./terraformPipelineLayoutProfiles";
import type { PipelineCluster } from "./terraformPipelineLayoutShared";
import type { TerraformDependencyLayoutBox } from "./terraformElkLayout";

/** Width of a per-card membership rail (px), drawn left of the card's left edge. */
const RAIL_WIDTH = 14;
/** Gap between the card and its first (innermost) rail, and between adjacent rails. */
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
 * The dissolved levels, ordered **innermost → outermost** (the order rails stack out from
 * the card's left edge). `idPrefix` keeps the subnet rail/legend ids byte-identical to the
 * original subnet-only annotation (`tf-subnet-rail:…` / `tf-subnet-legend:…`).
 */
const DISSOLVE_ORDER: ReadonlyArray<{
  role: TerraformContextFrameRole;
  idPrefix: string;
  legendLabel: string;
}> = [
  { role: "subnetZone", idPrefix: "subnet", legendLabel: "Subnet" },
  { role: "vpc", idPrefix: "vpc", legendLabel: "VPC" },
  { role: "region", idPrefix: "region", legendLabel: "Region" },
  { role: "account", idPrefix: "account", legendLabel: "Account" },
  { role: "provider", idPrefix: "provider", legendLabel: "Provider" },
];

/** Whether a cluster participates in (sat inside) the given dissolved level. */
function clusterHasLevel(
  cluster: PipelineCluster,
  role: TerraformContextFrameRole,
): boolean {
  if (role === "subnetZone") {
    return cluster.placement.subnetSignature != null;
  }
  if (role === "vpc") {
    return cluster.placement.vpcId != null;
  }
  // region / account / provider always exist for a real cluster.
  return true;
}

/**
 * Append the de-band membership annotation (per-card rails + a per-level legend) for the
 * dissolved clusters. Returns the rail count + the subnet tiers present. Pure append —
 * never mutates an existing element, never adds a `terraformTopologyRole`. `deBandLevel`
 * defaults to `"subnet"` so the original 3-arg subnet-only call is byte-identical.
 */
export function appendSubnetMembershipAnnotations(
  skeleton: ExcalidrawElementSkeleton[],
  clusters: readonly PipelineCluster[],
  boxes: ReadonlyMap<string, TerraformDependencyLayoutBox>,
  deBandLevel: DeBandLevel = "subnet",
): { railCount: number; tiers: string[] } {
  const targetRank = deBandLevelRank(deBandLevel);
  // Levels actually dissolved at this depth (rank ≥ target), innermost → outermost.
  const levels = DISSOLVE_ORDER.filter(
    (l) => topologyRoleDeBandRank(l.role) >= targetRank,
  );

  // Each legend row, keyed by id so a level/tier is recorded once. Built in stacking
  // order (subnet tiers first, then VPC, region, …) so the legend reads inside-out.
  const legendRows = new Map<
    string,
    { colors: { strokeColor: string; backgroundColor: string }; label: string }
  >();

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

    levels.forEach((level, railIndex) => {
      if (!clusterHasLevel(cluster, level.role)) {
        return;
      }
      const tier = cluster.placement.subnetTier;
      const isSubnet = level.role === "subnetZone";
      const colors = isSubnet
        ? getContextFrameColorForTopologyRole("subnetZone", {
            subnetTier: tier,
          })
        : getContextFrameColorForTopologyRole(level.role);
      // Rail sits in the column/pad margin to the LEFT of the card (never over it —
      // a card frame draws over a same-position sibling). railIndex 0 hugs the card.
      const railX =
        box.x - RAIL_GAP - (railIndex + 1) * RAIL_WIDTH - railIndex * RAIL_GAP;
      skeleton.push({
        type: "rectangle",
        id: `tf-${level.idPrefix}-rail:${cluster.id}`,
        x: railX,
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
          terraformMembershipChip: true,
          terraformMembershipRole: level.role,
          // Back-compat marker (the subnet probe's contract): kept on the subnet rail so
          // the gate-invisibility tests / consumers that key off it still see it.
          ...(isSubnet
            ? {
                terraformSubnetChip: true,
                terraformSubnetTier: tierKey(tier),
                terraformSubnetSignature: cluster.placement.subnetSignature,
              }
            : {}),
        },
      });
      railCount += 1;

      // Record the legend row for this level (once).
      if (isSubnet) {
        tiersPresent.add(tierKey(tier));
        const legendId = `tf-subnet-legend:${tierKey(tier) === "default" ? "default" : tier}`;
        legendRows.set(legendId, {
          colors: getContextFrameColorForTopologyRole("subnetZone", {
            subnetTier: tier,
          }),
          label: tierLabel(tier),
        });
      } else {
        legendRows.set(`tf-${level.idPrefix}-legend:${level.idPrefix}`, {
          colors,
          label: `${level.legendLabel} zone`,
        });
      }
    });
  }

  // Legend: one labeled swatch row per level/tier present, stacked above the scene's
  // top-left. Subnet tiers are sorted (byte-identical to the original) ahead of the
  // higher levels, which keep their innermost → outermost order.
  const subnetIds = [...legendRows.keys()]
    .filter((id) => id.startsWith("tf-subnet-legend:"))
    .sort();
  const higherIds = [...legendRows.keys()].filter(
    (id) => !id.startsWith("tf-subnet-legend:"),
  );
  const orderedLegendIds = [...subnetIds, ...higherIds];

  if (
    orderedLegendIds.length > 0 &&
    Number.isFinite(sceneMinX) &&
    Number.isFinite(sceneMinY)
  ) {
    const legendHeight =
      orderedLegendIds.length * LEGEND_ROW_H +
      (orderedLegendIds.length - 1) * LEGEND_ROW_GAP;
    const legendTop = sceneMinY - LEGEND_ABOVE_GAP - legendHeight;
    orderedLegendIds.forEach((legendId, i) => {
      const row = legendRows.get(legendId)!;
      skeleton.push({
        type: "rectangle",
        id: legendId,
        x: sceneMinX,
        y: legendTop + i * (LEGEND_ROW_H + LEGEND_ROW_GAP),
        width: LEGEND_ROW_W,
        height: LEGEND_ROW_H,
        strokeWidth: 1,
        strokeColor: row.colors.strokeColor,
        backgroundColor: row.colors.backgroundColor,
        roundness: { type: 3, value: 6 },
        label: {
          text: `▍ ${row.label}`,
          fontSize: 16,
          strokeColor: row.colors.strokeColor,
        },
        customData: {
          terraform: true,
          terraformMembershipChip: true,
          terraformMembershipLegend: true,
          // Back-compat marker on the subnet legend rows.
          ...(legendId.startsWith("tf-subnet-legend:")
            ? {
                terraformSubnetChip: true,
                terraformSubnetLegend: true,
                terraformSubnetTier: legendId.slice("tf-subnet-legend:".length),
              }
            : {}),
        },
      });
    });
  }

  return { railCount, tiers: [...tiersPresent].sort() };
}
