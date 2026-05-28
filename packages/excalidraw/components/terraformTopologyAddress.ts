import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  parseStackAddress,
  preferTopologyNodeKeyAmongAliases,
  topologyBareAddressKey,
  topologyNodeDedupeKey,
} from "./terraformStackAddress";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";

export {
  topologyBareAddressKey,
  topologyNodeDedupeKey,
  preferTopologyNodeKeyAmongAliases,
};

function isTopologyMetaNodeKey(key: string): boolean {
  return key === TERRAFORM_MODULE_TREE_KEY || key.startsWith("__");
}

function collectTopologyNodeAliases(
  nodes: TerraformPlanNodesMap,
  address: string,
): string[] {
  const parsed = parseStackAddress(address);
  const bare = topologyBareAddressKey(address);
  const aliases: string[] = [];

  for (const key of Object.keys(nodes)) {
    if (isTopologyMetaNodeKey(key)) {
      continue;
    }
    const keyParsed = parseStackAddress(key);
    if (parsed) {
      if (
        keyParsed?.stackId === parsed.stackId &&
        topologyBareAddressKey(key) === bare
      ) {
        aliases.push(key);
      } else if (!keyParsed && topologyBareAddressKey(key) === bare) {
        aliases.push(key);
      }
    } else if (!keyParsed && topologyBareAddressKey(key) === bare) {
      aliases.push(key);
    }
  }

  return aliases;
}

/** Prefer an existing `nodes` key (qualified over duplicate unqualified aliases). */
export function canonicalTopologyNodeKey(
  nodes: TerraformPlanNodesMap,
  address: string,
): string {
  const aliases = collectTopologyNodeAliases(nodes, address);
  if (aliases.length > 0) {
    return preferTopologyNodeKeyAmongAliases(aliases);
  }
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;
  const resolved = resolveTerraformPlanNodeKey(
    graphNodes,
    stripIndexesForResolve(address),
  );
  return resolved ?? address;
}

function stripIndexesForResolve(address: string): string {
  return topologyBareAddressKey(address);
}

function rewriteNodeEdgeAliases(
  node: TerraformPlanGraphNode,
  alias: string,
  canonical: string,
): void {
  const rewrite = (list: string[] | undefined) => {
    if (!list) {
      return;
    }
    for (let i = 0; i < list.length; i++) {
      if (list[i] === alias) {
        list[i] = canonical;
      }
    }
  };
  rewrite(node.edges_existing);
  rewrite(node.edges_new);
  if (node.edges_data_flow) {
    for (let i = 0; i < node.edges_data_flow.length; i++) {
      const edge = node.edges_data_flow[i];
      if (typeof edge === "string" && edge === alias) {
        node.edges_data_flow[i] = canonical;
      }
    }
  }
}

function mergeAliasNodeIntoCanonical(
  nodes: TerraformPlanNodesMap,
  alias: string,
  canonical: string,
): void {
  const aliasNode = nodes[alias] as TerraformPlanGraphNode | undefined;
  const canonNode = nodes[canonical] as TerraformPlanGraphNode | undefined;
  if (aliasNode && canonNode && aliasNode.resources) {
    for (const [resAddr, res] of Object.entries(aliasNode.resources)) {
      if (!canonNode.resources[resAddr]) {
        canonNode.resources[resAddr] = res;
      }
    }
  }
  for (const node of Object.values(nodes)) {
    if (node && typeof node === "object") {
      rewriteNodeEdgeAliases(node as TerraformPlanGraphNode, alias, canonical);
    }
  }
  delete nodes[alias];
}

/**
 * Collapse duplicate node keys within the same stack (or unqualified ghosts when
 * only one stack owns that bare address). Never merges across different stackIds.
 */
export function dedupeTerraformPlanNodesByBareAddress(
  nodes: TerraformPlanNodesMap,
): TerraformPlanNodesMap {
  const byDedupeKey = new Map<string, string[]>();
  const unqualifiedKeys: string[] = [];

  for (const key of Object.keys(nodes)) {
    if (isTopologyMetaNodeKey(key)) {
      continue;
    }
    if (!parseStackAddress(key)) {
      unqualifiedKeys.push(key);
      continue;
    }
    const dedupeKey = topologyNodeDedupeKey(key);
    const row = byDedupeKey.get(dedupeKey) ?? [];
    row.push(key);
    byDedupeKey.set(dedupeKey, row);
  }

  for (const [, aliases] of byDedupeKey) {
    if (aliases.length <= 1) {
      continue;
    }
    const canonical = preferTopologyNodeKeyAmongAliases(aliases);
    for (const alias of aliases) {
      if (alias === canonical) {
        continue;
      }
      mergeAliasNodeIntoCanonical(nodes, alias, canonical);
    }
  }

  for (const u of unqualifiedKeys) {
    if (!nodes[u]) {
      continue;
    }
    const bare = topologyBareAddressKey(u);
    const qualifiedOwners = Object.keys(nodes).filter((k) => {
      const p = parseStackAddress(k);
      return p != null && topologyBareAddressKey(k) === bare;
    });
    if (qualifiedOwners.length === 1) {
      mergeAliasNodeIntoCanonical(nodes, u, qualifiedOwners[0]!);
    } else if (qualifiedOwners.length > 1) {
      delete nodes[u];
    }
  }

  return nodes;
}

export function topologyAddressesMatch(a: string, b: string): boolean {
  const pa = parseStackAddress(a);
  const pb = parseStackAddress(b);
  if (pa && pb) {
    return (
      pa.stackId === pb.stackId &&
      topologyBareAddressKey(a) === topologyBareAddressKey(b)
    );
  }
  return topologyBareAddressKey(a) === topologyBareAddressKey(b);
}

export function dedupeTopologyAddressesByBareKey(
  nodes: TerraformPlanNodesMap,
  addresses: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of addresses) {
    const key = topologyNodeDedupeKey(addr);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(canonicalTopologyNodeKey(nodes, addr));
  }
  return out;
}
