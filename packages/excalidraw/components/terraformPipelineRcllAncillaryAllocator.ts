import { countAncillaryCards } from "./terraformPipelineLayoutAncillary";
import {
  layoutAncillaryStrip,
  measureAncillaryStrip,
  PIPELINE_CLUSTER_GAP_Y,
  PIPELINE_FRAME_PAD,
} from "./terraformPipelineLayoutShared";
import { placementMeta } from "./terraformPipelineRcllPlacement";

import type { AncillaryStrip } from "./terraformPipelineLayoutShared";
import type { CompoundNode, Lattice } from "./terraformPipelineRcllTypes";

export type RcllAncillaryAllocation = {
  scopeKey: string;
  baselineWrapWidth: number;
  wrapWidth: number;
  allocatedWidthPx: number;
  rowSavings: number;
  cardCount: number;
};

/**
 * Why a tall ancillary band did (or did not) widen into existing slack — a
 * read-only diagnostic (DI-ANC-6). A boolean would lie (Codex), so this is a
 * multi-cause enum:
 * - `no-breakpoint` — no wider wrap removes any row (single tall column / cards
 *   too wide); widening cannot help.
 * - `gap-exists-current-algo-missed` — a SHORTER widened candidate validates at
 *   a width beyond what `recursiveRightSlackCeiling` permits today. The ceiling
 *   measures right-neighbour overlap against the band at its TALL pre-widen
 *   height; widening shortens the band, the host bottom rises, and a neighbour
 *   that only sat beside the band (not the dataflow) no longer overlaps — a
 *   genuinely collision-safe, movement-free gap the current greedy never tries.
 *   This is the fixable bug PR2 targets.
 * - `all-candidates-fail-validation` — even the gentlest widening overlaps a
 *   neighbour that spans the dataflow height too; genuinely boxed in.
 * - `root-capped` — the gentlest widening already exceeds the Dataflow-only
 *   root width (the hard cap; never grow root).
 * - `ancestor-capped` — widening shifts/overlaps a primary (dataflow) cluster
 *   (an ancestor would have to give way); forbidden by the no-movement rule.
 * - `shared-slack-consumed` — a within-ceiling validating widening exists but
 *   the greedy spent that shared slack on another scope.
 * - `served-best-achievable` — the band already widened to its best achievable
 *   (movement-free) width; nothing is missed.
 */
export type AncillaryBandBlockStatus =
  | "no-breakpoint"
  | "gap-exists-current-algo-missed"
  | "all-candidates-fail-validation"
  | "root-capped"
  | "ancestor-capped"
  | "shared-slack-consumed"
  | "served-best-achievable";

export type RcllAncillaryBandDiagnostic = {
  scopeKey: string;
  cardCount: number;
  bandBlockStatus: AncillaryBandBlockStatus;
  /** `normalChildrenBBox(host).height` on the pre-ancillary baseline. */
  hostBaselineContentHeight: number;
  /** Band height at the baseline (un-widened) wrap — the tall measurement. */
  baselineBandHeight: number;
  baselineWrapWidth: number;
  /** Wrap width `recursiveRightSlackCeiling` permits today (tall-band ceiling). */
  currentCeilingWrapWidth: number;
  /** Upper bound from the fixed root width (validator enforces precisely). */
  rootLimitWrapWidth: number;
  candidateCount: number;
  evaluatedCount: number;
  /** True when the candidate list was capped for the bounded eval. */
  capped: boolean;
  /** Largest validating candidate width (band materialised in isolation). */
  bestValidWrapWidth: number | null;
  bestValidBandHeight: number | null;
  /** Largest validating candidate that fits within the current tall-band ceiling. */
  bestValidWrapWidthWithinCeiling: number | null;
  /** Wrap width the live allocator actually granted this scope, if any. */
  acceptedWrapWidth: number | null;
  /** The band's box in the final (live) allocation. */
  finalBand: { x: number; y: number; width: number; height: number } | null;
};

