/**
 * Semantic topology: Aurora / RDS / DynamoDB companion satellites.
 */

import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";

import { pickResourceValuesForTopologyPlacement } from "./terraformTopologyExtract";
import {
  mergeTerraformPlanResourceValues,
  terraformModulePrefixForAddress,
  type TopologyIamEdge,
} from "./terraformTopologyIamLinks";
import {
  topologyModuleScopeForAddress,
  type TopologyModuleScope,
} from "./terraformTopologyApiGatewayLinks";
import { stripStackPrefixForModuleParsing } from "./terraformStackAddress";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

const stripIndexes = (address: string) => address.replace(/\[[^\]]+\]/g, "");

export const DATASTORE_TOPOLOGY_SATELLITE_TYPES = new Set([
  "aws_rds_cluster_instance",
  "aws_db_subnet_group",
  "aws_secretsmanager_secret",
  "aws_secretsmanager_secret_version",
]);

export function isDatastoreTopologySatelliteResourceType(
  resourceType: string,
): boolean {
  return DATASTORE_TOPOLOGY_SATELLITE_TYPES.has(resourceType);
}

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

function getResourceType(
  path: string,
  node: TerraformPlanGraphNode | undefined,
): string {
  const primary = getPrimaryResource(node);
  const t = primary?.type;
  if (typeof t === "string") {
    return t;
  }
  const parts = path.split(".");
  let i = 0;
  while (i < parts.length - 1 && parts[i] === "module") {
    i += 2;
  }
  if (i < parts.length && parts[i] === "data") {
    return typeof parts[i + 1] === "string" ? String(parts[i + 1]) : "";
  }
  return typeof parts[i] === "string" ? String(parts[i]) : "";
}

function moduleScopesMatch(
  a: TopologyModuleScope,
  b: TopologyModuleScope,
): boolean {
  return a.stackId === b.stackId && a.modulePrefix === b.modulePrefix;
}

