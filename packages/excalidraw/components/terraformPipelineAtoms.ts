/**
 * TFD pipeline layout: resolve bound addresses to primaryCluster atoms and collapse edges.
 */

import { resolveAlbCompanionParentLbAddressFromPlan } from "./terraformTopologyAlbLinks";
import { resolveApiGatewayCompanionParentRestApiAddressFromPlan } from "./terraformTopologyApiGatewayLinks";
import { collectTopologySatelliteAddressesFromRegistry } from "./terraformTopologySatelliteRegistry";
import "./terraformTopologySatelliteRegistry";
import {
  isTopologyPlacementResourceType,
  isPrimaryVisibleResourceType,
} from "./terraformPrimaryVisibility";
import { buildArnIndexForTopology } from "./terraformTopologyIamLinks";
import { getTopologyResourceType } from "./terraformTopologySatelliteResolve";
import {
  DECLARED_DATAFLOW_ORDERED_KEY,
  parseDeclaredDataFlowText,
  resolveDeclaredDataFlowEndpoint,
  type DeclaredDataFlowEdge,
} from "./terraformDeclaredDataFlow";
import { pickResourceValuesForTopologyPlacement } from "./terraformTopologyExtract";

import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export type PipelineAtomMeta = {
  primaryAddress: string;
  resourceType: string;
  /** All TFD-resolved addresses that collapse into this atom. */
  memberAddresses: string[];
};

export type PipelineAtomEdge = {
  source: string;
  target: string;
  sequence: number;
  /** When set, reduces column advance for this edge (e.g. same-column hops). */
  columnBackoff?: number;
};

export type PipelineAtomGraph = {
  atoms: Map<string, PipelineAtomMeta>;
  edges: PipelineAtomEdge[];
  /** Plan addresses included in the pipeline closure. */
  closureAddresses: Set<string>;
};

function getPlanChanges(plan?: unknown): Array<{
  address?: string;
  type?: string;
  mode?: string;
}> {
  const rc = (plan as { resource_changes?: unknown[] } | undefined)
    ?.resource_changes;
  if (!Array.isArray(rc)) {
    return [];
  }
  return rc as Array<{ address?: string; type?: string; mode?: string }>;
}

function isAwsManagedAddress(
  nodes: TerraformPlanNodesMap,
  address: string,
): boolean {
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  if (!node) {
    return false;
  }
  const t = getTopologyResourceType(address, node);
  return Boolean(t && t.startsWith("aws_"));
}

/** Build satellite address → owning primary for candidate primaries. */
function buildSatelliteOwnerMap(
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  primaries: readonly string[],
  plan?: unknown,
): Map<string, string> {
  const owner = new Map<string, string>();
  for (const primary of primaries) {
    for (const sat of collectTopologySatelliteAddressesFromRegistry(
      nodes,
      arnIndex,
      [primary],
      plan,
    )) {
      if (!owner.has(sat)) {
        owner.set(sat, primary);
      }
    }
  }
  return owner;
}

function resolveSpecialCompanionPrimary(
  address: string,
  plan?: unknown,
  nodes?: TerraformPlanNodesMap,
): string | null {
  const changes = getPlanChanges(plan);
  const rc = changes.find((c) => c.address === address);
  if (!rc) {
    return null;
  }
  const parentLb = resolveAlbCompanionParentLbAddressFromPlan(
    rc as Parameters<typeof resolveAlbCompanionParentLbAddressFromPlan>[0],
    changes as Parameters<typeof resolveAlbCompanionParentLbAddressFromPlan>[1],
  );
  if (parentLb) {
    return parentLb;
  }
  const parentApi = resolveApiGatewayCompanionParentRestApiAddressFromPlan(
    rc as Parameters<
      typeof resolveApiGatewayCompanionParentRestApiAddressFromPlan
    >[0],
    changes as Parameters<
      typeof resolveApiGatewayCompanionParentRestApiAddressFromPlan
    >[1],
    nodes,
  );
  return parentApi ?? null;
}

/** Resolve a plan address to its layout atom (primaryCluster owner). */
export function resolvePipelineAtomPrimary(
  address: string,
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  satelliteOwner: Map<string, string>,
  plan?: unknown,
): string {
  const fromRegistry = satelliteOwner.get(address);
  if (fromRegistry) {
    return fromRegistry;
  }
  const special = resolveSpecialCompanionPrimary(address, plan, nodes);
  if (special) {
    return special;
  }
  const node = nodes[address] as TerraformPlanGraphNode | undefined;
  const t = getTopologyResourceType(address, node);
  if (t && isTopologyPlacementResourceType(t)) {
    return address;
  }
  if (t && isPrimaryVisibleResourceType(t)) {
    return address;
  }
  return address;
}

function collectBindClosureAddresses(
  binds: Map<string, string>,
  nodes: TerraformPlanNodesMap,
): Set<string> {
  const out = new Set<string>();
  for (const address of binds.values()) {
    const resolved = resolveDeclaredDataFlowEndpoint(nodes, address, binds);
    if (resolved) {
      out.add(resolved);
    }
  }
  return out;
}