export type RcllAncillaryAllocatorMeta = {
  widenedHullCount: number;
  allocatedWidthPx: number;
  rowSavings: number;
  fallbackDropCount: number;
  allocationCount: number;
  allocations?: {
    scopeKey: string;
    wrapWidth: number;
    allocatedWidthPx: number;
    rowSavings: number;
    cardCount: number;
  }[];
  /** DI-ANC-6 read-only diagnostic; does not affect allocation. */
  diagnostics?: RcllAncillaryBandDiagnostic[];
};

export const EMPTY_RCLL_ANCILLARY_ALLOCATOR_META: RcllAncillaryAllocatorMeta = {
  widenedHullCount: 0,
  allocatedWidthPx: 0,
  rowSavings: 0,
  fallbackDropCount: 0,
  allocationCount: 0,
};

export function cloneAllocatorMeta(
  meta: RcllAncillaryAllocatorMeta,
): RcllAncillaryAllocatorMeta {
  return {
    ...meta,
    ...(meta.allocations
      ? { allocations: meta.allocations.map((a) => ({ ...a })) }
      : {}),
    ...(meta.diagnostics
      ? {
          diagnostics: meta.diagnostics.map((d) => ({
            ...d,
            finalBand: d.finalBand ? { ...d.finalBand } : null,
          })),
        }
      : {}),
  };
}

function allocatorMetaFromAllocations(
  allocations: readonly RcllAncillaryAllocation[],
  fallbackDropCount: number,
): RcllAncillaryAllocatorMeta {
  const allocated = allocations.filter((a) => a.allocatedWidthPx > 0);
  return {
    widenedHullCount: new Set(allocated.map((a) => a.scopeKey)).size,
    allocatedWidthPx: Math.round(
      allocated.reduce((total, a) => total + a.allocatedWidthPx, 0),
    ),
    rowSavings: Math.round(
      allocated.reduce((total, a) => total + a.rowSavings, 0),
    ),
    fallbackDropCount,
    allocationCount: allocated.length,
    ...(allocated.length > 0
      ? {
          allocations: allocated
            .map((a) => ({
              scopeKey: a.scopeKey,
              wrapWidth: Math.round(a.wrapWidth),
              allocatedWidthPx: Math.round(a.allocatedWidthPx),
              rowSavings: Math.round(a.rowSavings),
              cardCount: a.cardCount,
            }))
            .sort((a, b) => a.scopeKey.localeCompare(b.scopeKey)),
        }
      : {}),
  };
}

function findPathByKey(
  node: CompoundNode,
  key: string,
  path: CompoundNode[] = [],
): CompoundNode[] | null {
  const nextPath = [...path, node];
  if (node.key === key) {
    return nextPath;
  }
  for (const child of node.children) {
    const found = findPathByKey(child, key, nextPath);
    if (found) {
      return found;
    }
  }
  return null;
}

function cloneTreeForAncillary(node: CompoundNode): CompoundNode {
  return {
    key: node.key,
    role: node.role,
    level: node.level,
    minDescendantSequence: node.minDescendantSequence,
    cluster: node.cluster,
    ancillaryStrip: node.ancillaryStrip,
    ancillaryWrapWidth: node.ancillaryWrapWidth,
    localColumn: node.localColumn,
    box: node.box ? { ...node.box } : undefined,
    children: node.children.map(cloneTreeForAncillary),
  };
}

function translateSubtreeY(node: CompoundNode, dy: number): void {
  if (node.box) {
    node.box = { ...node.box, y: node.box.y + dy };
  }
  for (const child of node.children) {
    translateSubtreeY(child, dy);
  }
}

function xOverlaps(
  a: NonNullable<CompoundNode["box"]>,
  b: NonNullable<CompoundNode["box"]>,
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width;
}

function yOverlaps(
  a: NonNullable<CompoundNode["box"]>,
  b: NonNullable<CompoundNode["box"]>,
): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

