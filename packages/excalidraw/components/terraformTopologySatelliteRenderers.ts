/**
 * Config-driven placement of semantic topology primary satellites.
 */

import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

import { albCompanionDrawMetrics } from "./terraformTopologyAlbLinks";
import { cloudWatchSatelliteStackHeightPx } from "./terraformTopologyCloudWatchLinks";

import {
  kindsForColumn,
  primaryBottomHasEndContent,
  primaryBottomHasStartContent,
  buildSatelliteKindHeightContext,
} from "./terraformTopologyPrimaryLayoutConfig";

import { shortTerraformResourceLabel } from "./terraformElkLayout";
import { getTerraformCardResourceType } from "./terraformResourceCardLabel";
import {
  growSatelliteClusterBounds,
  groupIamStackIntoRoleStacks,
  pushSatelliteClusterFrame,
  remapScopedSatelliteEdges,
  satelliteClusterSkeletonId,
  terraformSatelliteLayoutElementId,
  terraformSatelliteSgRuleLayoutElementId,
  type SatelliteClusterBounds,
} from "./terraformTopologySatelliteLayout";

import type { TopologyIamEdge } from "./terraformTopologyIamLinks";
import type { ResolvedPrimaryLayoutConfig } from "./terraformTopologyPrimaryLayoutTypes";
import type { TopologyPrimarySatelliteBundles } from "./terraformTopologyPrimarySatelliteBundles";
import type { TopologySatelliteKind } from "./terraformTopologyPrimaryLayoutTypes";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export type TopologySatelliteLineSpec = {
  edge: TopologyIamEdge;
  origin: string;
  strokeColor: string;
};

export type PushResourceRectangleFn = (
  skeleton: ExcalidrawElementSkeleton[],
  addr: string,
  x: number,
  y: number,
  width: number,
  height: number,
  nodes: TerraformPlanNodesMap,
  options: {
    explodeParentKeys: string[];
    satelliteTier?: 1 | 2;
    elementId?: string;
    terraformSemanticLayoutDuplicate?: boolean;
  },
) => void;

export type TopologyGlobalPlacedSatellites = {
  iam: Set<string>;
  kmsPolicy: Set<string>;
  sg: Set<string>;
  cloudWatch: Set<string>;
  s3: Set<string>;
  sqs: Set<string>;
  alb: Set<string>;
  ecs: Set<string>;
  apiGateway: Set<string>;
  tgw: Set<string>;
  lambdaPermission: Set<string>;
  datastore: Set<string>;
};

export type RenderPrimarySatellitesParams = {
  skeleton: ExcalidrawElementSkeleton[];
  nodes: TerraformPlanNodesMap;
  arnIndex: Map<string, string>;
  plan?: unknown;
  primaryAddr: string;
  /** Cell origin (left column anchor for side satellites). */
  rx: number;
  /** Tier-0 primary tile X (may be offset right of `rx` when left satellites exist). */
  primaryX: number;
  ry: number;
  config: ResolvedPrimaryLayoutConfig;
  bundles: TopologyPrimarySatelliteBundles;
  globalPlaced: TopologyGlobalPlacedSatellites;
  satelliteLineSpecs: TopologySatelliteLineSpec[];
  dataflowStroke: string;
  pushRect: PushResourceRectangleFn;
  addClusterMember: (
    id: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
  ) => void;
  placement: TopologyPrimaryClusterPlacement;
};

export type TopologyPrimaryClusterPlacement = {
  accountId: string;
  region: string;
  vpcId: string | null;
};

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function companionStackTileMetrics(
  nodes: TerraformPlanNodesMap,
  satAddr: string,
  tier1W: number,
  tier1H: number,
  tier2W: number,
  tier2H: number,
): { tileH: number; tileW: number; tileXOffset: number; tier: 1 | 2 } {
  const n = nodes[satAddr] as TerraformPlanGraphNode | undefined;
  const pr = getPrimaryResource(n);
  const t = typeof pr?.type === "string" ? pr.type : "";
  if (t === "aws_iam_policy_document" || t === "aws_lambda_permission") {
    return {
      tileH: tier2H,
      tileW: tier2W,
      tileXOffset: Math.floor((tier1W - tier2W) / 2),
      tier: 2,
    };
  }
  return {
    tileH: tier1H,
    tileW: tier1W,
    tileXOffset: 0,
    tier: 1,
  };
}

function pushEdges(
  specs: TopologySatelliteLineSpec[],
  edges: TopologyIamEdge[],
  origin: string,
  strokeColor: string,
): void {
  for (const e of edges) {
    specs.push({ edge: e, origin, strokeColor });
  }
}

