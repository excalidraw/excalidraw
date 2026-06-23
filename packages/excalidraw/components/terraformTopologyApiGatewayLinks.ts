/**
 * Semantic topology: private `aws_api_gateway_rest_api` (VPC endpoint–bound) and
 * companions — stage → deployment + access-log group, method settings on the API.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import {
  mergeTerraformPlanResourceValues,
  terraformModulePrefixForAddress,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import { recordNodesByTypeFallbackScan } from "./terraformSatelliteFallbackCounter";
import {
  pickResourceValuesForTopologyPlacement,
  type TerraformPlanProviderContext,
} from "./terraformTopologyExtract";
import { topologyBareAddressKey } from "./terraformTopologyAddress";
import {
  parseStackAddress,
  stripStackPrefixForModuleParsing,
} from "./terraformStackAddress";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

function candidatesForType(
  nodesByType: ReadonlyMap<string, readonly string[]> | undefined,
  type: string,
  nodes: TerraformPlanNodesMap,
): readonly string[] {
  if (!nodesByType) {
    recordNodesByTypeFallbackScan();
    return Object.keys(nodes);
  }
  return nodesByType.get(type) ?? [];
}

function candidatesForTypes(
  nodesByType: ReadonlyMap<string, readonly string[]> | undefined,
  types: ReadonlySet<string>,
  nodes: TerraformPlanNodesMap,
): readonly string[] {
  if (!nodesByType) {
    recordNodesByTypeFallbackScan();
    return Object.keys(nodes);
  }
  const out: string[] = [];
  for (const t of types) {
    out.push(...(nodesByType.get(t) ?? []));
  }
  return out;}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

function stringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
}

function vpcEndpointSubnetIds(values: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  for (const sid of stringArrayField(values.subnet_ids)) {
    ids.add(sid);
  }
  for (const sid of stringArrayField(values.subnets)) {
    ids.add(sid);
  }
  const subnetMapping = values.subnet_mapping;
  if (Array.isArray(subnetMapping)) {
    for (const entry of subnetMapping) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const sid = (entry as Record<string, unknown>).subnet_id;
        if (typeof sid === "string" && sid.length > 0) {
          ids.add(sid);
        }
      }
    }
  }
  return [...ids].sort();
}

function flattenStringish(value: unknown, out: string[]): void {
  if (typeof value === "string" && value.trim()) {
    out.push(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenStringish(item, out);
    }
    return;
  }
  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      flattenStringish(v, out);
    }
  }
}

/** Types drawn only under `aws_api_gateway_rest_api` when cluster resolution succeeds. */
export const API_GATEWAY_TOPOLOGY_SATELLITE_TYPES = new Set([
  "aws_api_gateway_deployment",
  "aws_api_gateway_stage",
  "aws_api_gateway_method_settings",
  "aws_api_gateway_vpc_link",
]);

export type TopologyModuleScope = {
  stackId: string | null;
  modulePrefix: string;
};

export function topologyModuleScopeForAddress(
  address: string,
): TopologyModuleScope {
  const bare = stripStackPrefixForModuleParsing(address);
  return {
    stackId: parseStackAddress(address)?.stackId ?? null,
    modulePrefix: terraformModulePrefixForAddress(bare),
  };
}

function moduleScopesMatch(
  a: TopologyModuleScope,
  b: TopologyModuleScope,
): boolean {
  return a.stackId === b.stackId && a.modulePrefix === b.modulePrefix;
}

export function isApiGatewayTopologySatelliteResourceType(
  resourceType: string,
): boolean {
  return (
    API_GATEWAY_TOPOLOGY_SATELLITE_TYPES.has(resourceType) ||
    resourceType === "aws_cloudwatch_log_group"
  );
}

function endpointConfigurationBlocks(
  values: Record<string, unknown>,
): Record<string, unknown>[] {
  const raw = values.endpoint_configuration;
  if (Array.isArray(raw)) {
    return raw.filter((b): b is Record<string, unknown> =>
      Boolean(b && typeof b === "object" && !Array.isArray(b)),
    );
  }
  if (isPlainObject(raw)) {
    return [raw];
  }
  return [];
}

function accessLogSettingsBlocks(
  values: Record<string, unknown>,
): Record<string, unknown>[] {
  const raw = values.access_log_settings;
  if (Array.isArray(raw)) {
    return raw.filter((b): b is Record<string, unknown> =>
      Boolean(b && typeof b === "object" && !Array.isArray(b)),
    );
  }
  if (isPlainObject(raw)) {
    return [raw];
  }
  return [];
}