function bareAddressInTerraformModule(
  modulePrefix: string,
  address: string,
): boolean {
  const bare = stripStackPrefixForModuleParsing(address);
  return bare === modulePrefix || bare.startsWith(`${modulePrefix}.`);
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

function planRefMatchesResourceAddress(
  ref: string,
  resourceAddress: string,
): boolean {
  const t = ref.trim();
  const addr = resourceAddress.trim();
  if (!t || !addr) {
    return false;
  }
  const stripT = stripIndexes(t);
  const stripAddr = stripIndexes(addr);
  if (
    t === addr ||
    stripT === stripAddr ||
    t === stripAddr ||
    stripT === addr
  ) {
    return true;
  }
  const bareAddr = stripStackPrefixForModuleParsing(addr);
  const stripBare = stripIndexes(bareAddr);
  return (
    t === bareAddr ||
    stripT === stripBare ||
    t === stripBare ||
    stripT === bareAddr ||
    bareAddr.endsWith(`.${t}`) ||
    stripBare.endsWith(`.${stripT}`)
  );
}

function refMatchesCluster(
  refs: string[],
  clusterPath: string,
  clusterValues: Record<string, unknown>,
): boolean {
  const ids: string[] = [];
  flattenStringish(clusterValues.id, ids);
  flattenStringish(clusterValues.arn, ids);
  flattenStringish(clusterValues.cluster_identifier, ids);
  ids.push(clusterPath);
  ids.push(stripStackPrefixForModuleParsing(clusterPath));

  for (const ref of refs) {
    for (const id of ids) {
      if (planRefMatchesResourceAddress(ref, id)) {
        return true;
      }
    }
  }
  return false;
}

function refMatchesSecret(
  refs: string[],
  secretPath: string,
  secretValues: Record<string, unknown>,
): boolean {
  const ids: string[] = [];
  flattenStringish(secretValues.id, ids);
  flattenStringish(secretValues.arn, ids);
  flattenStringish(secretValues.name, ids);
  ids.push(secretPath);
  for (const ref of refs) {
    for (const id of ids) {
      if (planRefMatchesResourceAddress(ref, id)) {
        return true;
      }
    }
  }
  return false;
}

function refMatchesDbSubnetGroup(
  ref: string,
  groupPath: string,
  groupValues: Record<string, unknown>,
): boolean {
  const names: string[] = [];
  flattenStringish(groupValues.name, names);
  flattenStringish(groupValues.id, names);
  names.push(groupPath);
  names.push(stripStackPrefixForModuleParsing(groupPath));
  const bare = stripStackPrefixForModuleParsing(groupPath);
  const shortName = bare.split(".").pop() ?? "";
  if (shortName) {
    names.push(shortName);
  }
  for (const n of names) {
    if (planRefMatchesResourceAddress(ref, n)) {
      return true;
    }
  }
  return false;
}

export type AuroraCompanionCluster = {
  cluster: string;
  instances: string[];
  subnetGroup: string | null;
  secret: string | null;
  secretVersion: string | null;
};

export type RdsCompanionCluster = {
  instance: string;
  subnetGroup: string | null;
  secret: string | null;
  secretVersion: string | null;
};

function listModuleScopedPaths(
  nodes: TerraformPlanNodesMap,
  scope: TopologyModuleScope,
): string[] {
  const out: string[] = [];
  for (const path of Object.keys(nodes)) {
    if (path === TERRAFORM_MODULE_TREE_KEY || path.startsWith("__")) {
      continue;
    }
    const nodeScope = topologyModuleScopeForAddress(path);
    if (moduleScopesMatch(nodeScope, scope)) {
      out.push(path);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function buildAuroraCompanionCluster(
  nodes: TerraformPlanNodesMap,
  clusterAddress: string,
): { cluster: AuroraCompanionCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[clusterAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_rds_cluster") {
    return { cluster: null, edges: [] };
  }

  const clusterValues = mergeTerraformPlanResourceValues(primary);
  const scope = topologyModuleScopeForAddress(clusterAddress);
  const modulePaths = listModuleScopedPaths(nodes, scope);

  const instances: string[] = [];
  let subnetGroup: string | null = null;
  let secret: string | null = null;
  let secretVersion: string | null = null;

  const groupNameRef =
    typeof clusterValues.db_subnet_group_name === "string"
      ? clusterValues.db_subnet_group_name
      : null;

  for (const path of modulePaths) {
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    const values = mergeTerraformPlanResourceValues(p);

    if (t === "aws_rds_cluster_instance") {
      const refs: string[] = [];
      flattenStringish(values.cluster_identifier, refs);
      if (refMatchesCluster(refs, clusterAddress, clusterValues)) {
        instances.push(path);
      }
      continue;
    }

    if (t === "aws_db_subnet_group" && !subnetGroup) {
      if (groupNameRef && refMatchesDbSubnetGroup(groupNameRef, path, values)) {
        subnetGroup = path;
      } else if (!groupNameRef) {
        subnetGroup = path;
      }
      continue;
    }

    if (t === "aws_secretsmanager_secret" && !secret) {
      secret = path;
      continue;
    }

    if (t === "aws_secretsmanager_secret_version" && !secretVersion) {
      const refs: string[] = [];
      flattenStringish(values.secret_id, refs);
      if (secret) {
        const secretNode = nodes[secret] as TerraformPlanGraphNode | undefined;
        const secretValues = mergeTerraformPlanResourceValues(
          getPrimaryResource(secretNode) ?? {},
        );
        if (refMatchesSecret(refs, secret, secretValues)) {
          secretVersion = path;
        }
      } else {
        secretVersion = path;
      }
    }
  }

  instances.sort((a, b) => a.localeCompare(b));

  if (instances.length === 0 && !subnetGroup && !secret && !secretVersion) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [];
  for (const inst of instances) {
    edges.push({
      source: clusterAddress,
      target: inst,
      type: "aurora_cluster_instance",
      label: "member",
    });
  }
  if (subnetGroup) {
    edges.push({
      source: clusterAddress,
      target: subnetGroup,
      type: "db_subnet_group",
      label: "subnets",
    });
  }
  if (secret) {
    edges.push({
      source: clusterAddress,
      target: secret,
      type: "db_credentials",
      label: "credentials",
    });
    if (secretVersion) {
      edges.push({
        source: secret,
        target: secretVersion,
        type: "db_credentials_version",
        label: "version",
      });
    }
  }

  return {
    cluster: {
      cluster: clusterAddress,
      instances,
      subnetGroup,
      secret,
      secretVersion,
    },
    edges,
  };
}

export function buildRdsCompanionCluster(
  nodes: TerraformPlanNodesMap,
  instanceAddress: string,
): { cluster: RdsCompanionCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[instanceAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_db_instance") {
    return { cluster: null, edges: [] };
  }

  const instanceValues = mergeTerraformPlanResourceValues(primary);
  const scope = topologyModuleScopeForAddress(instanceAddress);
  const modulePaths = listModuleScopedPaths(nodes, scope);

  let subnetGroup: string | null = null;
  let secret: string | null = null;
  let secretVersion: string | null = null;

  const groupNameRef =
    typeof instanceValues.db_subnet_group_name === "string"
      ? instanceValues.db_subnet_group_name
      : null;

  for (const path of modulePaths) {
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    const values = mergeTerraformPlanResourceValues(p);

    if (t === "aws_db_subnet_group" && !subnetGroup) {
      if (groupNameRef && refMatchesDbSubnetGroup(groupNameRef, path, values)) {
        subnetGroup = path;
      } else if (!groupNameRef) {
        subnetGroup = path;
      }
      continue;
    }

    if (t === "aws_secretsmanager_secret" && !secret) {
      secret = path;
      continue;
    }

    if (t === "aws_secretsmanager_secret_version" && !secretVersion) {
      const refs: string[] = [];
      flattenStringish(values.secret_id, refs);
      if (secret) {
        const secretNode = nodes[secret] as TerraformPlanGraphNode | undefined;
        const secretValues = mergeTerraformPlanResourceValues(
          getPrimaryResource(secretNode) ?? {},
        );
        if (refMatchesSecret(refs, secret, secretValues)) {
          secretVersion = path;
        }
      } else {
        secretVersion = path;
      }
    }
  }

  if (!subnetGroup && !secret && !secretVersion) {
    return { cluster: null, edges: [] };
  }

  const edges: TopologyIamEdge[] = [];
  if (subnetGroup) {
    edges.push({
      source: instanceAddress,
      target: subnetGroup,
      type: "db_subnet_group",
      label: "subnets",
    });
  }
  if (secret) {
    edges.push({
      source: instanceAddress,
      target: secret,
      type: "db_credentials",
      label: "credentials",
    });
    if (secretVersion) {
      edges.push({
        source: secret,
        target: secretVersion,
        type: "db_credentials_version",
        label: "version",
      });
    }
  }

  return {
    cluster: {
      instance: instanceAddress,
      subnetGroup,
      secret,
      secretVersion,
    },
    edges,
  };
}

function datastoreCompanionAddressesFromCluster(
  cluster: AuroraCompanionCluster | RdsCompanionCluster,
): string[] {
  const out: string[] = [];
  if ("instances" in cluster) {
    out.push(...cluster.instances);
  }
  if (cluster.subnetGroup) {
    out.push(cluster.subnetGroup);
  }
  if (cluster.secret) {
    out.push(cluster.secret);
  }
  if (cluster.secretVersion) {
    out.push(cluster.secretVersion);
  }
  return out;
}

export function collectAddressesFromDatastorePrimaries(
  nodes: TerraformPlanNodesMap,
  primaryAddresses: readonly string[],
): Set<string> {
  const out = new Set<string>();
  for (const addr of primaryAddresses) {
    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const t = getResourceType(addr, node);
    if (t === "aws_rds_cluster") {
      const { cluster } = buildAuroraCompanionCluster(nodes, addr);
      if (cluster) {
        for (const a of datastoreCompanionAddressesFromCluster(cluster)) {
          out.add(a);
        }
      }
    } else if (t === "aws_db_instance") {
      const { cluster } = buildRdsCompanionCluster(nodes, addr);
      if (cluster) {
        for (const a of datastoreCompanionAddressesFromCluster(cluster)) {
          out.add(a);
        }
      }
    }
  }
  return out;
}

export function isDatastoreCompanionConsumedAsSatellite(
  nodes: TerraformPlanNodesMap,
  address: string,
): boolean {
  const primaries = Object.keys(nodes).filter((p) => {
    if (p === TERRAFORM_MODULE_TREE_KEY || p.startsWith("__")) {
      return false;
    }
    const t = getResourceType(p, nodes[p] as TerraformPlanGraphNode);
    return t === "aws_rds_cluster" || t === "aws_db_instance";
  });
  return collectAddressesFromDatastorePrimaries(nodes, primaries).has(address);
}

export function auroraSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  tier1H: number,
  tier2H: number,
  satelliteGap: number,
): number {
  const { cluster } = buildAuroraCompanionCluster(nodes, address);
  if (!cluster) {
    return 0;
  }
  let count = 0;
  if (cluster.instances.length > 0) {
    count += cluster.instances.length;
  }
  if (cluster.secret) {
    count += 1;
    if (cluster.secretVersion) {
      count += 1;
    }
  }
  if (cluster.subnetGroup) {
    count += 1;
  }
  if (count === 0) {
    return 0;
  }
  let h = satelliteGap;
  for (let i = 0; i < cluster.instances.length; i++) {
    h += tier1H + satelliteGap;
  }
  if (cluster.secret) {
    h += tier1H + satelliteGap;
    if (cluster.secretVersion) {
      h += tier2H + satelliteGap;
    }
  }
  if (cluster.subnetGroup) {
    h += tier2H + satelliteGap;
  }
  return h;
}

export function rdsSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  address: string,
  tier1H: number,
  tier2H: number,
  satelliteGap: number,
): number {
  const { cluster } = buildRdsCompanionCluster(nodes, address);
  if (!cluster) {
    return 0;
  }
  let count = 0;
  if (cluster.secret) {
    count += 1;
    if (cluster.secretVersion) {
      count += 1;
    }
  }
  if (cluster.subnetGroup) {
    count += 1;
  }
  if (count === 0) {
    return 0;
  }
  let h = satelliteGap;
  if (cluster.secret) {
    h += tier1H + satelliteGap;
    if (cluster.secretVersion) {
      h += tier2H + satelliteGap;
    }
  }
  if (cluster.subnetGroup) {
    h += tier2H + satelliteGap;
  }
  return h;
}

/** Subnet ids for zone placement from `db_subnet_group_name` in the same module. */
export function resolveDbSubnetGroupSubnetIds(
  plan: {
    resource_changes?: Array<{
      address?: string;
      type?: string;
      mode?: string;
      change?: { after?: unknown; before?: unknown };
    }>;
  },
  primaryAddress: string,
  values: Record<string, unknown>,
): string[] {
  const direct = new Set<string>();
  for (const sid of collectPlacementSubnetIdsFromValues(values)) {
    direct.add(sid);
  }
  if (direct.size > 0) {
    return [...direct].sort();
  }

  const groupNameRef =
    typeof values.db_subnet_group_name === "string"
      ? values.db_subnet_group_name.trim()
      : "";
  const modulePrefix = terraformModulePrefixForAddress(
    stripStackPrefixForModuleParsing(primaryAddress),
  );
  if (!modulePrefix) {
    return inferSubnetIdsForModuleColocatedPrimariesFromPlan(
      plan,
      primaryAddress,
    );
  }

  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];

  for (const rc of changes) {
    if (rc.mode !== "managed" || rc.type !== "aws_db_subnet_group") {
      continue;
    }
    const addr = rc.address;
    if (!addr || !bareAddressInTerraformModule(modulePrefix, addr)) {
      continue;
    }
    const gv = pickResourceValuesForTopologyPlacement(
      rc as Parameters<typeof pickResourceValuesForTopologyPlacement>[0],
    );
    if (!gv) {
      continue;
    }
    if (groupNameRef) {
      const names: string[] = [];
      if (typeof gv.name === "string") {
        names.push(gv.name);
      }
      if (typeof gv.id === "string") {
        names.push(gv.id);
      }
      const matches = names.some(
        (n) =>
          n === groupNameRef ||
          stripIndexes(n) === stripIndexes(groupNameRef) ||
          addr.endsWith(groupNameRef) ||
          stripStackPrefixForModuleParsing(addr).endsWith(groupNameRef),
      );
      if (!matches) {
        continue;
      }
    }
    return collectPlacementSubnetIdsFromValues(gv);
  }

  return inferSubnetIdsForModuleColocatedPrimariesFromPlan(
    plan,
    primaryAddress,
  );
}

function collectPlacementSubnetIdsFromValues(
  values: Record<string, unknown>,
): string[] {
  const ids = new Set<string>();
  const single = values.subnet_id;
  if (typeof single === "string" && single.length > 0) {
    ids.add(single);
  }
  if (Array.isArray(values.subnet_ids)) {
    for (const sid of values.subnet_ids) {
      if (typeof sid === "string" && sid.length > 0) {
        ids.add(sid);
      }
    }
  }
  return [...ids].sort();
}

function inferSubnetIdsForModuleColocatedPrimariesFromPlan(
  plan: {
    resource_changes?: Array<{
      address?: string;
      type?: string;
      mode?: string;
      change?: { after?: unknown; before?: unknown };
    }>;
  },
  anchorAddress: string,
): string[] {
  const modulePrefix = terraformModulePrefixForAddress(
    stripStackPrefixForModuleParsing(anchorAddress),
  );
  if (!modulePrefix) {
    return [];
  }
  const ids = new Set<string>();
  const changes = Array.isArray(plan.resource_changes)
    ? plan.resource_changes
    : [];
  for (const rc of changes) {
    if (rc.mode !== "managed" || !rc.address) {
      continue;
    }
    if (!bareAddressInTerraformModule(modulePrefix, rc.address)) {
      continue;
    }
    if (rc.type === "aws_db_subnet_group") {
      const gv = pickResourceValuesForTopologyPlacement(
        rc as Parameters<typeof pickResourceValuesForTopologyPlacement>[0],
      );
      if (gv) {
        for (const sid of collectPlacementSubnetIdsFromValues(gv)) {
          ids.add(sid);
        }
      }
    }
  }
  return [...ids].sort();
}