function kindHasCluster(
  kind: TopologySatelliteKind,
  bundles: TopologyPrimarySatelliteBundles,
): boolean {
  switch (kind) {
    case "iam":
      return Boolean(bundles.iam.cluster);
    case "kms_policies":
      return Boolean(bundles.kms.cluster);
    case "security_groups":
      return Boolean(bundles.sg.cluster);
    case "s3_companions":
      return Boolean(bundles.s3.cluster);
    case "alb_companions":
      return Boolean(bundles.alb.cluster);
    case "ecs_companions":
      return Boolean(bundles.ecs.cluster);
    case "ecs_cluster_companions":
      return Boolean(bundles.ecsCluster.cluster?.clusterPath);
    case "ecs_ec2_capacity_companions":
      return Boolean(bundles.ecsEc2.cluster?.chains.length);
    case "api_gateway_companions":
      return Boolean(
        bundles.api.cluster &&
          (bundles.api.cluster.stages.length > 0 ||
            bundles.api.cluster.methodSettings.length > 0),
      );
    case "api_gateway_vpc_links":
      return Boolean(bundles.apiVpc.cluster?.vpcLinks.length);
    case "tgw_companions":
      return Boolean(bundles.tgw.cluster);
    case "lambda_permission":
      return Boolean(bundles.lambdaPermission.cluster);
    case "sqs_companions":
      return Boolean(bundles.sqs.cluster);
    case "aurora_companions":
      return Boolean(bundles.aurora.cluster);
    case "rds_companions":
      return Boolean(bundles.rds.cluster);
    case "cloudwatch_alarms":
    case "cloudwatch_log_groups":
      return Boolean(bundles.cloudWatch.cluster);
    default:
      return false;
  }
}

export function renderPrimarySatellitesFromConfig(
  params: RenderPrimarySatellitesParams,
): void {
  const {
    skeleton,
    nodes,
    arnIndex,
    plan,
    primaryAddr: addr,
    rx,
    primaryX = rx,
    ry,
    config,
    bundles,
    globalPlaced,
    satelliteLineSpecs,
    dataflowStroke,
    pushRect,
    addClusterMember,
    placement,
  } = params;

  const { tiers, gaps, padding } = config;
  const tier0W = tiers.tier0W;
  const tier0H = tiers.tier0H;
  const tier1W = tiers.tier1W;
  const tier1H = tiers.tier1H;
  const tier2W = tiers.tier2W;
  const tier2H = tiers.tier2H;
  const satelliteGap = gaps.satellite;
  const iamW = tier1W;
  const sgW = tier1W;
  const alarmW = tier1W;
  const logGroupW = tier1W;

  pushEdges(
    satelliteLineSpecs,
    remapScopedSatelliteEdges(bundles.iam.edges, addr, nodes),
    "topology_iam",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.kms.edges,
    "topology_kms",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    remapScopedSatelliteEdges(bundles.sg.edges, addr, nodes),
    "topology_sg",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.s3.edges,
    "topology_s3",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.alb.edges,
    "topology_alb",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.ecs.edges,
    "topology_ecs",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.api.edges,
    "topology_api_gateway",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.apiVpc.edges,
    "topology_api_gateway_vpc_link",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.tgw.edges,
    "topology_tgw",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.lambdaPermission.edges,
    "topology_lambda_permission",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.sqs.edges,
    "topology_sqs",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.aurora.edges,
    "topology_aurora",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.rds.edges,
    "topology_rds",
    dataflowStroke,
  );
  pushEdges(
    satelliteLineSpecs,
    bundles.cloudWatch.edges,
    "topology_cloudwatch",
    dataflowStroke,
  );

  const bottomCtx = buildSatelliteKindHeightContext(
    nodes,
    addr,
    arnIndex,
    plan,
  );
  const hasLeft = primaryBottomHasStartContent(config, bottomCtx);
  const hasRight = primaryBottomHasEndContent(config, bottomCtx);

  if (bundles.cloudWatch.cluster) {
    const cloudWatchTop =
      ry -
      cloudWatchSatelliteStackHeightPx(nodes, addr, tier1H, satelliteGap) +
      satelliteGap;

    const cwHasAlarm = Boolean(bundles.cloudWatch.cluster.alarms.length);
    const cwHasLog = Boolean(bundles.cloudWatch.cluster.logGroups.length);
    const logGroupX =
      cwHasAlarm && cwHasLog
        ? primaryX + padding.cloudwatchLeft + tier1W + gaps.cloudwatchColumn
        : primaryX + tier0W - logGroupW - padding.cloudwatchRight;

    let yAlarm = cloudWatchTop;
    const alarmX = primaryX + padding.cloudwatchLeft;
    for (const alarmPath of bundles.cloudWatch.cluster.alarms) {
      if (!globalPlaced.cloudWatch.has(alarmPath)) {
        globalPlaced.cloudWatch.add(alarmPath);
        addClusterMember(alarmPath, alarmX, yAlarm, alarmW, tier1H);
        pushRect(skeleton, alarmPath, alarmX, yAlarm, alarmW, tier1H, nodes, {
          explodeParentKeys: [addr],
          satelliteTier: 1,
        });
      }
      yAlarm += tier1H + satelliteGap;
    }

    const ecsOwnedLogGroups = new Set(
      bundles.ecs.cluster?.stack.filter(
        (satAddr) =>
          getTerraformCardResourceType(
            satAddr,
            getPrimaryResource(
              nodes[satAddr] as TerraformPlanGraphNode,
            ) as Record<string, unknown> | null,
          ) === "aws_cloudwatch_log_group",
      ) ?? [],
    );
    let yLogGroup = cloudWatchTop;
    for (const logGroupPath of bundles.cloudWatch.cluster.logGroups) {
      if (ecsOwnedLogGroups.has(logGroupPath)) {
        continue;
      }
      if (!globalPlaced.cloudWatch.has(logGroupPath)) {
        globalPlaced.cloudWatch.add(logGroupPath);
        addClusterMember(logGroupPath, logGroupX, yLogGroup, logGroupW, tier1H);
        pushRect(
          skeleton,
          logGroupPath,
          logGroupX,
          yLogGroup,
          logGroupW,
          tier1H,
          nodes,
          {
            explodeParentKeys: [addr],
            satelliteTier: 1,
          },
        );
      }
      yLogGroup += tier1H + satelliteGap;
    }
  }

  const vpcCluster = bundles.apiVpc.cluster;
  if (vpcCluster?.vpcLinks.length) {
    for (const linkPath of vpcCluster.vpcLinks) {
      const satY = ry + Math.floor((tier0H - tier1H) / 2);
      if (!globalPlaced.apiGateway.has(linkPath)) {
        globalPlaced.apiGateway.add(linkPath);
        addClusterMember(linkPath, rx, satY, tier1W, tier1H);
        pushRect(skeleton, linkPath, rx, satY, tier1W, tier1H, nodes, {
          explodeParentKeys: [addr],
          satelliteTier: 1,
        });
      }
    }
  }

  const yAfterPrimary = ry + tier0H;
  let yLeft = yAfterPrimary;
  let yRight = yAfterPrimary;
  let leftStarted = false;
  let rightStarted = false;

  const bottomStartKinds = kindsForColumn(config, "bottom", "start");
  for (const kind of bottomStartKinds) {
    if (!kindHasCluster(kind, bundles)) {
      continue;
    }
    if (!leftStarted) {
      yLeft += satelliteGap;
      leftStarted = true;
    }
    yLeft = renderBottomKind({
      kind,
      columnX: primaryX,
      y: yLeft,
      addr,
      skeleton,
      nodes,
      bundles,
      globalPlaced,
      pushRect,
      addClusterMember,
      iamW,
      tier1H,
      tier2W,
      tier2H,
      satelliteGap,
      sgW,
      placement,
    });
  }

  const satXRight =
    hasLeft && hasRight
      ? primaryX + tier1W + gaps.iamSgColumn
      : primaryX + tier0W - sgW - padding.sgRight;
  const ruleTileX = satXRight + Math.floor((sgW - tier2W) / 2);

  const bottomEndKinds = kindsForColumn(config, "bottom", "end");
  for (const kind of bottomEndKinds) {
    if (!kindHasCluster(kind, bundles)) {
      continue;
    }
    if (!rightStarted) {
      yRight += satelliteGap;
      rightStarted = true;
    }
    yRight = renderBottomKind({
      kind,
      columnX: kind === "security_groups" ? satXRight : satXRight,
      y: yRight,
      addr,
      skeleton,
      nodes,
      bundles,
      globalPlaced,
      pushRect,
      addClusterMember,
      iamW,
      tier1H,
      tier2W,
      tier2H,
      satelliteGap,
      sgW,
      ruleTileX,
      sgBetweenGroupsGap: gaps.sgBetweenGroups,
      placement,
    });
  }
}

