import { resolveTerraformPlanNodeKey } from "./terraformPlanParsing";

import type { TerraformPlanGraphNode } from "./terraformPlanParsing";

export const DECLARED_DATAFLOW_ORDERED_KEY = "__declaredDataFlowOrdered";

export const TFD_HOP_ADDRESS = "@hop";
export const TFD_DUMMY_ADDRESS = "@dummy";

export type TfdVersion = 1 | 2 | 3;

export type DeclaredDataFlowEdge = {
  source: string;
  target: string;
  sequence: number;
  origin: "tfd";
};

export type ParsedDeclaredDataFlowEdgeSpec = {
  source: string;
  target: string;
  columnBackoff?: number;
};

export type ParsedDeclaredDataFlow = {
  version: TfdVersion;
  binds: Map<string, string>;
  edgeSpecs: ParsedDeclaredDataFlowEdgeSpec[];
  hopAliases: Set<string>;
};

export type ApplyDeclaredDataFlowResult = {
  edges: DeclaredDataFlowEdge[];
  errors: string[];
  warnings: string[];
  tfdVersion: TfdVersion;
};

export function isTfdHopSentinel(address: string): boolean {
  return address === TFD_HOP_ADDRESS || address === TFD_DUMMY_ADDRESS;
}

/** True for hop sentinels and auto-generated `__tfd_hop_*` aliases. */
export function isTfdHopAddress(address: string): boolean {
  return isTfdHopSentinel(address) || /^__tfd_hop_\d+$/.test(address);
}

export function isTfdHopAlias(
  ref: string,
  hopAliases: ReadonlySet<string>,
  binds: ReadonlyMap<string, string>,
): boolean {
  if (hopAliases.has(ref)) {
    return true;
  }
  const bound = binds.get(ref);
  return bound != null && isTfdHopSentinel(bound);
}

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
  if (isTfdHopSentinel(address)) {
    return null;
  }
  if (!address.includes(".")) {
    return null;
  }
  return resolveTerraformPlanNodeKey(nodes, address);
}

function parseTfdVersionHeader(line: string): TfdVersion | null {
  const match = line.match(/^tfd\s+(\d+)\s*$/i);
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  if (n === 3) {
    return 3;
  }
  if (n === 2) {
    return 2;
  }
  if (n === 1) {
    return 1;
  }
  return null;
}

