import { TERRAFORM_MODULE_TREE_KEY } from "./terraformPlanMeta";
import {
  preferTopologyNodeKeyAmongAliases,
  topologyBareAddressKey,
} from "./terraformStackAddress";
import {
  resolveTerraformPlanNodeKey,
  type TerraformPlanGraphNode,
  type TerraformPlanNodesMap,
} from "./terraformPlanParsing";
import { debugTopologyLog } from "./terraformTopologyDebugLog";

export { topologyBareAddressKey, preferTopologyNodeKeyAmongAliases };

function isTopologyMetaNodeKey(key: string): boolean {
  return key === TERRAFORM_MODULE_TREE_KEY || key.startsWith("__");
}

/** Prefer an existing `nodes` key (qualified over duplicate unqualified aliases). */
export function canonicalTopologyNodeKey(
  nodes: TerraformPlanNodesMap,
  address: string,
): string {
  const bare = topologyBareAddressKey(address);
  const aliases: string[] = [];
  for (const key of Object.keys(nodes)) {
    if (isTopologyMetaNodeKey(key)) {
      continue;
    }
    if (topologyBareAddressKey(key) === bare) {
      aliases.push(key);
    }
  }
  if (aliases.length > 0) {
    return preferTopologyNodeKeyAmongAliases(aliases);
  }
  const graphNodes = nodes as Record<string, TerraformPlanGraphNode>;
  const resolved = resolveTerraformPlanNodeKey(
    graphNodes,
    topologyBareAddressKey(address),
  );
  return resolved ?? address;
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

/**
 * Drop unqualified ghost nodes when a stack-qualified alias exists for the same
 * Terraform resource (multi-stack plan + unqualified tfstate merge).
 */
export function dedupeTerraformPlanNodesByBareAddress(
  nodes: TerraformPlanNodesMap,
): TerraformPlanNodesMap {
  const byBare = new Map<string, string[]>();
  for (const key of Object.keys(nodes)) {
    if (isTopologyMetaNodeKey(key)) {
      continue;
    }
    const bare = topologyBareAddressKey(key);
    const row = byBare.get(bare) ?? [];
    row.push(key);
    byBare.set(bare, row);
  }

  let collapsedGroupCount = 0;
  for (const [, aliases] of byBare) {
    if (aliases.length <= 1) {
      continue;
    }
    collapsedGroupCount++;
    const canonical = preferTopologyNodeKeyAmongAliases(aliases);
    const dropped = aliases.filter((a) => a !== canonical);
    for (const alias of dropped) {
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
          rewriteNodeEdgeAliases(
            node as TerraformPlanGraphNode,
            alias,
            canonical,
          );
        }
      }
      delete nodes[alias];
    }
  }

  if (collapsedGroupCount > 0) {
    // #region agent log
    debugTopologyLog(
      "terraformTopologyAddress.ts:dedupeTerraformPlanNodesByBareAddress",
      "collapsed duplicate node key groups",
      { collapsedGroupCount },
      "F",
    );
    // #endregion
  }

  return nodes;
}

export function topologyAddressesMatch(a: string, b: string): boolean {
  return topologyBareAddressKey(a) === topologyBareAddressKey(b);
}

export function dedupeTopologyAddressesByBareKey(
  nodes: TerraformPlanNodesMap,
  addresses: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const addr of addresses) {
    const bare = topologyBareAddressKey(addr);
    if (seen.has(bare)) {
      continue;
    }
    seen.add(bare);
    out.push(canonicalTopologyNodeKey(nodes, addr));
  }
  return out;
}
