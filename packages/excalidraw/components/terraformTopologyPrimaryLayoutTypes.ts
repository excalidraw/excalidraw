/**
 * Schema for per–primary-type semantic topology satellite slots (JSON under assets/).
 */

export const TOPOLOGY_SATELLITE_KINDS = [
  "iam",
  "kms_policies",
  "s3_companions",
  "alb_companions",
  "ecs_companions",
  "api_gateway_companions",
  "tgw_companions",
  "lambda_permission",
  "sqs_companions",
  "security_groups",
  "cloudwatch_alarms",
  "cloudwatch_log_groups",
] as const;

export type TopologySatelliteKind = typeof TOPOLOGY_SATELLITE_KINDS[number];

export type TopologySlotAnchor = "top" | "bottom" | "left" | "right";
export type TopologySlotAlign = "start" | "center" | "end";
export type TopologySlotLayout = "stack" | "parallel";
export type TopologySlotGroupLayout =
  | "sg_groups_with_rules"
  | "api_stages"
  | "tgw_peering";

export type TopologyTierBasePx = { w: number; h: number };

export type TopologyPrimaryLayoutSlotJson = {
  id: string;
  anchor: TopologySlotAnchor;
  align: TopologySlotAlign;
  kinds: TopologySatelliteKind[];
  layout: TopologySlotLayout;
  groupLayout?: TopologySlotGroupLayout;
  /** Skip log groups already drawn under ECS companion stack. */
  excludeRef?: "ecs_owned_log_groups";
};

export type TopologyPrimaryLayoutJson = {
  primaryType: string;
  /** Satellite kinds whose attachment rules run for this primary type. */
  attachments: TopologySatelliteKind[];
  tierBase: {
    tier0: TopologyTierBasePx;
    tier1: TopologyTierBasePx;
    tier2: TopologyTierBasePx;
  };
  padding: {
    sgRight: number;
    cloudwatchLeft: number;
    cloudwatchRight: number;
    primaryClusterFrame: number;
  };
  gaps: {
    satellite: number;
    iamSgColumn: number;
    cloudwatchColumn: number;
    sgBetweenGroups: number;
  };
  slots: TopologyPrimaryLayoutSlotJson[];
};

export type ResolvedTopologyTiers = {
  tier0W: number;
  tier0H: number;
  tier1W: number;
  tier1H: number;
  tier2W: number;
  tier2H: number;
};

export type ResolvedPrimaryLayoutConfig = {
  primaryType: string;
  attachments: TopologySatelliteKind[];
  enabledKinds: ReadonlySet<TopologySatelliteKind>;
  tiers: ResolvedTopologyTiers;
  padding: {
    sgRight: number;
    cloudwatchLeft: number;
    cloudwatchRight: number;
    primaryClusterFrame: number;
  };
  gaps: {
    satellite: number;
    iamSgColumn: number;
    cloudwatchColumn: number;
    sgBetweenGroups: number;
  };
  slots: TopologyPrimaryLayoutSlotJson[];
};

const KIND_SET = new Set<string>(TOPOLOGY_SATELLITE_KINDS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function isTierBase(v: unknown): v is TopologyTierBasePx {
  return (
    isRecord(v) &&
    typeof v.w === "number" &&
    typeof v.h === "number" &&
    v.w > 0 &&
    v.h > 0
  );
}

function isSlot(v: unknown): v is TopologyPrimaryLayoutSlotJson {
  if (!isRecord(v)) {
    return false;
  }
  if (typeof v.id !== "string" || !v.id) {
    return false;
  }
  if (
    v.anchor !== "top" &&
    v.anchor !== "bottom" &&
    v.anchor !== "left" &&
    v.anchor !== "right"
  ) {
    return false;
  }
  if (v.align !== "start" && v.align !== "center" && v.align !== "end") {
    return false;
  }
  if (v.layout !== "stack" && v.layout !== "parallel") {
    return false;
  }
  if (!Array.isArray(v.kinds) || v.kinds.length === 0) {
    return false;
  }
  for (const k of v.kinds) {
    if (typeof k !== "string" || !KIND_SET.has(k)) {
      return false;
    }
  }
  return true;
}

export function validateTopologyPrimaryLayoutJson(
  raw: unknown,
): TopologyPrimaryLayoutJson {
  if (!isRecord(raw)) {
    throw new Error("topology primary layout: expected object");
  }
  if (typeof raw.primaryType !== "string" || !raw.primaryType) {
    throw new Error("topology primary layout: missing primaryType");
  }
  const tierBase = raw.tierBase;
  if (
    !isRecord(tierBase) ||
    !isTierBase(tierBase.tier0) ||
    !isTierBase(tierBase.tier1) ||
    !isTierBase(tierBase.tier2)
  ) {
    throw new Error("topology primary layout: invalid tierBase");
  }
  const padding = raw.padding;
  if (
    !isRecord(padding) ||
    typeof padding.sgRight !== "number" ||
    typeof padding.cloudwatchLeft !== "number" ||
    typeof padding.cloudwatchRight !== "number" ||
    typeof padding.primaryClusterFrame !== "number"
  ) {
    throw new Error("topology primary layout: invalid padding");
  }
  const gaps = raw.gaps;
  if (
    !isRecord(gaps) ||
    typeof gaps.satellite !== "number" ||
    typeof gaps.iamSgColumn !== "number" ||
    typeof gaps.cloudwatchColumn !== "number" ||
    typeof gaps.sgBetweenGroups !== "number"
  ) {
    throw new Error("topology primary layout: invalid gaps");
  }
  if (!Array.isArray(raw.attachments) || raw.attachments.length === 0) {
    throw new Error("topology primary layout: attachments required");
  }
  const attachmentSet = new Set<TopologySatelliteKind>();
  for (const k of raw.attachments) {
    if (typeof k !== "string" || !KIND_SET.has(k)) {
      throw new Error(
        `topology primary layout: invalid attachment kind ${String(k)}`,
      );
    }
    attachmentSet.add(k as TopologySatelliteKind);
  }
  if (!Array.isArray(raw.slots) || raw.slots.length === 0) {
    throw new Error("topology primary layout: slots required");
  }
  for (const slot of raw.slots) {
    if (!isSlot(slot)) {
      throw new Error(`topology primary layout: invalid slot ${String(slot)}`);
    }
    for (const k of slot.kinds) {
      if (!attachmentSet.has(k)) {
        throw new Error(
          `topology primary layout: slot ${slot.id} kind ${k} not in attachments`,
        );
      }
    }
  }
  return raw as TopologyPrimaryLayoutJson;
}

export function allKindsInLayouts(
  layouts: readonly TopologyPrimaryLayoutJson[],
): TopologySatelliteKind[] {
  const seen = new Set<TopologySatelliteKind>();
  for (const layout of layouts) {
    for (const slot of layout.slots) {
      for (const k of slot.kinds) {
        seen.add(k);
      }
    }
  }
  return [...seen];
}
