/**
 * RCLL (Recursive Compound Layered Layout) — Milestone M2: Layering (Stage 1a).
 *
 * Source of truth: docs/pipeline-rcll-layout-design.md §7.2a (layering), §5
 * (priority lattice T1/T3/T4), §11 (local columns), §22 (stage contract).
 *
 * This is the FIRST real stage registered in `RCLL_STAGES`. It gives every node
 * a **local column** (`CompoundNode.localColumn`, parent-relative) honoring:
 *
 *   T1/CON-1  TFD precedence  — `u→v ⇒ col(u) < col(v)` within a container
 *   T3/CON-6  hull staircase  — a hull→hull edge `A→B ⇒ col(A) < col(B)`
 *   T4/REQ-3  fan-out pinning — a fan-out set's targets share one column
 *
 * **Model-only (M2 decision).** No geometry changes — the picture is still drawn
 * by the compound builder. Layering writes only `localColumn`; M3 turns columns
 * into pixels. The acceptance gate (fan-out-column rate, CON-1/CON-6 violations)
 * is asserted on the MODEL via `layeringMeta`.
 *
 * **Per-container.** For each container `H`, its direct children are columned
 * from `D_H[H]` — the per-container hull-edge DAG M1 already built (it IS the
 * child-level dependency graph: cross-child edges only, keyed by child key). The
 * same routine runs at every level (root→providers, account→regions, …).
 *
 *   tree (M1) ──clone──► layerTree ──per container──► columnsForContainer
 *   lattice.hullEdges ─────────────────────────────────┘   │
 *   lattice.cyclicContainers ───────────────────────────────┤ (cyclic → 0,1,2…)
 *                                                            ▼
 *                                          longestPath + fan-out pin + relax
 *
 * Determinism (CON-8): longest-path is order-independent; ties break on
 * `(minDescendantSequence, key)`; fan-out sets + successor lists iterate in
 * sorted key order; relaxation is a fixpoint. No randomness, no timings.
 */
import { longestPath } from "./terraformPipelineLayoutShared";

import type {
  CompoundNode,
  HullEdge,
  Lattice,
  RcllOptions,
  StageResult,
} from "./terraformPipelineRcllTypes";

/** source childKey → target childKeys, over a container's D_H edges. */
function successorsBySource(
  edges: readonly HullEdge[],
): Map<string, string[]> {
  const succ = new Map<string, string[]>();
  for (const e of edges) {
    const list = succ.get(e.from);
    if (list) {
      list.push(e.to);
    } else {
      succ.set(e.from, [e.to]);
    }
  }
  return succ;
}

/** Forward-reachable set from `start` over the child adjacency (excludes start). */
function forwardReach(
  start: string,
  adj: ReadonlyMap<string, string[]>,
): Set<string> {
  const seen = new Set<string>();
  const stack = [...(adj.get(start) ?? [])];
  while (stack.length > 0) {
    const n = stack.pop()!;
    if (seen.has(n)) {
      continue;
    }
    seen.add(n);
    for (const m of adj.get(n) ?? []) {
      stack.push(m);
    }
  }
  return seen;
}

/**
 * Assign a local column to each direct child of one container (§7.2a).
 *
 * - **Cyclic `H`** (`cyclic === true`): longest-path is undefined on a loop, so
 *   children get sequential columns `0,1,2,…` in model order (M2 decision; the
 *   smarter localized fallback is M3). `childKeysInModelOrder` MUST already be in
 *   `(minDescendantSequence, key)` order (the tree is sorted that way at M1).
 * - **Acyclic `H`:** longest-path over `D_H[H]` → base columns; fan-out pinning
 *   (T4) raises each fan-out set's targets to the set's max column, skipping any
 *   member internally preceded by another (T1 > T4); a forward relaxation then
 *   restores CON-1 for downstream nodes.
 */
export function columnsForContainer(
  childKeysInModelOrder: readonly string[],
  edges: readonly HullEdge[],
  cyclic: boolean,
  rankOf: (key: string) => number,
): Map<string, number> {
  if (cyclic) {
    const col = new Map<string, number>();
    childKeysInModelOrder.forEach((k, i) => col.set(k, i));
    return col;
  }

  const { column } = longestPath(
    childKeysInModelOrder,
    edges.map((e) => ({ from: e.from, to: e.to })),
    rankOf,
  );

  // Fan-out pinning (T4): every fan-out set's targets share the set's max
  // column. Iterate sources in sorted order for determinism.
  const succ = successorsBySource(edges);
  const sources = [...succ.keys()].sort();
  for (const source of sources) {
    const set = succ.get(source)!;
    if (set.length < 2) {
      continue;
    }
    // T1 > T4: a target internally preceded by another target keeps its own
    // (later) column — precedence is senior to fan-out sharing.
    const preceded = new Set<string>();
    for (const m1 of set) {
      const reach = forwardReach(m1, succ);
      for (const m2 of set) {
        if (m2 !== m1 && reach.has(m2)) {
          preceded.add(m2);
        }
      }
    }
    const pinnable = set.filter((m) => !preceded.has(m));
    if (pinnable.length < 2) {
      continue;
    }
    const maxCol = Math.max(...pinnable.map((m) => column.get(m) ?? 0));
    for (const m of pinnable) {
      column.set(m, maxCol);
    }
  }

  // CON-1 restore: forward-relax to a fixpoint so pinning never leaves an edge
  // `from→to` with `col(to) <= col(from)`. Terminates (D_H[H] is acyclic).
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      const cf = column.get(e.from) ?? 0;
      const ct = column.get(e.to) ?? 0;
      if (ct <= cf) {
        column.set(e.to, cf + 1);
        changed = true;
      }
    }
  }

  return column;
}

