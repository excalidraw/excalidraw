/**
 * RCLL toggle safety guards — the single source of truth for the cross-toggle
 * coupling policy, shared by the import dialog (UI gating) and `terraformLayoutCore`
 * (the URL/programmatic backstop) so the two can never drift apart.
 *
 * Pure + UI-free (so `terraformLayoutCore` can import it without violating the
 * dependency-cruiser rule that core must not import UI).
 *
 * The footguns this addresses (RFC §9.6 / DEC-13 + the campaign measurements):
 *   - `rankSeparate` ALONE makes the diagram WORSE (taller, ~+28% width, ~+45%
 *     crossings). Its −42% height win exists only composed with `swimlaneLaneRise`
 *     (the M4 lane-rise reclaims the Y once separation makes the lanes X-disjoint).
 *     ⇒ rankSeparate is only honored when swimlaneLaneRise is on. The dialog greys
 *     out its "On"; this guard is the backstop for the URL/programmatic path.
 *   - `deDensify` is inert unless its width dial `deDensifyMaxCols` is > 0. The UI
 *     exposes only the boolean; this guard supplies a sensible default dial so the
 *     toggle actually does something when enabled.
 */

/** The dial `deDensify` gets when the UI enables it without an explicit value. */
export const DEDENSIFY_DEFAULT_MAX_COLS = 2;

/** Reason codes for a suppressed/adjusted toggle (surfaced in scene meta). */
export type RcllToggleSuppression =
  | "rankSeparate-needs-rise"
  | "column-packing-conflict-compact-wins"
  | "ordering-conflict-crossing-min-wins";

/**
 * Whether `rankSeparate` may be enabled. True only when the M4 swimlane lane-rise
 * is also on — the composition that turns separation's rightward push into a net
 * height win instead of a taller, wider diagram.
 */
export function rankSeparateAvailable(swimlaneLaneRise: boolean): boolean {
  return swimlaneLaneRise === true;
}

/** The subset of pipeline options this guard reads/rewrites. */
export type GuardablePipelineOptions = {
  swimlaneLaneRise?: boolean;
  rankSeparate?: boolean;
  deDensify?: boolean;
  deDensifyMaxCols?: number;
  /** M5c column compaction (pull-left). Mutually exclusive with `deDensify` (pull-right). */
  columnCompact?: boolean;
  /** M6 leaf-only within-column reorder. Subsumed by `crossingMin` when both set. */
  reorder?: boolean;
  /** M6c container-aware crossing minimization (hierarchical superset of `reorder`). */
  crossingMin?: boolean;
};

/**
 * Sanitize RCLL pipeline options against the coupling policy. Pure — returns a new
 * object (never mutates the input) plus the list of suppressions applied, so a
 * caller can surface them in scene meta. When no guard fires the returned options
 * are field-for-field equal to the input (OFF byte-identical).
 */
export function applyRcllToggleGuards<T extends GuardablePipelineOptions>(
  opts: T,
): {
  options: T & GuardablePipelineOptions;
  suppressions: RcllToggleSuppression[];
} {
  const suppressions: RcllToggleSuppression[] = [];
  // Intersection type so the conditional `deDensifyMaxCols` / `rankSeparate`
  // rewrites below are not excess properties on a narrowly-inferred T.
  let next: T & GuardablePipelineOptions = opts;

  // rankSeparate requires the lane-rise to be a win, not a regression.
  if (
    next.rankSeparate === true &&
    !rankSeparateAvailable(next.swimlaneLaneRise === true)
  ) {
    next = { ...next, rankSeparate: false };
    suppressions.push("rankSeparate-needs-rise");
  }

  // "Column packing" is a tri-state, so the UI/URL can never set both arms. Defensively,
  // if a direct engine caller sets both, Compact (the narrower, measure-verified op) wins
  // and Spread is dropped — surfaced observably (never a silent boolean conflict).
  if (next.deDensify === true && next.columnCompact === true) {
    next = { ...next, deDensify: false };
    suppressions.push("column-packing-conflict-compact-wins");
  }

  // `crossingMin` is the hierarchical superset of the leaf-only `reorder` (M6): it
  // permutes lanes/sub-hulls AND within-column leaves, gated on the rendered count. If a
  // caller sets both, crossingMin wins and the redundant leaf reorder is dropped (so the
  // two ordering passes never compose) — surfaced observably (RFC §7.2c / DEC-6).
  if (next.crossingMin === true && next.reorder === true) {
    next = { ...next, reorder: false };
    suppressions.push("ordering-conflict-crossing-min-wins");
  }

  // deDensify is a no-op without a positive width dial — supply a default.
  if (next.deDensify === true && !((next.deDensifyMaxCols ?? 0) > 0)) {
    next = { ...next, deDensifyMaxCols: DEDENSIFY_DEFAULT_MAX_COLS };
  }

  return { options: next, suppressions };
}