export function isPrivateVpcEndpointBoundRestApi(
  values: Record<string, unknown>,
): boolean {
  const blocks = endpointConfigurationBlocks(values);
  if (blocks.length === 0) {
    return false;
  }
  for (const ec of blocks) {
    const types: string[] = [];
    flattenStringish(ec.types, types);
    const isPrivate = types.some((t) => t.toUpperCase() === "PRIVATE");
    if (!isPrivate) {
      continue;
    }
    const vpces: string[] = [];
    flattenStringish(ec.vpc_endpoint_ids, vpces);
    if (vpces.length > 0) {
      return true;
    }
  }
  return false;
}

function collectVpcEndpointIdRefs(values: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const ec of endpointConfigurationBlocks(values)) {
    flattenStringish(ec.vpc_endpoint_ids, out);
  }
  return out;
}

type PlanRc = Parameters<typeof pickResourceValuesForTopologyPlacement>[0];

/**
 * Resolve VPC + subnets for a private REST API from its `vpc_endpoint_ids` by
 * matching managed `aws_vpc_endpoint` resources in the plan (cross-stack by `id`).
 */
export function resolveVpcPlacementFromPrivateRestApi(
  plan: TerraformPlanProviderContext & { resource_changes?: PlanRc[] },
  values: Record<string, unknown>,
  subnetToVpc: ReadonlyMap<string, string>,
): { vpcId: string; subnetIds: string[] } | null {
  if (!isPrivateVpcEndpointBoundRestApi(values)) {
    return null;
  }
  const want = new Set(collectVpcEndpointIdRefs(values));
  if (want.size === 0) {
    return null;
  }
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];

  for (const rc of changes) {
    if (rc.mode !== "managed" || rc.type !== "aws_vpc_endpoint") {
      continue;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (!pv) {
      continue;
    }
    const id = typeof pv.id === "string" ? pv.id : "";
    const addr = typeof rc.address === "string" ? rc.address : "";
    const stripAddr = stripIndexes(addr);
    const matches =
      (id && want.has(id)) ||
      (addr && want.has(addr)) ||
      (stripAddr && want.has(stripAddr)) ||
      [...want].some(
        (w) =>
          w === id ||
          w === addr ||
          w === stripAddr ||
          stripIndexes(w) === stripAddr,
      );
    if (!matches) {
      continue;
    }
    const vpcId = typeof pv.vpc_id === "string" ? pv.vpc_id : "";
    if (!vpcId) {
      continue;
    }
    const subnetIds = vpcEndpointSubnetIds(pv);
    return { vpcId, subnetIds };
  }

  return null;
}