function splitEdgeTargets(rhs: string): string[] {
  return rhs
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function pushEdgeSpecs(
  edgeSpecs: ParsedDeclaredDataFlowEdgeSpec[],
  binds: Map<string, string>,
  hopAliases: Set<string>,
  source: string,
  targets: readonly string[],
  useDummyHop: boolean,
  hopSeq: { value: number },
): void {
  for (const target of targets) {
    if (useDummyHop) {
      const hopAlias = `__tfd_hop_${hopSeq.value}`;
      hopSeq.value += 1;
      binds.set(hopAlias, TFD_HOP_ADDRESS);
      hopAliases.add(hopAlias);
      edgeSpecs.push({ source, target: hopAlias });
      edgeSpecs.push({ source: hopAlias, target });
    } else {
      edgeSpecs.push({ source, target });
    }
  }
}

/** Parse `.tfd` text; preserves edge line order. */
export function parseDeclaredDataFlowText(
  text: string,
): ParsedDeclaredDataFlow {
  const binds = new Map<string, string>();
  const edgeSpecs: ParsedDeclaredDataFlowEdgeSpec[] = [];
  const hopAliases = new Set<string>();
  let version: TfdVersion = 1;
  let sawVersionHeader = false;
  const hopSeq = { value: 0 };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    if (!sawVersionHeader) {
      const headerVersion = parseTfdVersionHeader(line);
      if (headerVersion != null) {
        version = headerVersion;
        sawVersionHeader = true;
        continue;
      }
    }

    const bindMatch = line.match(/^bind\s+([A-Za-z_][\w]*)\s*=?\s+(.+)$/i);
    if (bindMatch) {
      const alias = bindMatch[1]!;
      const address = bindMatch[2]!.trim();
      binds.set(alias, address);
      if (isTfdHopSentinel(address)) {
        hopAliases.add(alias);
      }
      continue;
    }

    const longArrowMatch = line.match(/^([^\s#]+)\s*-->\s*(.+)$/);
    if (longArrowMatch) {
      const source = longArrowMatch[1]!;
      const targets = splitEdgeTargets(longArrowMatch[2]!);
      pushEdgeSpecs(
        edgeSpecs,
        binds,
        hopAliases,
        source,
        targets,
        true,
        hopSeq,
      );
      continue;
    }

    const edgeMatch = line.match(/^([^\s#]+)\s*->\s*(.+)$/);
    if (edgeMatch) {
      const source = edgeMatch[1]!;
      const targets = splitEdgeTargets(edgeMatch[2]!);
      pushEdgeSpecs(
        edgeSpecs,
        binds,
        hopAliases,
        source,
        targets,
        false,
        hopSeq,
      );
    }
  }

  return { version, binds, edgeSpecs, hopAliases };
}

export function applyDeclaredDataFlowFromMany(
  nodes: Record<string, TerraformPlanGraphNode> & {
    [DECLARED_DATAFLOW_ORDERED_KEY]?: DeclaredDataFlowEdge[];
  },
  texts: string[],
  labels?: (string | undefined)[],
): ApplyDeclaredDataFlowResult {
  const binds = new Map<string, string>();
  const hopAliases = new Set<string>();
  const errors: string[] = [];
  const warnings: string[] = [];
  const edges: DeclaredDataFlowEdge[] = [];
  let sequence = 0;
  let tfdVersion: TfdVersion = 1;
  const seenVersions = new Set<TfdVersion>();

  for (let fileIndex = 0; fileIndex < texts.length; fileIndex++) {
    const text = texts[fileIndex];
    if (!text?.trim()) {
      continue;
    }
    const label = labels?.[fileIndex]?.trim() || `tfd ${fileIndex + 1}`;
    const parsed = parseDeclaredDataFlowText(text);
    seenVersions.add(parsed.version);
    tfdVersion = Math.max(tfdVersion, parsed.version) as TfdVersion;

    for (const [alias, address] of parsed.binds) {
      if (binds.has(alias) && binds.get(alias) !== address) {
        warnings.push(
          `bind "${alias}" in "${label}" overwrote earlier definition.`,
        );
      }
      binds.set(alias, address);
    }
    for (const alias of parsed.hopAliases) {
      hopAliases.add(alias);
    }

    for (const [alias, address] of parsed.binds) {
      if (isTfdHopSentinel(address)) {
        continue;
      }
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

    for (const spec of parsed.edgeSpecs) {
      if (
        isTfdHopAlias(spec.source, hopAliases, binds) ||
        isTfdHopAlias(spec.target, hopAliases, binds)
      ) {
        continue;
      }
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
  }

  if (seenVersions.size > 1) {
    warnings.push(
      "Mixed TFD v1 and v2 files in one import; using v2 pipeline depth semantics.",
    );
  }

  if (edges.length > 0) {
    nodes[DECLARED_DATAFLOW_ORDERED_KEY] = edges;
  } else {
    delete nodes[DECLARED_DATAFLOW_ORDERED_KEY];
  }

  if (import.meta.env.DEV && (errors.length > 0 || warnings.length > 0)) {
    // eslint-disable-next-line no-console -- dev-only link resolution warnings
    console.warn("[terraform:declared-dataflow]", { errors, warnings });
  }

  return { edges, errors, warnings, tfdVersion };
}

export function applyDeclaredDataFlow(
  nodes: Record<string, TerraformPlanGraphNode> & {
    [DECLARED_DATAFLOW_ORDERED_KEY]?: DeclaredDataFlowEdge[];
  },
  text: string,
): ApplyDeclaredDataFlowResult {
  return applyDeclaredDataFlowFromMany(nodes, [text]);
}