type RenderBottomKindParams = {
  kind: TopologySatelliteKind;
  columnX: number;
  y: number;
  addr: string;
  skeleton: ExcalidrawElementSkeleton[];
  nodes: TerraformPlanNodesMap;
  bundles: TopologyPrimarySatelliteBundles;
  globalPlaced: TopologyGlobalPlacedSatellites;
  pushRect: PushResourceRectangleFn;
  addClusterMember: RenderPrimarySatellitesParams["addClusterMember"];
  iamW: number;
  tier1H: number;
  tier2W: number;
  tier2H: number;
  satelliteGap: number;
  sgW: number;
  ruleTileX?: number;
  sgBetweenGroupsGap?: number;
  placement: TopologyPrimaryClusterPlacement;
};

type DrawScopedTileParams = {
  nodePath: string;
  layoutId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tier: 1 | 2;
  explodeParentKeys: string[];
  skeleton: ExcalidrawElementSkeleton[];
  nodes: TerraformPlanNodesMap;
  pushRect: PushResourceRectangleFn;
  addClusterMember: RenderBottomKindParams["addClusterMember"];
};

function drawScopedSatelliteTile(p: DrawScopedTileParams): void {
  p.addClusterMember(p.layoutId, p.x, p.y, p.w, p.h);
  p.pushRect(p.skeleton, p.nodePath, p.x, p.y, p.w, p.h, p.nodes, {
    explodeParentKeys: p.explodeParentKeys,
    satelliteTier: p.tier,
    elementId: p.layoutId,
    terraformSemanticLayoutDuplicate: true,
  });
}