function childrenBBox(
  node: CompoundNode,
): NonNullable<CompoundNode["box"]> | null {
  return childrenBBoxWhere(node, () => true);
}

function normalChildrenBBox(
  node: CompoundNode,
): NonNullable<CompoundNode["box"]> | null {
  return childrenBBoxWhere(node, (child) => child.role !== "ancillaryBand");
}

function childrenBBoxWhere(
  node: CompoundNode,
  include: (child: CompoundNode) => boolean,
): NonNullable<CompoundNode["box"]> | null {
  const boxes = node.children
    .filter(include)
    .map((child) => child.box)
    .filter((box): box is NonNullable<CompoundNode["box"]> => !!box);
  if (boxes.length === 0) {
    return null;
  }
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function expandNodeToChildren(node: CompoundNode): void {
  if (!node.box) {
    return;
  }
  const bb = childrenBBox(node);
  if (!bb) {
    return;
  }
  const right = Math.max(
    node.box.x + node.box.width,
    bb.x + bb.width + PIPELINE_FRAME_PAD,
  );
  const bottom = Math.max(
    node.box.y + node.box.height,
    bb.y + bb.height + PIPELINE_FRAME_PAD,
  );
  node.box = {
    ...node.box,
    width: right - node.box.x,
    height: bottom - node.box.y,
  };
}

function boxBottom(box: NonNullable<CompoundNode["box"]>): number {
  return box.y + box.height;
}

function propagateInsertedBandGrowth(
  path: readonly CompoundNode[],
  insertedHostOldBottom: number,
): void {
  let grownChild = path[path.length - 1];
  let grownChildOldBottom = insertedHostOldBottom;

  for (let i = path.length - 2; i >= 0; i -= 1) {
    const parent = path[i];
    if (!parent.box || !grownChild.box) {
      return;
    }

    const parentOldBottom = boxBottom(parent.box);
    const growth = boxBottom(grownChild.box) - grownChildOldBottom;
    if (growth > 0) {
      for (const sibling of parent.children) {
        if (
          sibling !== grownChild &&
          sibling.box &&
          sibling.box.y >= grownChildOldBottom - 0.5 &&
          xOverlaps(sibling.box, grownChild.box)
        ) {
          translateSubtreeY(sibling, growth);
        }
      }
      expandNodeToChildren(parent);
    }

    grownChild = parent;
    grownChildOldBottom = parentOldBottom;
  }
}

function injectAncillaryBandsIntoPlacedTree(
  placedTree: CompoundNode,
  strips: readonly AncillaryStrip[],
  wrapWidthByScopeKey: ReadonlyMap<string, number> = new Map(),
): {
  tree: CompoundNode;
  applied: boolean;
  stripCount: number;
  cardCount: number;
} {
  const root = cloneTreeForAncillary(placedTree);
  let stripCount = 0;
  let cardCount = 0;
  for (const strip of strips) {
    const path = findPathByKey(root, strip.scopeKey);
    if (!path) {
      continue;
    }
    const host = path[path.length - 1];
    const bb = host ? normalChildrenBBox(host) : null;
    if (!host || !host.box || !bb) {
      continue;
    }
    const hostOldBottom = boxBottom(host.box);
    const contentWidth = Math.max(0, bb.width);
    const wrapWidth = Math.max(
      contentWidth,
      wrapWidthByScopeKey.get(strip.scopeKey) ?? contentWidth,
    );
    const laid = layoutAncillaryStrip(strip, wrapWidth);
    const bandY = bb.y + bb.height + PIPELINE_CLUSTER_GAP_Y;
    const bandWidth = Math.max(laid.width, wrapWidth);
    host.children.push({
      key: `__ancillaryBand__:${strip.scopeKey}`,
      role: "ancillaryBand",
      level: host.level + 1,
      minDescendantSequence: Number.MAX_SAFE_INTEGER,
      ancillaryStrip: strip,
      ancillaryWrapWidth: wrapWidth,
      box: {
        x: bb.x,
        y: bandY,
        width: bandWidth,
        height: laid.height,
      },
      children: [],
    });
    host.children.sort(
      (a, b) =>
        a.minDescendantSequence - b.minDescendantSequence ||
        a.key.localeCompare(b.key),
    );
    expandNodeToChildren(host);
    propagateInsertedBandGrowth(path, hostOldBottom);
    stripCount += 1;
    cardCount += strip.cards.length;
  }
  return { tree: root, applied: stripCount > 0, stripCount, cardCount };
}

function primaryGeometryByKey(
  tree: CompoundNode,
): Map<string, NonNullable<CompoundNode["box"]>> {
  const out = new Map<string, NonNullable<CompoundNode["box"]>>();
  const visit = (node: CompoundNode): void => {
    if (node.role === "primaryCluster" && node.cluster && node.box) {
      out.set(node.cluster.id, { ...node.box });
    }
    for (const child of node.children) {
      visit(child);
    }
  };
  visit(tree);
  return out;
}

// Why a candidate tree is (in)valid against the baseline. `"ok"` ⇔ the tree
// passes `validateAncillaryTreeAgainstBaseline`; the other values name the
// FIRST binding violation, in the same order the validator checks them, so the
// DI-ANC-6 diagnostic can report a cause without a second set of rules.
type AncillaryCandidateFailure = "ok" | "root" | "primary" | "overlap";

function classifyAncillaryCandidate(
  candidate: CompoundNode,
  baseline: CompoundNode,
  lattice: Lattice,
): AncillaryCandidateFailure {
  if (!candidate.box || !baseline.box) {
    return "overlap";
  }
  if (candidate.box.width > baseline.box.width + 0.5) {
    return "root";
  }
  const basePrimary = primaryGeometryByKey(baseline);
  const nextPrimary = primaryGeometryByKey(candidate);
  if (basePrimary.size !== nextPrimary.size) {
    return "primary";
  }
  for (const [key, before] of basePrimary) {
    const after = nextPrimary.get(key);
    if (!after) {
      return "primary";
    }
    if (
      Math.abs(after.x - before.x) > 0.5 ||
      Math.abs(after.width - before.width) > 0.5 ||
      Math.abs(after.height - before.height) > 0.5 ||
      after.y + 0.5 < before.y
    ) {
      return "primary";
    }
  }
  const meta = placementMeta(candidate, lattice) as Record<string, unknown>;
  return meta.containmentViolations === 0 && meta.siblingOverlapViolations === 0
    ? "ok"
    : "overlap";
}

function validateAncillaryTreeAgainstBaseline(
  candidate: CompoundNode,
  baseline: CompoundNode,
  lattice: Lattice,
): boolean {
  return classifyAncillaryCandidate(candidate, baseline, lattice) === "ok";
}

function findNodeByKey(node: CompoundNode, key: string): CompoundNode | null {
  if (node.key === key) {
    return node;
  }
  for (const child of node.children) {
    const found = findNodeByKey(child, key);
    if (found) {
      return found;
    }
  }
  return null;
}

function collectAncillaryHostPaths(
  tree: CompoundNode,
  strips: readonly AncillaryStrip[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const strip of strips) {
    const path = findPathByKey(tree, strip.scopeKey);
    if (path) {
      out.set(
        strip.scopeKey,
        path.map((node) => node.key),
      );
    }
  }
  return out;
}

function pathByKeys(
  tree: CompoundNode,
  keys: readonly string[],
): CompoundNode[] | null {
  const path: CompoundNode[] = [];
  let current: CompoundNode | undefined = tree;
  for (const key of keys) {
    if (!current || current.key !== key) {
      return null;
    }
    path.push(current);
    if (key !== keys[keys.length - 1]) {
      current = current.children.find(
        (child) => child.key === keys[path.length],
      );
    }
  }
  return path.length === keys.length ? path : null;
}

function recursiveRightSlackCeiling(
  tree: CompoundNode,
  pathKeys: readonly string[],
  baselineRootRight: number,
): number {
  const path = pathByKeys(tree, pathKeys);
  if (!path || path.length === 0 || !path[0].box) {
    return 0;
  }
  let maxRight = baselineRootRight;
  for (let i = 1; i < path.length; i += 1) {
    const parent = path[i - 1];
    const node = path[i];
    if (!parent.box || !node.box) {
      return 0;
    }
    let childMaxRight = maxRight - PIPELINE_FRAME_PAD;
    for (const sibling of parent.children) {
      if (
        sibling !== node &&
        sibling.box &&
        sibling.box.x >= node.box.x + node.box.width - 0.5 &&
        yOverlaps(sibling.box, node.box)
      ) {
        childMaxRight = Math.min(
          childMaxRight,
          sibling.box.x - PIPELINE_FRAME_PAD,
        );
      }
    }
    maxRight = Math.max(node.box.x + node.box.width, childMaxRight);
  }
  return maxRight;
}

function stripRowReductionBreakpoints(
  strip: AncillaryStrip,
  baselineWrapWidth: number,
  ceilingWrapWidth: number,
): { wrapWidth: number; rowSavings: number }[] {
  const pad = PIPELINE_FRAME_PAD;
  const gap = PIPELINE_CLUSTER_GAP_Y;
  const baselineHeight = measureAncillaryStrip(strip, baselineWrapWidth).height;
  const breakpoints = new Set<number>();
  for (let start = 0; start < strip.cards.length; start += 1) {
    let rowWidth = 2 * pad;
    for (let end = start; end < strip.cards.length; end += 1) {
      rowWidth += strip.cards[end]!.build.width;
      if (end > start) {
        rowWidth += gap;
      }
      if (
        rowWidth > baselineWrapWidth + 0.5 &&
        rowWidth <= ceilingWrapWidth + 0.5
      ) {
        breakpoints.add(Math.ceil(rowWidth));
      }
    }
  }
  return [...breakpoints]
    .sort((a, b) => a - b)
    .map((wrapWidth) => ({
      wrapWidth,
      rowSavings:
        baselineHeight - measureAncillaryStrip(strip, wrapWidth).height,
    }))
    .filter((candidate) => candidate.rowSavings > 0.5);
}

function wrapWidthMapFromAllocations(
  allocations: readonly RcllAncillaryAllocation[],
): Map<string, number> {
  return new Map(allocations.map((a) => [a.scopeKey, a.wrapWidth]));
}

export function allocateRcllAncillarySlackForTesting(
  baselineTree: CompoundNode,
  strips: readonly AncillaryStrip[],
  lattice: Lattice,
): {
  allocations: RcllAncillaryAllocation[];
  meta: RcllAncillaryAllocatorMeta;
} {
  if (!baselineTree.box || strips.length === 0) {
    return {
      allocations: [],
      meta: cloneAllocatorMeta(EMPTY_RCLL_ANCILLARY_ALLOCATOR_META),
    };
  }
  const hostPaths = collectAncillaryHostPaths(baselineTree, strips);
  const baselineRootRight = baselineTree.box.x + baselineTree.box.width;
  let accepted: RcllAncillaryAllocation[] = [];
  let simulated = injectAncillaryBandsIntoPlacedTree(baselineTree, strips).tree;

  for (;;) {
    const currentWraps = wrapWidthMapFromAllocations(accepted);
    let best:
      | (RcllAncillaryAllocation & {
          benefit: number;
        })
      | null = null;

    for (const strip of strips) {
      const pathKeys = hostPaths.get(strip.scopeKey);
      if (!pathKeys) {
        continue;
      }
      const path = pathByKeys(simulated, pathKeys);
      const host = path?.[path.length - 1];
      const bb = host ? normalChildrenBBox(host) : null;
      if (!host?.box || !bb) {
        continue;
      }
      const baselineWrapWidth = Math.max(0, bb.width);
      const currentWrapWidth =
        currentWraps.get(strip.scopeKey) ?? baselineWrapWidth;
      const ceilingRight = recursiveRightSlackCeiling(
        simulated,
        pathKeys,
        baselineRootRight,
      );
      const ceilingWrapWidth = Math.max(currentWrapWidth, ceilingRight - bb.x);
      for (const candidate of stripRowReductionBreakpoints(
        strip,
        currentWrapWidth,
        ceilingWrapWidth,
      )) {
        const next: RcllAncillaryAllocation & { benefit: number } = {
          scopeKey: strip.scopeKey,
          baselineWrapWidth,
          wrapWidth: candidate.wrapWidth,
          allocatedWidthPx: candidate.wrapWidth - baselineWrapWidth,
          rowSavings: candidate.rowSavings,
          cardCount: strip.cards.length,
          benefit: candidate.rowSavings,
        };
        if (
          !best ||
          next.benefit > best.benefit + 0.5 ||
          (Math.abs(next.benefit - best.benefit) <= 0.5 &&
            (next.cardCount > best.cardCount ||
              (next.cardCount === best.cardCount &&
                next.scopeKey.localeCompare(best.scopeKey) < 0)))
        ) {
          best = next;
        }
      }
    }

    if (!best) {
      break;
    }
    accepted = [
      ...accepted.filter((a) => a.scopeKey !== best.scopeKey),
      {
        scopeKey: best.scopeKey,
        baselineWrapWidth: best.baselineWrapWidth,
        wrapWidth: best.wrapWidth,
        allocatedWidthPx: best.allocatedWidthPx,
        rowSavings: best.rowSavings,
        cardCount: best.cardCount,
      },
    ].sort((a, b) => a.scopeKey.localeCompare(b.scopeKey));
    simulated = injectAncillaryBandsIntoPlacedTree(
      baselineTree,
      strips,
      wrapWidthMapFromAllocations(accepted),
    ).tree;
    if (
      !validateAncillaryTreeAgainstBaseline(simulated, baselineTree, lattice)
    ) {
      accepted = accepted.filter((a) => a.scopeKey !== best.scopeKey);
      break;
    }
  }

  return {
    allocations: accepted,
    meta: allocatorMetaFromAllocations(accepted, 0),
  };
}

// Bounded candidate evaluation per scope: skip-zero scopes cost nothing, and the
// rare deep band (the VPC) is capped. We keep the smallest (the binding
// constraint) plus the widest `CAP-1` (the best achievable gap) so both the
// "gentlest failure cause" and the "largest valid width" stay exact under the cap.
const DIAGNOSTIC_CANDIDATE_CAP = 24;

/**
 * DI-ANC-6 read-only diagnostic. For every ancillary scope it materialises each
 * row-reduction breakpoint as a CANDIDATE FINAL RECTANGLE — clone the baseline,
 * widen ONLY that band (which shortens it, so the host bottom is recomputed) —
 * and runs the EXISTING validator on it. The result proves whether a
 * movement-free wider placement exists that the live ceiling missed, rather than
 * letting the old ceiling self-confirm (the "false no-op" Codex flagged).
 *
 * Pure: clones throughout; never mutates `baselineTree`, `strips`, or any tree
 * the caller keeps. Does NOT influence allocation.
 */
export function diagnoseRcllAncillaryBands(
  baselineTree: CompoundNode,
  strips: readonly AncillaryStrip[],
  lattice: Lattice,
  acceptedAllocations: readonly RcllAncillaryAllocation[],
  finalTree: CompoundNode,
): RcllAncillaryBandDiagnostic[] {
  if (!baselineTree.box || strips.length === 0) {
    return [];
  }
  const hostPaths = collectAncillaryHostPaths(baselineTree, strips);
  const baselineRootRight = baselineTree.box.x + baselineTree.box.width;
  // bands at their TALL baseline height — the geometry the live ceiling sees.
  const baselineInjected = injectAncillaryBandsIntoPlacedTree(
    baselineTree,
    strips,
  ).tree;
  const acceptedByScope = new Map(
    acceptedAllocations.map((a) => [a.scopeKey, a.wrapWidth] as const),
  );

  const diagnostics: RcllAncillaryBandDiagnostic[] = [];
  for (const strip of strips) {
    const pathKeys = hostPaths.get(strip.scopeKey);
    if (!pathKeys) {
      continue;
    }
    const basePath = pathByKeys(baselineTree, pathKeys);
    const baseHost = basePath?.[basePath.length - 1];
    const baseBB = baseHost ? normalChildrenBBox(baseHost) : null;
    if (!baseHost?.box || !baseBB) {
      continue;
    }
    const baselineWrapWidth = Math.max(0, baseBB.width);
    const hostBaselineContentHeight = baseBB.height;
    const baselineBandHeight = measureAncillaryStrip(
      strip,
      baselineWrapWidth,
    ).height;

    const ceilingRight = recursiveRightSlackCeiling(
      baselineInjected,
      pathKeys,
      baselineRootRight,
    );
    const currentCeilingWrapWidth = Math.max(
      baselineWrapWidth,
      ceilingRight - baseBB.x,
    );
    const rootLimitWrapWidth = Math.max(
      baselineWrapWidth,
      baselineRootRight - baseBB.x,
    );

    const candidates = stripRowReductionBreakpoints(
      strip,
      baselineWrapWidth,
      rootLimitWrapWidth,
    );
    let capped = false;
    let evalList = candidates;
    if (candidates.length > DIAGNOSTIC_CANDIDATE_CAP) {
      capped = true;
      evalList = [
        candidates[0]!,
        ...candidates.slice(candidates.length - (DIAGNOSTIC_CANDIDATE_CAP - 1)),
      ];
    }

    let bestValidWrapWidth: number | null = null;
    let bestValidBandHeight: number | null = null;
    let bestValidWrapWidthWithinCeiling: number | null = null;
    // evalList is sorted ascending; the first entry is the gentlest widening.
    let gentlestReason: AncillaryCandidateFailure | null = null;
    for (const candidate of evalList) {
      const materialized = injectAncillaryBandsIntoPlacedTree(
        baselineTree,
        strips,
        new Map([[strip.scopeKey, candidate.wrapWidth]]),
      ).tree;
      const reason = classifyAncillaryCandidate(
        materialized,
        baselineTree,
        lattice,
      );
      if (gentlestReason === null) {
        gentlestReason = reason;
      }
      if (reason === "ok") {
        if (
          bestValidWrapWidth === null ||
          candidate.wrapWidth > bestValidWrapWidth
        ) {
          bestValidWrapWidth = candidate.wrapWidth;
          bestValidBandHeight = measureAncillaryStrip(
            strip,
            candidate.wrapWidth,
          ).height;
        }
        if (
          candidate.wrapWidth <= currentCeilingWrapWidth + 0.5 &&
          (bestValidWrapWidthWithinCeiling === null ||
            candidate.wrapWidth > bestValidWrapWidthWithinCeiling)
        ) {
          bestValidWrapWidthWithinCeiling = candidate.wrapWidth;
        }
      }
    }

    const acceptedWrapWidth = acceptedByScope.get(strip.scopeKey) ?? null;
    let bandBlockStatus: AncillaryBandBlockStatus;
    if (candidates.length === 0) {
      bandBlockStatus = "no-breakpoint";
    } else if (
      bestValidWrapWidth !== null &&
      bestValidWrapWidth > currentCeilingWrapWidth + 0.5
    ) {
      bandBlockStatus = "gap-exists-current-algo-missed";
    } else if (bestValidWrapWidth === null) {
      bandBlockStatus =
        gentlestReason === "root"
          ? "root-capped"
          : gentlestReason === "primary"
          ? "ancestor-capped"
          : "all-candidates-fail-validation";
    } else if (
      acceptedWrapWidth !== null &&
      acceptedWrapWidth >= bestValidWrapWidth - 0.5
    ) {
      bandBlockStatus = "served-best-achievable";
    } else {
      bandBlockStatus = "shared-slack-consumed";
    }

    const finalBandNode = findNodeByKey(
      finalTree,
      `__ancillaryBand__:${strip.scopeKey}`,
    );
    const finalBand = finalBandNode?.box ? { ...finalBandNode.box } : null;

    diagnostics.push({
      scopeKey: strip.scopeKey,
      cardCount: strip.cards.length,
      bandBlockStatus,
      hostBaselineContentHeight: Math.round(hostBaselineContentHeight),
      baselineBandHeight: Math.round(baselineBandHeight),
      baselineWrapWidth: Math.round(baselineWrapWidth),
      currentCeilingWrapWidth: Math.round(currentCeilingWrapWidth),
      rootLimitWrapWidth: Math.round(rootLimitWrapWidth),
      candidateCount: candidates.length,
      evaluatedCount: evalList.length,
      capped,
      bestValidWrapWidth:
        bestValidWrapWidth === null ? null : Math.round(bestValidWrapWidth),
      bestValidBandHeight:
        bestValidBandHeight === null ? null : Math.round(bestValidBandHeight),
      bestValidWrapWidthWithinCeiling:
        bestValidWrapWidthWithinCeiling === null
          ? null
          : Math.round(bestValidWrapWidthWithinCeiling),
      acceptedWrapWidth:
        acceptedWrapWidth === null ? null : Math.round(acceptedWrapWidth),
      finalBand: finalBand
        ? {
            x: Math.round(finalBand.x),
            y: Math.round(finalBand.y),
            width: Math.round(finalBand.width),
            height: Math.round(finalBand.height),
          }
        : null,
    });
  }

  return diagnostics.sort((a, b) => a.scopeKey.localeCompare(b.scopeKey));
}

export function buildValidatedAncillaryInsertion(
  baselineTree: CompoundNode,
  strips: readonly AncillaryStrip[],
  lattice: Lattice,
): {
  tree: CompoundNode;
  applied: boolean;
  stripCount: number;
  cardCount: number;
  allocatorMeta: RcllAncillaryAllocatorMeta;
} {
  const planned = allocateRcllAncillarySlackForTesting(
    baselineTree,
    strips,
    lattice,
  );
  let allocations = [...planned.allocations];
  let fallbackDropCount = 0;
  for (;;) {
    const injected = injectAncillaryBandsIntoPlacedTree(
      baselineTree,
      strips,
      wrapWidthMapFromAllocations(allocations),
    );
    if (
      validateAncillaryTreeAgainstBaseline(injected.tree, baselineTree, lattice)
    ) {
      const allocatorMeta = allocatorMetaFromAllocations(
        allocations,
        fallbackDropCount,
      );
      allocatorMeta.diagnostics = diagnoseRcllAncillaryBands(
        baselineTree,
        strips,
        lattice,
        allocations,
        injected.tree,
      );
      return {
        ...injected,
        cardCount:
          injected.cardCount > 0
            ? injected.cardCount
            : countAncillaryCards(strips),
        allocatorMeta,
      };
    }
    if (allocations.length === 0) {
      const baseline = injectAncillaryBandsIntoPlacedTree(baselineTree, strips);
      const allocatorMeta = allocatorMetaFromAllocations([], fallbackDropCount);
      allocatorMeta.diagnostics = diagnoseRcllAncillaryBands(
        baselineTree,
        strips,
        lattice,
        [],
        baseline.tree,
      );
      return {
        ...baseline,
        allocatorMeta,
      };
    }
    allocations = allocations
      .sort(
        (a, b) =>
          a.rowSavings - b.rowSavings || a.scopeKey.localeCompare(b.scopeKey),
      )
      .slice(1);
    fallbackDropCount += 1;
  }
}
