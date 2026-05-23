import { resolveTerraformPlanNodeKey } from "./terraformPlanParsing";

import type { TerraformPlanGraphNode } from "./terraformPlanParsing";

export const DECLARED_DATAFLOW_ORDERED_KEY = "__declaredDataFlowOrdered";

export type DeclaredDataFlowEdge = {
  source: string;
  target: string;
  sequence: number;
  origin: "tfd";
};

export type ParsedDeclaredDataFlow = {
  binds: Map<string, string>;
  edgeSpecs: Array<{ source: string; target: string }>;
};

export type ApplyDeclaredDataFlowResult = {
  edges: DeclaredDataFlowEdge[];
  errors: string[];
};

/** Resolve alias (via binds) or full Terraform address to a plan graph node path. */
export function resolveDeclaredDataFlowEndpoint(
  nodes: Record<string, TerraformPlanGraphNode>,
  ref: string,
  binds: Map<string, string>,
): string | null {
  const trimmed = ref.trim();
  if (!trimmed) {
    return null;
  }
  const address = (binds.get(trimmed) ?? trimmed).trim();
  if (!address.includes(".")) {
    return null;
  }
  return resolveTerraformPlanNodeKey(nodes, address);
}

/** Parse arrow-only `.tfd` text; preserves edge line order. */
export function parseDeclaredDataFlowText(
  text: string,
): ParsedDeclaredDataFlow {
  const binds = new Map<string, string>();
  const edgeSpecs: Array<{ source: string; target: string }> = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const bindMatch = line.match(/^bind\s+([A-Za-z_][\w]*)\s*=?\s+(.+)$/i);
    if (bindMatch) {
      binds.set(bindMatch[1], bindMatch[2].trim());
      continue;
    }

    const edgeMatch = line.match(/^([^\s#]+)\s*->\s*([^\s#]+)$/);
    if (edgeMatch) {
      edgeSpecs.push({ source: edgeMatch[1], target: edgeMatch[2] });
    }
  }

  return { binds, edgeSpecs };
}

export function applyDeclaredDataFlow(
  nodes: Record<string, TerraformPlanGraphNode> & {
    [DECLARED_DATAFLOW_ORDERED_KEY]?: DeclaredDataFlowEdge[];
  },
  text: string,
): ApplyDeclaredDataFlowResult {
  const { binds, edgeSpecs } = parseDeclaredDataFlowText(text);
  const errors: string[] = [];
  const edges: DeclaredDataFlowEdge[] = [];

  for (const [alias, address] of binds) {
    if (!address.includes(".")) {
      errors.push(
        `bind ${alias}: must be a full Terraform address (got "${address}")`,
      );
      continue;
    }
    if (!resolveTerraformPlanNodeKey(nodes, address)) {
      errors.push(`bind ${alias}: address not in plan: ${address}`);
    }
  }

  let sequence = 0;
  for (const spec of edgeSpecs) {
    const source = resolveDeclaredDataFlowEndpoint(nodes, spec.source, binds);
    const target = resolveDeclaredDataFlowEndpoint(nodes, spec.target, binds);
    if (!source) {
      errors.push(`Unresolved source: ${spec.source}`);
      continue;
    }
    if (!target) {
      errors.push(`Unresolved target: ${spec.target}`);
      continue;
    }
    if (!nodes[source] || !nodes[target] || source === target) {
      errors.push(`Invalid edge: ${spec.source} -> ${spec.target}`);
      continue;
    }
    edges.push({ source, target, sequence, origin: "tfd" });
    sequence += 1;
  }

  if (edges.length > 0) {
    nodes[DECLARED_DATAFLOW_ORDERED_KEY] = edges;
  } else {
    delete nodes[DECLARED_DATAFLOW_ORDERED_KEY];
  }

  if (import.meta.env.DEV && errors.length > 0) {
    // eslint-disable-next-line no-console -- dev-only link resolution warnings
    console.warn("[terraform:declared-dataflow]", errors);
  }

  return { edges, errors };
}