function renderBottomKind(p: RenderBottomKindParams): number {
  let y = p.y;
  const {
    kind,
    columnX,
    addr,
    skeleton,
    nodes,
    bundles,
    globalPlaced,
    pushRect,
    addClusterMember,
    iamW,
    tier1H,
    tier2W,
    tier2H,
    satelliteGap,
    sgW,
  } = p;

  switch (kind) {
    case "iam": {
      const cluster = bundles.iam.cluster;
      if (!cluster) {
        return y;
      }
      const roleStacks = groupIamStackIntoRoleStacks(nodes, cluster.stack);
      const policyTileX = columnX + Math.floor((iamW - tier2W) / 2);

      for (const roleStack of roleStacks) {
        const rolePath = roleStack[0]!;
        const roleLayoutId = terraformSatelliteLayoutElementId(addr, rolePath);
        let bounds: SatelliteClusterBounds | null = null;
        const frameChildIds: string[] = [];

        for (let si = 0; si < roleStack.length; si++) {
          const satAddr = roleStack[si]!;
          const isRoleTile = si === 0;
          const tileH = isRoleTile ? tier1H : tier2H;
          const tileW = isRoleTile ? iamW : tier2W;
          const tileX = isRoleTile ? columnX : policyTileX;
          const layoutId = isRoleTile
            ? roleLayoutId
            : terraformSatelliteLayoutElementId(addr, satAddr);
          const explodeKeys = isRoleTile ? [addr] : [roleLayoutId];

          drawScopedSatelliteTile({
            nodePath: satAddr,
            layoutId,
            x: tileX,
            y,
            w: tileW,
            h: tileH,
            tier: isRoleTile ? 1 : 2,
            explodeParentKeys: explodeKeys,
            skeleton,
            nodes,
            pushRect,
            addClusterMember,
          });
          frameChildIds.push(layoutId);
          bounds = growSatelliteClusterBounds(bounds, tileX, y, tileW, tileH);
          y += tileH + satelliteGap;
        }

        if (bounds && frameChildIds.length > 0) {
          pushSatelliteClusterFrame({
            skeleton,
            frameId: satelliteClusterSkeletonId(addr, rolePath),
            bounds,
            childIds: frameChildIds,
            name: shortTerraformResourceLabel(rolePath),
            parentPrimary: addr,
            rootNodePath: rolePath,
            accountId: p.placement.accountId,
            region: p.placement.region,
            vpcId: p.placement.vpcId,
            addClusterMember,
          });
        }
      }
      return y;
    }
    case "kms_policies": {
      const cluster = bundles.kms.cluster;
      if (!cluster) {
        return y;
      }
      for (const policyPath of cluster.policies) {
        if (globalPlaced.kmsPolicy.has(policyPath)) {
          y += tier1H + satelliteGap;
          continue;
        }
        globalPlaced.kmsPolicy.add(policyPath);
        addClusterMember(policyPath, columnX, y, iamW, tier1H);
        pushRect(skeleton, policyPath, columnX, y, iamW, tier1H, nodes, {
          explodeParentKeys: [addr],
          satelliteTier: 1,
        });
        y += tier1H + satelliteGap;
      }
      return y;
    }
    case "s3_companions": {
      const cluster = bundles.s3.cluster;
      if (!cluster) {
        return y;
      }
      for (const satAddr of cluster.stack) {
        const m = companionStackTileMetrics(
          nodes,
          satAddr,
          iamW,
          tier1H,
          tier2W,
          tier2H,
        );
        if (globalPlaced.s3.has(satAddr)) {
          y += m.tileH + satelliteGap;
          continue;
        }
        globalPlaced.s3.add(satAddr);
        addClusterMember(satAddr, columnX + m.tileXOffset, y, m.tileW, m.tileH);
        pushRect(
          skeleton,
          satAddr,
          columnX + m.tileXOffset,
          y,
          m.tileW,
          m.tileH,
          nodes,
          {
            explodeParentKeys: [addr],
            satelliteTier: m.tier,
          },
        );
        y += m.tileH + satelliteGap;
      }
      return y;
    }
    case "ecs_cluster_companions": {
      const clusterBand = bundles.ecsCluster.cluster;
      if (!clusterBand?.clusterPath) {
        return y;
      }
      const ruleTileXEcsCluster = columnX + Math.floor((iamW - tier2W) / 2);
      const drawEcsSat = (
        satAddr: string,
        x: number,
        w: number,
        h: number,
        tier: 1 | 2,
        explodeKeys: string[],
      ): void => {
        if (globalPlaced.ecs.has(satAddr)) {
          return;
        }
        globalPlaced.ecs.add(satAddr);
        addClusterMember(satAddr, x, y, w, h);
        pushRect(skeleton, satAddr, x, y, w, h, nodes, {
          explodeParentKeys: explodeKeys,
          satelliteTier: tier,
        });
      };
      if (!globalPlaced.ecs.has(clusterBand.clusterPath)) {
        drawEcsSat(clusterBand.clusterPath, columnX, iamW, tier1H, 1, [addr]);
        y += tier1H + satelliteGap;
      } else {
        y += tier1H + satelliteGap;
      }
      if (clusterBand.clusterCapacityProvidersPath) {
        const cpReg = clusterBand.clusterCapacityProvidersPath;
        if (!globalPlaced.ecs.has(cpReg)) {
          drawEcsSat(cpReg, ruleTileXEcsCluster, tier2W, tier2H, 2, [
            addr,
            clusterBand.clusterPath,
          ]);
          y += tier2H + satelliteGap;
        } else {
          y += tier2H + satelliteGap;
        }
      }
      return y;
    }
    case "ecs_companions": {
      const cluster = bundles.ecs.cluster;
      if (!cluster) {
        return y;
      }
      const ruleTileXEcs = columnX + Math.floor((iamW - tier2W) / 2);
      for (const satAddr of cluster.stack) {
        const satType = getTerraformCardResourceType(
          satAddr,
          getPrimaryResource(
            nodes[satAddr] as TerraformPlanGraphNode,
          ) as Record<string, unknown> | null,
        );
        const isTaskDef = satType === "aws_ecs_task_definition";
        const tileH = isTaskDef ? tier1H : tier2H;
        const tileW = isTaskDef ? iamW : tier2W;
        const tileX = isTaskDef ? columnX : ruleTileXEcs;
        if (globalPlaced.ecs.has(satAddr)) {
          y += tileH + satelliteGap;
          continue;
        }
        globalPlaced.ecs.add(satAddr);
        addClusterMember(satAddr, tileX, y, tileW, tileH);
        pushRect(skeleton, satAddr, tileX, y, tileW, tileH, nodes, {
          explodeParentKeys: [addr],
          satelliteTier: isTaskDef ? 1 : 2,
        });
        y += tileH + satelliteGap;
      }
      return y;
    }
    case "ecs_ec2_capacity_companions": {
      const ec2Cluster = bundles.ecsEc2.cluster;
      if (!ec2Cluster?.chains.length) {
        return y;
      }
      const ruleTileXEc2 = columnX + Math.floor((iamW - tier2W) / 2);
      const drawChainSat = (
        satAddr: string,
        x: number,
        w: number,
        h: number,
        tier: 1 | 2,
        explodeKeys: string[],
        yPos: number,
      ): number => {
        if (globalPlaced.ecs.has(satAddr)) {
          return h;
        }
        globalPlaced.ecs.add(satAddr);
        addClusterMember(satAddr, x, yPos, w, h);
        pushRect(skeleton, satAddr, x, yPos, w, h, nodes, {
          explodeParentKeys: explodeKeys,
          satelliteTier: tier,
        });
        return h;
      };
      for (const chain of ec2Cluster.chains) {
        y +=
          drawChainSat(
            chain.capacityProvider,
            columnX,
            iamW,
            tier1H,
            1,
            [addr],
            y,
          ) + satelliteGap;

        if (chain.autoscalingGroup) {
          y +=
            drawChainSat(
              chain.autoscalingGroup,
              ruleTileXEc2,
              tier2W,
              tier2H,
              2,
              [addr, chain.capacityProvider],
              y,
            ) + satelliteGap;
        }
        if (chain.launchTemplate) {
          y +=
            drawChainSat(
              chain.launchTemplate,
              ruleTileXEc2,
              tier2W,
              tier2H,
              2,
              [
                addr,
                chain.capacityProvider,
                ...(chain.autoscalingGroup ? [chain.autoscalingGroup] : []),
              ],
              y,
            ) + satelliteGap;
        }
        if (chain.instanceProfile) {
          y +=
            drawChainSat(
              chain.instanceProfile,
              ruleTileXEc2,
              tier2W,
              tier2H,
              2,
              [
                addr,
                chain.capacityProvider,
                ...(chain.autoscalingGroup ? [chain.autoscalingGroup] : []),
                ...(chain.launchTemplate ? [chain.launchTemplate] : []),
              ],
              y,
            ) + satelliteGap;
        }
      }
      return y;
    }
    case "alb_companions": {
      const cluster = bundles.alb.cluster;
      if (!cluster) {
        return y;
      }
      for (const satAddr of cluster.stack) {
        const m = albCompanionDrawMetrics(
          nodes,
          satAddr,
          iamW,
          tier2W,
          tier1H,
          tier2H,
        );
        if (globalPlaced.alb.has(satAddr)) {
          y += m.tileH + satelliteGap;
          continue;
        }
        globalPlaced.alb.add(satAddr);
        addClusterMember(satAddr, columnX + m.tileXOffset, y, m.tileW, m.tileH);
        pushRect(
          skeleton,
          satAddr,
          columnX + m.tileXOffset,
          y,
          m.tileW,
          m.tileH,
          nodes,
          {
            explodeParentKeys: [addr],
            satelliteTier: m.tier,
          },
        );
        y += m.tileH + satelliteGap;
      }
      return y;
    }
    case "api_gateway_companions": {
      const cluster = bundles.api.cluster;
      if (!cluster) {
        return y;
      }
      const ruleTileXApi = columnX + Math.floor((iamW - tier2W) / 2);
      const drawApiSatellite = (
        satAddr: string,
        x: number,
        cy: number,
        w: number,
        h: number,
        tier: 1 | 2,
        explodeKeys: string[],
      ): number => {
        if (globalPlaced.apiGateway.has(satAddr)) {
          return h;
        }
        globalPlaced.apiGateway.add(satAddr);
        addClusterMember(satAddr, x, cy, w, h);
        pushRect(skeleton, satAddr, x, cy, w, h, nodes, {
          explodeParentKeys: explodeKeys,
          satelliteTier: tier,
        });
        return h;
      };

      for (const stageEntry of cluster.stages) {
        y +=
          drawApiSatellite(stageEntry.stage, columnX, y, iamW, tier1H, 1, [
            addr,
          ]) + satelliteGap;

        if (stageEntry.deployment) {
          y +=
            drawApiSatellite(
              stageEntry.deployment,
              ruleTileXApi,
              y,
              tier2W,
              tier2H,
              2,
              [addr, stageEntry.stage],
            ) + satelliteGap;
        }
        if (stageEntry.logGroup) {
          y +=
            drawApiSatellite(
              stageEntry.logGroup,
              ruleTileXApi,
              y,
              tier2W,
              tier2H,
              2,
              [addr, stageEntry.stage],
            ) + satelliteGap;
        }
      }

      for (const msPath of cluster.methodSettings) {
        y +=
          drawApiSatellite(msPath, columnX, y, iamW, tier1H, 1, [addr]) +
          satelliteGap;
      }
      return y;
    }
    case "tgw_companions": {
      const cluster = bundles.tgw.cluster;
      if (!cluster) {
        return y;
      }
      const ruleTileXTgw = columnX + Math.floor((iamW - tier2W) / 2);
      const drawTgwSatellite = (
        satAddr: string,
        x: number,
        cy: number,
        w: number,
        h: number,
        tier: 1 | 2,
        explodeKeys: string[],
      ): number => {
        if (globalPlaced.tgw.has(satAddr)) {
          return h;
        }
        globalPlaced.tgw.add(satAddr);
        addClusterMember(satAddr, x, cy, w, h);
        pushRect(skeleton, satAddr, x, cy, w, h, nodes, {
          explodeParentKeys: explodeKeys,
          satelliteTier: tier,
        });
        return h;
      };

      for (const vpcAtt of cluster.vpcAttachments) {
        y +=
          drawTgwSatellite(vpcAtt, columnX, y, iamW, tier1H, 1, [addr]) +
          satelliteGap;
      }
      for (const peering of cluster.peering) {
        y +=
          drawTgwSatellite(peering.peering, columnX, y, iamW, tier1H, 1, [
            addr,
          ]) + satelliteGap;
        if (peering.accepter) {
          y +=
            drawTgwSatellite(
              peering.accepter,
              ruleTileXTgw,
              y,
              tier2W,
              tier2H,
              2,
              [addr, peering.peering],
            ) + satelliteGap;
        }
        for (const route of peering.routes) {
          y +=
            drawTgwSatellite(route, ruleTileXTgw, y, tier2W, tier2H, 2, [
              addr,
              peering.peering,
            ]) + satelliteGap;
        }
      }
      for (const rt of cluster.routeTables) {
        y +=
          drawTgwSatellite(rt, columnX, y, iamW, tier1H, 1, [addr]) +
          satelliteGap;
      }
      for (const route of cluster.standaloneRoutes) {
        y +=
          drawTgwSatellite(route, ruleTileXTgw, y, tier2W, tier2H, 2, [addr]) +
          satelliteGap;
      }
      return y;
    }
    case "aurora_companions": {
      const cluster = bundles.aurora.cluster;
      if (!cluster) {
        return y;
      }
      const policyTileX = columnX + Math.floor((iamW - tier2W) / 2);

      if (cluster.instances.length > 0) {
        let instBounds: SatelliteClusterBounds | null = null;
        const instFrameChildIds: string[] = [];
        for (const instPath of cluster.instances) {
          const layoutId = terraformSatelliteLayoutElementId(addr, instPath);
          if (globalPlaced.datastore.has(instPath)) {
            y += tier1H + satelliteGap;
            continue;
          }
          globalPlaced.datastore.add(instPath);
          drawScopedSatelliteTile({
            nodePath: instPath,
            layoutId,
            x: columnX,
            y,
            w: iamW,
            h: tier1H,
            tier: 1,
            explodeParentKeys: [addr],
            skeleton,
            nodes,
            pushRect,
            addClusterMember,
          });
          instFrameChildIds.push(layoutId);
          instBounds = growSatelliteClusterBounds(
            instBounds,
            columnX,
            y,
            iamW,
            tier1H,
          );
          y += tier1H + satelliteGap;
        }
        if (instBounds && instFrameChildIds.length > 0) {
          pushSatelliteClusterFrame({
            skeleton,
            frameId: satelliteClusterSkeletonId(addr, `${addr}::instances`),
            bounds: instBounds,
            childIds: instFrameChildIds,
            name: "Aurora instances",
            parentPrimary: addr,
            rootNodePath: cluster.instances[0]!,
            accountId: p.placement.accountId,
            region: p.placement.region,
            vpcId: p.placement.vpcId,
            addClusterMember,
          });
        }
      }

      if (cluster.secret) {
        const secretPath = cluster.secret;
        const secretLayoutId = terraformSatelliteLayoutElementId(
          addr,
          secretPath,
        );
        let credBounds: SatelliteClusterBounds | null = null;
        const credFrameChildIds: string[] = [];
        if (!globalPlaced.datastore.has(secretPath)) {
          globalPlaced.datastore.add(secretPath);
          drawScopedSatelliteTile({
            nodePath: secretPath,
            layoutId: secretLayoutId,
            x: columnX,
            y,
            w: iamW,
            h: tier1H,
            tier: 1,
            explodeParentKeys: [addr],
            skeleton,
            nodes,
            pushRect,
            addClusterMember,
          });
          credFrameChildIds.push(secretLayoutId);
          credBounds = growSatelliteClusterBounds(
            credBounds,
            columnX,
            y,
            iamW,
            tier1H,
          );
          y += tier1H + satelliteGap;
        }

        if (cluster.secretVersion) {
          const verPath = cluster.secretVersion;
          const verLayoutId = terraformSatelliteLayoutElementId(addr, verPath);
          if (!globalPlaced.datastore.has(verPath)) {
            globalPlaced.datastore.add(verPath);
            drawScopedSatelliteTile({
              nodePath: verPath,
              layoutId: verLayoutId,
              x: policyTileX,
              y,
              w: tier2W,
              h: tier2H,
              tier: 2,
              explodeParentKeys: [secretLayoutId],
              skeleton,
              nodes,
              pushRect,
              addClusterMember,
            });
            credFrameChildIds.push(verLayoutId);
            credBounds = growSatelliteClusterBounds(
              credBounds,
              policyTileX,
              y,
              tier2W,
              tier2H,
            );
            y += tier2H + satelliteGap;
          }
        }

        if (credBounds && credFrameChildIds.length > 0) {
          pushSatelliteClusterFrame({
            skeleton,
            frameId: satelliteClusterSkeletonId(addr, `${addr}::credentials`),
            bounds: credBounds,
            childIds: credFrameChildIds,
            name: "Credentials",
            parentPrimary: addr,
            rootNodePath: secretPath,
            accountId: p.placement.accountId,
            region: p.placement.region,
            vpcId: p.placement.vpcId,
            addClusterMember,
          });
        }
      }

      if (cluster.subnetGroup) {
        const sgPath = cluster.subnetGroup;
        const sgLayoutId = terraformSatelliteLayoutElementId(addr, sgPath);
        if (!globalPlaced.datastore.has(sgPath)) {
          globalPlaced.datastore.add(sgPath);
          drawScopedSatelliteTile({
            nodePath: sgPath,
            layoutId: sgLayoutId,
            x: policyTileX,
            y,
            w: tier2W,
            h: tier2H,
            tier: 2,
            explodeParentKeys: [addr],
            skeleton,
            nodes,
            pushRect,
            addClusterMember,
          });
          y += tier2H + satelliteGap;
        }
      }
      return y;
    }
    case "rds_companions": {
      const cluster = bundles.rds.cluster;
      if (!cluster) {
        return y;
      }
      const policyTileX = columnX + Math.floor((iamW - tier2W) / 2);

      if (cluster.secret) {
        const secretPath = cluster.secret;
        const secretLayoutId = terraformSatelliteLayoutElementId(
          addr,
          secretPath,
        );
        let credBounds: SatelliteClusterBounds | null = null;
        const credFrameChildIds: string[] = [];
        if (!globalPlaced.datastore.has(secretPath)) {
          globalPlaced.datastore.add(secretPath);
          drawScopedSatelliteTile({
            nodePath: secretPath,
            layoutId: secretLayoutId,
            x: columnX,
            y,
            w: iamW,
            h: tier1H,
            tier: 1,
            explodeParentKeys: [addr],
            skeleton,
            nodes,
            pushRect,
            addClusterMember,
          });
          credFrameChildIds.push(secretLayoutId);
          credBounds = growSatelliteClusterBounds(
            credBounds,
            columnX,
            y,
            iamW,
            tier1H,
          );
          y += tier1H + satelliteGap;
        }

        if (cluster.secretVersion) {
          const verPath = cluster.secretVersion;
          const verLayoutId = terraformSatelliteLayoutElementId(addr, verPath);
          if (!globalPlaced.datastore.has(verPath)) {
            globalPlaced.datastore.add(verPath);
            drawScopedSatelliteTile({
              nodePath: verPath,
              layoutId: verLayoutId,
              x: policyTileX,
              y,
              w: tier2W,
              h: tier2H,
              tier: 2,
              explodeParentKeys: [secretLayoutId],
              skeleton,
              nodes,
              pushRect,
              addClusterMember,
            });
            credFrameChildIds.push(verLayoutId);
            credBounds = growSatelliteClusterBounds(
              credBounds,
              policyTileX,
              y,
              tier2W,
              tier2H,
            );
            y += tier2H + satelliteGap;
          }
        }

        if (credBounds && credFrameChildIds.length > 0) {
          pushSatelliteClusterFrame({
            skeleton,
            frameId: satelliteClusterSkeletonId(addr, `${addr}::credentials`),
            bounds: credBounds,
            childIds: credFrameChildIds,
            name: "Credentials",
            parentPrimary: addr,
            rootNodePath: secretPath,
            accountId: p.placement.accountId,
            region: p.placement.region,
            vpcId: p.placement.vpcId,
            addClusterMember,
          });
        }
      }

      if (cluster.subnetGroup) {
        const sgPath = cluster.subnetGroup;
        const sgLayoutId = terraformSatelliteLayoutElementId(addr, sgPath);
        if (!globalPlaced.datastore.has(sgPath)) {
          globalPlaced.datastore.add(sgPath);
          drawScopedSatelliteTile({
            nodePath: sgPath,
            layoutId: sgLayoutId,
            x: policyTileX,
            y,
            w: tier2W,
            h: tier2H,
            tier: 2,
            explodeParentKeys: [addr],
            skeleton,
            nodes,
            pushRect,
            addClusterMember,
          });
          y += tier2H + satelliteGap;
        }
      }
      return y;
    }
    case "lambda_permission": {
      const cluster = bundles.lambdaPermission.cluster;
      if (!cluster) {
        return y;
      }
      for (const satAddr of cluster.stack) {
        const m = companionStackTileMetrics(
          nodes,
          satAddr,
          iamW,
          tier1H,
          tier2W,
          tier2H,
        );
        if (globalPlaced.lambdaPermission.has(satAddr)) {
          y += m.tileH + satelliteGap;
          continue;
        }
        globalPlaced.lambdaPermission.add(satAddr);
        addClusterMember(satAddr, columnX + m.tileXOffset, y, m.tileW, m.tileH);
        pushRect(
          skeleton,
          satAddr,
          columnX + m.tileXOffset,
          y,
          m.tileW,
          m.tileH,
          nodes,
          {
            explodeParentKeys: [addr],
            satelliteTier: m.tier,
          },
        );
        y += m.tileH + satelliteGap;
      }
      return y;
    }
    case "security_groups": {
      const cluster = bundles.sg.cluster;
      if (!cluster) {
        return y;
      }
      const satXRight = columnX;
      const ruleTileX =
        p.ruleTileX ?? satXRight + Math.floor((sgW - tier2W) / 2);
      const sgGap = p.sgBetweenGroupsGap ?? 4;

      for (let gi = 0; gi < cluster.groups.length; gi++) {
        const group = cluster.groups[gi]!;
        const sgLayoutId = terraformSatelliteLayoutElementId(
          addr,
          group.sgPath,
        );
        let bounds: SatelliteClusterBounds | null = null;
        const frameChildIds: string[] = [];

        drawScopedSatelliteTile({
          nodePath: group.sgPath,
          layoutId: sgLayoutId,
          x: satXRight,
          y,
          w: sgW,
          h: tier1H,
          tier: 1,
          explodeParentKeys: [addr],
          skeleton,
          nodes,
          pushRect,
          addClusterMember,
        });
        frameChildIds.push(sgLayoutId);
        bounds = growSatelliteClusterBounds(bounds, satXRight, y, sgW, tier1H);
        y += tier1H + satelliteGap;

        for (const rulePath of group.rules) {
          const ruleLayoutId = terraformSatelliteSgRuleLayoutElementId(
            addr,
            rulePath,
          );
          drawScopedSatelliteTile({
            nodePath: rulePath,
            layoutId: ruleLayoutId,
            x: ruleTileX,
            y,
            w: tier2W,
            h: tier2H,
            tier: 2,
            explodeParentKeys: [sgLayoutId],
            skeleton,
            nodes,
            pushRect,
            addClusterMember,
          });
          frameChildIds.push(ruleLayoutId);
          bounds = growSatelliteClusterBounds(
            bounds,
            ruleTileX,
            y,
            tier2W,
            tier2H,
          );
          y += tier2H + satelliteGap;
        }

        if (bounds && frameChildIds.length > 0) {
          pushSatelliteClusterFrame({
            skeleton,
            frameId: satelliteClusterSkeletonId(addr, group.sgPath),
            bounds,
            childIds: frameChildIds,
            name: shortTerraformResourceLabel(group.sgPath),
            parentPrimary: addr,
            rootNodePath: group.sgPath,
            accountId: p.placement.accountId,
            region: p.placement.region,
            vpcId: p.placement.vpcId,
            addClusterMember,
          });
        }

        if (gi < cluster.groups.length - 1) {
          y += sgGap;
        }
      }
      return y;
    }
    case "sqs_companions": {
      const cluster = bundles.sqs.cluster;
      if (!cluster) {
        return y;
      }
      for (const satAddr of cluster.stack) {
        const m = companionStackTileMetrics(
          nodes,
          satAddr,
          sgW,
          tier1H,
          tier2W,
          tier2H,
        );
        if (globalPlaced.sqs.has(satAddr)) {
          y += m.tileH + satelliteGap;
          continue;
        }
        globalPlaced.sqs.add(satAddr);
        addClusterMember(satAddr, columnX + m.tileXOffset, y, m.tileW, m.tileH);
        pushRect(
          skeleton,
          satAddr,
          columnX + m.tileXOffset,
          y,
          m.tileW,
          m.tileH,
          nodes,
          {
            explodeParentKeys: [addr],
            satelliteTier: m.tier,
          },
        );
        y += m.tileH + satelliteGap;
      }
      return y;
    }
    default:
      return y;
  }
}
