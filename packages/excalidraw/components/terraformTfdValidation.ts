import type { DeclaredDataFlowEdge } from "./terraformDeclaredDataFlow";

/**
 * DFS-based cycle detection on resolved TFD edges.
 * Returns one error string per cycle found, naming the full cycle path.
 * Runs on the raw declared graph (before pipeline satellite collapse) so
 * author-introduced cycles are caught at parse time, not just at layout time.
 */
export function detectTfdGraphCycles(edges: DeclaredDataFlowEdge[]): string[] {
  const adj = new Map<string, string[]>();
  for (const { source, target } of edges) {
    const list = adj.get(source);
    if (list) {
      list.push(target);
    } else {
      adj.set(source, [target]);
    }
  }

  const nodes = new Set<string>();
  for (const { source, target } of edges) {
    nodes.add(source);
    nodes.add(target);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, 0 | 1 | 2>();
  const path: string[] = [];
  const errors: string[] = [];
  const reportedCycleRoots = new Set<string>();

  function dfs(node: string): void {
    color.set(node, GRAY);
    path.push(node);
    for (const neighbor of adj.get(node) ?? []) {
      const c = color.get(neighbor) ?? WHITE;
      if (c === GRAY) {
        // Back-edge found — reconstruct cycle from neighbor onward
        const cycleStart = path.indexOf(neighbor);
        const cycleNodes = path.slice(cycleStart);
        const cycleRoot = cycleNodes[0]!;
        if (!reportedCycleRoots.has(cycleRoot)) {
          reportedCycleRoots.add(cycleRoot);
          errors.push(
            `Cycle in declared dataflow: ${[...cycleNodes, cycleRoot].join(" → ")}`,
          );
        }
      } else if (c === WHITE) {
        dfs(neighbor);
      }
    }
    path.pop();
    color.set(node, BLACK);
  }

  for (const node of nodes) {
    if ((color.get(node) ?? WHITE) === WHITE) {
      dfs(node);
    }
  }

  return errors;
}

/**
 * Detects bind aliases that are declared but never appear as a source or
 * target in any edge spec. Uses raw alias names (not resolved addresses)
 * so the message is actionable for TFD authors.
 *
 * @param binds      All bind aliases from the parsed TFD (alias → address).
 * @param hopAliases Hop aliases to skip (they are intentionally invisible).
 * @param edgeAliases Set of all alias names that appear in edge source/target positions.
 */
export function detectOrphanedBinds(
  binds: ReadonlyMap<string, string>,
  hopAliases: ReadonlySet<string>,
  edgeAliases: ReadonlySet<string>,
): string[] {
  const warnings: string[] = [];
  for (const alias of binds.keys()) {
    if (hopAliases.has(alias)) {
      continue;
    }
    if (!edgeAliases.has(alias)) {
      warnings.push(`bind "${alias}" is declared but not used in any edge`);
    }
  }
  return warnings;
}

/**
 * Detects (source, target) pairs that appear more than once in the resolved
 * edge list. Duplicate edges inflate indegree counts in the depth algorithm
 * and silently indicate authoring mistakes (e.g. multiple binds resolving
 * to the same plan node).
 */
export function detectDuplicateEdges(edges: DeclaredDataFlowEdge[]): string[] {
  const counts = new Map<string, number>();
  for (const { source, target } of edges) {
    const key = `${source}\0${target}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const warnings: string[] = [];
  for (const [key, count] of counts) {
    if (count > 1) {
      const [source, target] = key.split("\0") as [string, string];
      warnings.push(
        `Duplicate edge: ${source} → ${target} (declared ${count} times)`,
      );
    }
  }
  return warnings;
}