function findRestApiAddressForPlanRef(
  ref: string,
  changes: readonly PlanRc[],
): string | null {
  const t = ref.trim();
  if (!t) {
    return null;
  }
  const stripT = stripIndexes(t);

  for (const rc of changes) {
    if (
      rc.type !== "aws_api_gateway_rest_api" ||
      typeof rc.address !== "string"
    ) {
      continue;
    }
    const addr = rc.address;
    const stripAddr = stripIndexes(addr);
    if (
      t === addr ||
      stripT === stripAddr ||
      t === stripAddr ||
      stripT === addr
    ) {
      return addr;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (!pv) {
      continue;
    }
    const id = typeof pv.id === "string" ? pv.id : "";
    if (id && (t === id || stripT === id)) {
      return addr;
    }
  }
  return null;
}

function isVpcLinkConnectionType(value: unknown): boolean {
  const strings: string[] = [];
  flattenStringish(value, strings);
  return strings.some((s) => s.toUpperCase().includes("VPC_LINK"));
}

function resolveVpcLinkIdToVpcLinkPath(
  nodes: TerraformPlanNodesMap,
  linkRef: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(linkRef, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    for (const candidate of [s, stripIndexes(s)]) {
      const key = resolveTerraformPlanNodeKey(graphNodes, candidate);
      if (key && isAwsVpcLinkNode(nodes, key)) {
        return key;
      }
    }
  }

  for (const path of candidatesForType(nodesByType, "aws_api_gateway_vpc_link", nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (!isAwsVpcLinkNode(nodes, path)) {
      continue;
    }
    const v = mergeTerraformPlanResourceValues(
      getPrimaryResource(nodes[path] as TerraformPlanGraphNode),
    );
    const id = typeof v.id === "string" ? v.id : "";
    if (id && strings.some((x) => x === id)) {
      return path;
    }
  }

  return null;
}

function isAwsVpcLinkNode(nodes: TerraformPlanNodesMap, path: string): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_api_gateway_vpc_link";
}

export function resolveVpcLinksForRestApi(
  nodes: TerraformPlanNodesMap,
  restApiAddress: string,
  changes?: readonly PlanRc[],
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string[] {
  const apiScope = topologyModuleScopeForAddress(restApiAddress);
  const vpcLinks: string[] = [];

  for (const path of candidatesForType(nodesByType, "aws_api_gateway_vpc_link", nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (!isAwsVpcLinkNode(nodes, path)) {
      continue;
    }
    if (!moduleScopesMatch(topologyModuleScopeForAddress(path), apiScope)) {
      continue;
    }
    vpcLinks.push(path);
  }

  if (vpcLinks.length > 0) {
    return vpcLinks.sort((a, b) => a.localeCompare(b));
  }

  if (!changes?.length) {
    return vpcLinks;
  }

  const linked = new Set<string>();
  for (const rc of changes) {
    if (rc.type !== "aws_api_gateway_integration" || !rc.address) {
      continue;
    }
    const pv = pickResourceValuesForTopologyPlacement(rc);
    if (!pv || !isVpcLinkConnectionType(pv.connection_type)) {
      continue;
    }
    const parent = findRestApiAddressForPlanRef(
      String(pv.rest_api_id ?? ""),
      changes,
    );
    if (parent !== restApiAddress) {
      continue;
    }
    const linkPath = resolveVpcLinkIdToVpcLinkPath(nodes, pv.connection_id, nodesByType);
    if (linkPath) {
      linked.add(linkPath);
    }
  }

  return [...linked].sort((a, b) => a.localeCompare(b));
}

/** Resolve parent REST API for a vpc link (module scope, then integration refs). */
export function resolveVpcLinkParentRestApiAddressFromPlan(
  vpcLinkRc: PlanRc,
  changes: readonly PlanRc[],
  nodes?: TerraformPlanNodesMap,
): string | null {
  if (vpcLinkRc.type !== "aws_api_gateway_vpc_link" || !vpcLinkRc.address) {
    return null;
  }
  const linkScope = topologyModuleScopeForAddress(vpcLinkRc.address);
  const candidates: string[] = [];
  for (const rc of changes) {
    if (rc.type !== "aws_api_gateway_rest_api" || !rc.address) {
      continue;
    }
    if (
      moduleScopesMatch(topologyModuleScopeForAddress(rc.address), linkScope)
    ) {
      candidates.push(rc.address);
    }
  }
  if (candidates.length === 1) {
    return candidates[0]!;
  }

  if (nodes) {
    for (const rc of changes) {
      if (rc.type !== "aws_api_gateway_integration" || !rc.address) {
        continue;
      }
      const pv = pickResourceValuesForTopologyPlacement(rc);
      if (!pv || !isVpcLinkConnectionType(pv.connection_type)) {
        continue;
      }
      const linkPath = resolveVpcLinkIdToVpcLinkPath(nodes, pv.connection_id);
      if (linkPath !== vpcLinkRc.address) {
        continue;
      }
      const parent = findRestApiAddressForPlanRef(
        String(pv.rest_api_id ?? ""),
        changes,
      );
      if (parent) {
        return parent;
      }
    }
  }

  return candidates.length > 0 ? candidates[0]! : null;
}

/** Resolve `rest_api_id` on deployment / stage / method_settings to parent REST API address. */
export function resolveApiGatewayCompanionParentRestApiAddressFromPlan(
  companionRc: PlanRc,
  changes: readonly PlanRc[],
  nodes?: TerraformPlanNodesMap,
): string | null {
  const t = companionRc.type;
  if (!t || !companionRc.address) {
    return null;
  }
  if (t === "aws_api_gateway_vpc_link") {
    return resolveVpcLinkParentRestApiAddressFromPlan(
      companionRc,
      changes,
      nodes,
    );
  }
  if (!API_GATEWAY_TOPOLOGY_SATELLITE_TYPES.has(t)) {
    return null;
  }
  const pv = pickResourceValuesForTopologyPlacement(companionRc);
  if (!pv) {
    return null;
  }
  const refs: string[] = [];
  flattenStringish(pv.rest_api_id, refs);
  for (const raw of refs) {
    const parent = findRestApiAddressForPlanRef(raw, changes);
    if (parent) {
      return parent;
    }
  }
  return null;
}

function isAwsRestApiNode(nodes: TerraformPlanNodesMap, path: string): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_api_gateway_rest_api";
}

function isAwsCloudWatchLogGroupNode(
  nodes: TerraformPlanNodesMap,
  path: string,
): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_cloudwatch_log_group";
}

function isAwsApiGatewayDeploymentNode(
  nodes: TerraformPlanNodesMap,
  path: string,
): boolean {
  const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
  return primary?.type === "aws_api_gateway_deployment";
}

function resolveRestApiIdToRestApiPath(
  nodes: TerraformPlanNodesMap,
  restApiIdRef: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(restApiIdRef, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    for (const candidate of [s, stripIndexes(s)]) {
      const key = resolveTerraformPlanNodeKey(graphNodes, candidate);
      if (key && isAwsRestApiNode(nodes, key)) {
        return key;
      }
    }
  }

  for (const path of candidatesForType(nodesByType, "aws_api_gateway_rest_api", nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const primary = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!primary || primary.type !== "aws_api_gateway_rest_api") {
      continue;
    }
    const v = mergeTerraformPlanResourceValues(primary);
    if (typeof v.id === "string" && strings.some((x) => x === v.id)) {
      return path;
    }
  }

  return null;
}

function resolveDeploymentRefToDeploymentPath(
  nodes: TerraformPlanNodesMap,
  deploymentRef: unknown,
  restApiAddress: string,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(deploymentRef, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    for (const candidate of [s, stripIndexes(s)]) {
      const key = resolveTerraformPlanNodeKey(graphNodes, candidate);
      if (key && isAwsApiGatewayDeploymentNode(nodes, key)) {
        const v = mergeTerraformPlanResourceValues(
          getPrimaryResource(nodes[key] as TerraformPlanGraphNode),
        );
        const api = resolveRestApiIdToRestApiPath(nodes, v.rest_api_id, nodesByType);
        if (api === restApiAddress) {
          return key;
        }
      }
    }
  }

  for (const path of candidatesForType(nodesByType, "aws_api_gateway_deployment", nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    if (!isAwsApiGatewayDeploymentNode(nodes, path)) {
      continue;
    }
    const v = mergeTerraformPlanResourceValues(
      getPrimaryResource(nodes[path] as TerraformPlanGraphNode),
    );
    if (
      resolveRestApiIdToRestApiPath(nodes, v.rest_api_id, nodesByType) !== restApiAddress
    ) {
      continue;
    }
    const id = typeof v.id === "string" ? v.id : "";
    if (id && strings.some((x) => x === id)) {
      return path;
    }
  }

  return null;
}

function resolveLogGroupArnToPath(
  nodes: TerraformPlanNodesMap,
  arnRef: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  const strings: string[] = [];
  flattenStringish(arnRef, strings);
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;

  for (const text of strings) {
    const s = text.trim();
    if (!s) {
      continue;
    }
    for (const candidate of [s, stripIndexes(s)]) {
      const key = resolveTerraformPlanNodeKey(graphNodes, candidate);
      if (key && isAwsCloudWatchLogGroupNode(nodes, key)) {
        return key;
      }
    }
    const logGroupName = s.includes(":log-group:")
      ? s.split(":log-group:")[1]?.replace(/:\*$/, "") ?? ""
      : "";
    if (logGroupName) {
      for (const path of candidatesForType(nodesByType, "aws_cloudwatch_log_group", nodes)) {
        if (!isAwsCloudWatchLogGroupNode(nodes, path)) {
          continue;
        }
        const v = mergeTerraformPlanResourceValues(
          getPrimaryResource(nodes[path] as TerraformPlanGraphNode),
        );
        const names: string[] = [];
        flattenStringish(v.name, names);
        if (names.some((n) => n === logGroupName || n.endsWith(logGroupName))) {
          return path;
        }
      }
    }
  }

  return null;
}

function resolveStageAccessLogGroupPath(
  nodes: TerraformPlanNodesMap,
  stagePath: string,
  stageValues: Record<string, unknown>,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): string | null {
  for (const block of accessLogSettingsBlocks(stageValues)) {
    const refs: string[] = [];
    flattenStringish(block.destination_arn, refs);
    for (const ref of refs) {
      const path = resolveLogGroupArnToPath(nodes, ref, nodesByType);
      if (path) {
        return path;
      }
    }
  }
  return null;
}

export type ApiGatewayStageCluster = {
  stage: string;
  deployment: string | null;
  logGroup: string | null;
};

export type ApiGatewayCompanionCluster = {
  restApi: string;
  vpcLinks: string[];
  stages: ApiGatewayStageCluster[];
  methodSettings: string[];
};

export type ApiGatewayVpcLinkCluster = {
  restApi: string;
  vpcLinks: string[];
};

export function apiGatewayBottomCompanionSatellitePaths(
  cluster: ApiGatewayCompanionCluster,
): string[] {
  const out: string[] = [];
  for (const s of cluster.stages) {
    out.push(s.stage);
    if (s.deployment) {
      out.push(s.deployment);
    }
    if (s.logGroup) {
      out.push(s.logGroup);
    }
  }
  out.push(...cluster.methodSettings);
  return out;
}

export function apiGatewayCompanionSatellitePaths(
  cluster: ApiGatewayCompanionCluster,
): string[] {
  return [
    ...cluster.vpcLinks,
    ...apiGatewayBottomCompanionSatellitePaths(cluster),
  ];
}

const APIGW_STAGE_METHOD_TYPES = new Set([
  "aws_api_gateway_stage",
  "aws_api_gateway_method_settings",
]);

export function buildApiGatewayCompanionCluster(
  nodes: TerraformPlanNodesMap,
  restApiAddress: string,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: ApiGatewayCompanionCluster | null; edges: TopologyIamEdge[] } {
  const apiNode = nodes[restApiAddress] as TerraformPlanGraphNode | undefined;
  const apiPrimary = getPrimaryResource(apiNode);
  if (!apiPrimary || apiPrimary.type !== "aws_api_gateway_rest_api") {
    return { cluster: null, edges: [] };
  }

  const changes = Array.isArray(
    (plan as { resource_changes?: PlanRc[] } | undefined)?.resource_changes,
  )
    ? (plan as { resource_changes: PlanRc[] }).resource_changes ?? []
    : undefined;

  const vpcLinks = resolveVpcLinksForRestApi(nodes, restApiAddress, changes, nodesByType);
  const stages: ApiGatewayStageCluster[] = [];
  const methodSettings: string[] = [];

  for (const path of candidatesForTypes(nodesByType, APIGW_STAGE_METHOD_TYPES, nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    const values = mergeTerraformPlanResourceValues(p);
    if (t === "aws_api_gateway_stage") {
      if (
        resolveRestApiIdToRestApiPath(nodes, values.rest_api_id, nodesByType) !==
        restApiAddress
      ) {
        continue;
      }
      stages.push({
        stage: path,
        deployment: resolveDeploymentRefToDeploymentPath(
          nodes,
          values.deployment_id,
          restApiAddress,
          nodesByType,
        ),
        logGroup: resolveStageAccessLogGroupPath(nodes, path, values, nodesByType),
      });
      continue;
    }
    if (t === "aws_api_gateway_method_settings") {
      if (
        resolveRestApiIdToRestApiPath(nodes, values.rest_api_id, nodesByType) ===
        restApiAddress
      ) {
        methodSettings.push(path);
      }
    }
  }

  stages.sort((a, b) => a.stage.localeCompare(b.stage));
  methodSettings.sort((a, b) => a.localeCompare(b));

  if (
    stages.length === 0 &&
    methodSettings.length === 0 &&
    vpcLinks.length === 0
  ) {
    return { cluster: null, edges: [] };
  }

  const cluster: ApiGatewayCompanionCluster = {
    restApi: restApiAddress,
    vpcLinks,
    stages,
    methodSettings,
  };

  const edges: TopologyIamEdge[] = [];
  for (const linkPath of vpcLinks) {
    edges.push({
      source: restApiAddress,
      target: linkPath,
      type: "api_gateway_vpc_link",
      label: "VPC link",
    });
  }
  for (const s of stages) {
    edges.push({
      source: restApiAddress,
      target: s.stage,
      type: "api_gateway_stage",
      label: "stage",
    });
    if (s.deployment) {
      edges.push({
        source: s.stage,
        target: s.deployment,
        type: "api_gateway_deployment",
        label: "deployment",
      });
    }
    if (s.logGroup) {
      edges.push({
        source: s.stage,
        target: s.logGroup,
        type: "api_gateway_access_log",
        label: "access logs",
      });
    }
  }
  for (const ms of methodSettings) {
    edges.push({
      source: restApiAddress,
      target: ms,
      type: "api_gateway_method_settings",
      label: "method settings",
    });
  }

  return { cluster, edges };
}

export function apiGatewaySatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  restApiAddress: string,
  tier1SatelliteH: number,
  tier2SatelliteH: number,
  satelliteGap: number,
): number {
  const { cluster } = buildApiGatewayCompanionCluster(nodes, restApiAddress);
  if (!cluster) {
    return 0;
  }
  let h = 0;
  const addTier1 = () => {
    h += (h > 0 ? satelliteGap : 0) + tier1SatelliteH;
  };
  const addTier2 = () => {
    h += satelliteGap + tier2SatelliteH;
  };
  /** VPC links render to the left of tier-0, not in the bottom stack. */
  for (const s of cluster.stages) {
    addTier1();
    if (s.deployment) {
      addTier2();
    }
    if (s.logGroup) {
      addTier2();
    }
  }
  for (let i = 0; i < cluster.methodSettings.length; i++) {
    addTier1();
  }
  return h > 0 ? h + satelliteGap : 0;
}

export function collectApiGatewayClusterSatelliteAddressesForTopologyList(
  nodes: TerraformPlanNodesMap,
  addresses: readonly string[],
): Set<string> {
  const consumed = new Set<string>();
  for (const addr of addresses) {
    const n = nodes[addr] as TerraformPlanGraphNode | undefined;
    const pr = getPrimaryResource(n);
    if (!pr || pr.type !== "aws_api_gateway_rest_api") {
      continue;
    }
    const { cluster } = buildApiGatewayCompanionCluster(nodes, addr);
    if (cluster) {
      for (const s of apiGatewayCompanionSatellitePaths(cluster)) {
        consumed.add(s);
      }
    }
  }
  return consumed;
}

export function filterTopologyAddressesExcludingApiGatewaySatellites(
  nodes: TerraformPlanNodesMap,
  addresses: readonly string[],
): string[] {
  const consumed = collectApiGatewayClusterSatelliteAddressesForTopologyList(
    nodes,
    addresses,
  );
  return [...addresses].filter((a) => !consumed.has(a));
}

export function isApiGatewayCompanionConsumedAsSatellite(
  nodes: TerraformPlanNodesMap,
  address: string,
): boolean {
  const targetBare = topologyBareAddressKey(address);
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const pr = getPrimaryResource(nodes[path] as TerraformPlanGraphNode);
    if (!pr || pr.type !== "aws_api_gateway_rest_api") {
      continue;
    }
    const { cluster } = buildApiGatewayCompanionCluster(nodes, path);
    if (
      cluster &&
      apiGatewayCompanionSatellitePaths(cluster).some(
        (s) => topologyBareAddressKey(s) === targetBare,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function apiGatewayVpcLinkLeftSpanPx(
  nodes: TerraformPlanNodesMap,
  restApiAddress: string,
  tier1W: number,
  satelliteGap: number,
  plan?: unknown,
): number {
  const { cluster } = buildApiGatewayCompanionCluster(
    nodes,
    restApiAddress,
    plan,
  );
  if (!cluster?.vpcLinks.length) {
    return 0;
  }
  return tier1W + satelliteGap;
}

export function buildApiGatewayVpcLinkCluster(
  nodes: TerraformPlanNodesMap,
  restApiAddress: string,
  plan?: unknown,
  nodesByType?: ReadonlyMap<string, readonly string[]>,
): { cluster: ApiGatewayVpcLinkCluster | null; edges: TopologyIamEdge[] } {
  const { cluster, edges } = buildApiGatewayCompanionCluster(
    nodes,
    restApiAddress,
    plan,
    nodesByType,
  );
  if (!cluster?.vpcLinks.length) {
    return { cluster: null, edges: [] };
  }
  return {
    cluster: { restApi: cluster.restApi, vpcLinks: cluster.vpcLinks },
    edges: edges.filter((e) => e.type === "api_gateway_vpc_link"),
  };
}
