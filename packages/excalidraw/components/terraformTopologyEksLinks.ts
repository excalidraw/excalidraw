/**
 * EKS cluster companion satellite: node groups, Fargate profiles, addons.
 */

import { mergeTerraformPlanResourceValues } from "./terraformTopologyIamLinks";
import { getTerraformCardResourceType } from "./terraformResourceCardLabel";

import type { TopologyIamEdge } from "./terraformTopologyIamLinks";
import type {
  TerraformPlanGraphNode,
  TerraformPlanNodesMap,
} from "./terraformPlanParsing";

function getPrimaryResource(
  node: TerraformPlanGraphNode | undefined,
): Record<string, unknown> | undefined {
  const first = Object.values(node?.resources || {})[0];
  return first && typeof first === "object"
    ? (first as Record<string, unknown>)
    : undefined;
}

export type EksCompanionCluster = {
  cluster: string;
  stack: string[];
};

const EKS_COMPANION_TYPES = new Set([
  "aws_eks_node_group",
  "aws_eks_fargate_profile",
  "aws_eks_addon",
]);

function typeOrder(t: string): number {
  if (t === "aws_eks_node_group") return 0;
  if (t === "aws_eks_fargate_profile") return 1;
  if (t === "aws_eks_addon") return 2;
  return 3;
}

function companionResourceType(
  nodes: TerraformPlanNodesMap,
  addr: string,
): string {
  const n = nodes[addr] as TerraformPlanGraphNode | undefined;
  return getTerraformCardResourceType(
    addr,
    getPrimaryResource(n) as Record<string, unknown> | null,
  );
}

export function buildEksCompanionCluster(
  nodes: TerraformPlanNodesMap,
  clusterAddress: string,
  _arnIndex: Map<string, string>,
): { cluster: EksCompanionCluster | null; edges: TopologyIamEdge[] } {
  const node = nodes[clusterAddress] as TerraformPlanGraphNode | undefined;
  const primary = getPrimaryResource(node);
  if (!primary || primary.type !== "aws_eks_cluster") {
    return { cluster: null, edges: [] };
  }
  const values = mergeTerraformPlanResourceValues(primary);
  const clusterName =
    typeof values.name === "string"
      ? values.name
      : typeof values.id === "string"
      ? values.id
      : null;
  if (!clusterName) {
    return { cluster: null, edges: [] };
  }

  const stack: string[] = [];
  for (const path of Object.keys(nodes)) {
    if (path.startsWith("__")) {
      continue;
    }
    const n = nodes[path] as TerraformPlanGraphNode | undefined;
    const p = getPrimaryResource(n);
    if (!p) {
      continue;
    }
    const t = typeof p.type === "string" ? p.type : "";
    if (!EKS_COMPANION_TYPES.has(t)) {
      continue;
    }
    const v = mergeTerraformPlanResourceValues(p);
    if (v.cluster_name !== clusterName) {
      continue;
    }
    stack.push(path);
  }

  if (stack.length === 0) {
    return { cluster: null, edges: [] };
  }

  stack.sort((a, b) => {
    const ta = companionResourceType(nodes, a);
    const tb = companionResourceType(nodes, b);
    const order = typeOrder(ta) - typeOrder(tb);
    return order !== 0 ? order : a.localeCompare(b);
  });

  const edges: TopologyIamEdge[] = stack.map((sat) => ({
    source: clusterAddress,
    target: sat,
    type: "eks_companion",
    label: "cluster member",
  }));

  return { cluster: { cluster: clusterAddress, stack }, edges };
}

export function eksCompanionSatelliteStackHeightPx(
  nodes: TerraformPlanNodesMap,
  clusterAddress: string,
  arnIndex: Map<string, string>,
  tier1H: number,
  tier2H: number,
  satelliteGap: number,
): number {
  const { cluster } = buildEksCompanionCluster(nodes, clusterAddress, arnIndex);
  if (!cluster || cluster.stack.length === 0) {
    return 0;
  }
  let h = satelliteGap;
  for (const satAddr of cluster.stack) {
    const t = companionResourceType(nodes, satAddr);
    h += (t === "aws_eks_addon" ? tier2H : tier1H) + satelliteGap;
  }
  return h;
}