function expandClosureWithSatellites(
  seed: Set<string>,
  nodes: TerraformPlanNodesMap,
  arnIndex: Map<string, string>,
  plan?: unknown,
): Set<string> {
  const primaries = [...seed].filter((addr) => {
    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const t = getTopologyResourceType(addr, node);
    return Boolean(t && !t.startsWith("data."));
  });
  const ownerMap = buildSatelliteOwnerMap(nodes, arnIndex, primaries, plan);
  const out = new Set(seed);
  for (const sat of ownerMap.keys()) {
    if (seed.has(sat) || [...seed].some((p) => ownerMap.get(sat) === p)) {
      out.add(sat);
    }
  }
  for (const addr of seed) {
    for (const sat of collectTopologySatelliteAddressesFromRegistry(
      nodes,
      arnIndex,
      [addr],
      plan,
    )) {
      out.add(sat);
    }
  }
  return out;
}

function collapseAtomEdges(
  edges: readonly DeclaredDataFlowEdge[],
  resolveAtom: (address: string) => string,
): PipelineAtomEdge[] {
  const out: PipelineAtomEdge[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    const source = resolveAtom(e.source);
    const target = resolveAtom(e.target);
    if (source === target) {
      continue;
    }
    const key = `${source}|||${target}|||${e.sequence}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({ source, target, sequence: e.sequence });
  }
  return out.sort(
    (a, b) => a.sequence - b.sequence || a.source.localeCompare(b.source),
  );
}

function dedupeAtomEdges(
  edges: readonly PipelineAtomEdge[],
): PipelineAtomEdge[] {
  const out: PipelineAtomEdge[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.source === e.target) {
      continue;
    }
    const k = `${e.source}|||${e.target}`;
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(e);
  }
  return out.map((e, i) => ({ ...e, sequence: i }));
}

/** @deprecated Use {@link dedupeAtomEdges}; linear merge only applies at resource level before atom collapse. */
export function coalesceLinearAtomEdges(
  edges: readonly PipelineAtomEdge[],
): PipelineAtomEdge[] {
  return dedupeAtomEdges(edges);
}

export function buildPipelineAtomGraph(
  nodes: TerraformPlanNodesMap,
  plan?: unknown,
  tfdTexts?: readonly string[],
): PipelineAtomGraph | null {
  const declared = nodes[DECLARED_DATAFLOW_ORDERED_KEY];
  if (!declared || declared.length === 0) {
    return null;
  }

  const binds = new Map<string, string>();
  for (const text of tfdTexts ?? []) {
    const parsed = parseDeclaredDataFlowText(text);
    for (const [k, v] of parsed.binds) {
      binds.set(k, v);
    }
  }

  const bindClosure = collectBindClosureAddresses(binds, nodes);
  if (bindClosure.size === 0) {
    return null;
  }

  const arnIndex = buildArnIndexForTopology(nodes);
  let closureAddresses = expandClosureWithSatellites(
    bindClosure,
    nodes,
    arnIndex,
    plan,
  );

  const primariesInClosure = [...closureAddresses].filter((addr) => {
    const node = nodes[addr] as TerraformPlanGraphNode | undefined;
    const t = getTopologyResourceType(addr, node);
    return Boolean(t && isAwsManagedAddress(nodes, addr));
  });

  const satelliteOwner = buildSatelliteOwnerMap(
    nodes,
    arnIndex,
    primariesInClosure,
    plan,
  );

  const resolveAtom = (address: string) =>
    resolvePipelineAtomPrimary(address, nodes, arnIndex, satelliteOwner, plan);

  const atomAddresses = new Set<string>();
  const memberByAtom = new Map<string, Set<string>>();

  const addMember = (address: string) => {
    const atom = resolveAtom(address);
    atomAddresses.add(atom);
    if (!memberByAtom.has(atom)) {
      memberByAtom.set(atom, new Set());
    }
    memberByAtom.get(atom)!.add(address);
  };

  for (const addr of closureAddresses) {
    addMember(addr);
  }
  for (const e of declared) {
    addMember(e.source);
    addMember(e.target);
  }

  const collapsedEdges = collapseAtomEdges(declared, resolveAtom);
  const edges = dedupeAtomEdges(collapsedEdges);

  const atoms = new Map<string, PipelineAtomMeta>();
  for (const primaryAddress of atomAddresses) {
    const node = nodes[primaryAddress] as TerraformPlanGraphNode | undefined;
    const resourceType = getTopologyResourceType(primaryAddress, node);
    atoms.set(primaryAddress, {
      primaryAddress,
      resourceType,
      memberAddresses: [
        ...(memberByAtom.get(primaryAddress) ?? [primaryAddress]),
      ].sort(),
    });
  }

  closureAddresses = new Set([...closureAddresses, ...atomAddresses]);

  return { atoms, edges, closureAddresses };
}

export function pipelineAtomResourceValues(
  plan: unknown,
  address: string,
): Record<string, unknown> | null {
  const changes = getPlanChanges(plan);
  const rc = changes.find((c) => c.address === address);
  if (!rc) {
    return null;
  }
  return pickResourceValuesForTopologyPlacement(
    rc as Parameters<typeof pickResourceValuesForTopologyPlacement>[0],
  );
}