/** Deep-clone a compound node, dropping `localColumn` (cluster refs shared). */
function cloneNode(node: CompoundNode): CompoundNode {
  return {
    key: node.key,
    role: node.role,
    level: node.level,
    minDescendantSequence: node.minDescendantSequence,
    cluster: node.cluster,
    children: node.children.map(cloneNode),
    box: node.box,
  };
}

/**
 * Layer the whole compound tree: clone it, then write `localColumn` on every
 * node from its parent's `columnsForContainer` result. Pure (§22.1) — the input
 * tree is never mutated. Container layout is independent, so walk order is
 * irrelevant.
 */
export function layerTree(tree: CompoundNode, lattice: Lattice): CompoundNode {
  const cyclic = lattice.cyclicContainers ?? new Set<string>();
  const hullEdges = lattice.hullEdges ?? new Map();
  const root = cloneNode(tree);
  root.localColumn = 0;

  const walk = (node: CompoundNode): void => {
    if (node.children.length > 0) {
      const cols = columnsForContainer(
        node.children.map((c) => c.key),
        hullEdges.get(node.key) ?? [],
        cyclic.has(node.key),
        (key) => rankByKey(node.children, key),
      );
      for (const child of node.children) {
        child.localColumn = cols.get(child.key) ?? 0;
      }
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(root);
  return root;
}

/** Tiebreak rank for a child key = its `minDescendantSequence` (0 if absent). */
function rankByKey(children: readonly CompoundNode[], key: string): number {
  for (const c of children) {
    if (c.key === key) {
      return c.minDescendantSequence;
    }
  }
  return 0;
}

/** Flatten the laid tree into a `key → localColumn` lookup. */
function localColumnByKey(tree: CompoundNode): Map<string, number> {
  const out = new Map<string, number>();
  const walk = (node: CompoundNode): void => {
    out.set(node.key, node.localColumn ?? 0);
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(tree);
  return out;
}

/** Container keys (every non-leaf node key) — for CON-6 (hull→hull) detection. */
function containerKeys(tree: CompoundNode): Set<string> {
  const out = new Set<string>();
  const walk = (node: CompoundNode): void => {
    if (node.children.length > 0) {
      out.add(node.key);
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  walk(tree);
  return out;
}

/**
 * Scalar acceptance metrics for the laid tree (§13 gates, model-level).
 * - `fanoutColumnRate`: of per-container fan-out sets (a source with ≥2 D_H
 *   successors in a non-cyclic container), the fraction whose targets share a
 *   `localColumn`. Rate is 0 on an empty denominator — never a vacuous 1.0.
 * - `con1Violations`: D_H edges (non-cyclic containers) with `col(from) ≥
 *   col(to)` — TFD precedence (T1/CON-1); MUST be 0.
 * - `con6Violations`: the hull→hull subset (both endpoints are containers) —
 *   the staircase (T3/CON-6); MUST be 0.
 */
export function layeringMeta(
  tree: CompoundNode,
  lattice: Lattice,
): Record<string, number> {
  const cyclic = lattice.cyclicContainers ?? new Set<string>();
  const hullEdges = lattice.hullEdges ?? new Map();
  const colByKey = localColumnByKey(tree);
  const containers = containerKeys(tree);

  let fanoutSetCount = 0;
  let fanoutAligned = 0;
  let con1Violations = 0;
  let con6Violations = 0;
  let maxLocalColumn = 0;
  for (const c of colByKey.values()) {
    maxLocalColumn = Math.max(maxLocalColumn, c);
  }

  for (const [containerKey, edges] of hullEdges as ReadonlyMap<
    string,
    readonly HullEdge[]
  >) {
    if (cyclic.has(containerKey)) {
      continue; // cycles excused (§13 acyclic guard)
    }
    for (const e of edges) {
      const cf = colByKey.get(e.from) ?? 0;
      const ct = colByKey.get(e.to) ?? 0;
      if (ct <= cf) {
        con1Violations += 1;
        if (containers.has(e.from) && containers.has(e.to)) {
          con6Violations += 1;
        }
      }
    }
    const succ = successorsBySource(edges);
    for (const targets of succ.values()) {
      if (targets.length < 2) {
        continue;
      }
      fanoutSetCount += 1;
      const cols = targets.map((t) => colByKey.get(t) ?? 0);
      if (cols.every((c) => c === cols[0])) {
        fanoutAligned += 1;
      }
    }
  }

  return {
    fanoutSetCount,
    fanoutColumnRate: fanoutSetCount === 0 ? 0 : fanoutAligned / fanoutSetCount,
    con1Violations,
    con6Violations,
    maxLocalColumn,
    cyclicContainerCount: cyclic.size,
  };
}

/**
 * Stage 1a (§22). Lays out columns on the tree and reports the model gate
 * metrics. Pure transform: returns a new tree, never mutates the input.
 */
export function layeringStage(
  tree: CompoundNode,
  lattice: Lattice,
  _opts: RcllOptions,
): StageResult {
  const laid = layerTree(tree, lattice);
  return { tree: laid, meta: layeringMeta(laid, lattice) };
}
