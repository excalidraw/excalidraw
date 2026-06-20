/**
 * RCLL "Layout" profiles — the single source of truth that expands one outcome-first
 * choice (`Readable | Balanced | Compact`) into the seven low-level RCLL pipeline flags.
 *
 * Why this exists: the RCLL passes (lane-rise, lane-split, subnet de-band, cycle-rise,
 * ordering, straighten, column-packing) all trade the same three things — height vs width
 * vs readability — and most are measured no-ops on dense presets. Exposing seven equal
 * toggles tells the user nothing about what to pick. A profile bundles them into a coherent
 * result and is the *primary* control; the individual flags become an advanced override.
 *
 * Pure + UI-free (so `terraformLayoutCore` can import it without the dependency-cruiser
 * "core must not import UI" violation, exactly like `terraformPipelineToggleGuards`).
 *
 * Contract: `balanced` reproduces today's default flag set EXACTLY, so selecting it (or
 * importing with no profile) is byte-identical to the pre-profile behavior. The expansion
 * is the same shape the dialog fans out into and the engine derives from — one map, four
 * call sites (dialog, URL param, TS option, dev endpoint).
 */

export type RcllLayoutProfile = "readable" | "balanced" | "compact";

/** The seven RCLL layout flags a profile resolves to. Column packing is the existing
 * tri-state; the rest are booleans. This is the exact set the dialog owns as `pipeline*`
 * state and the engine consumes via `LayoutSceneContext`. */
export type RcllLayoutProfileFlags = {
  swimlaneLaneRise: boolean;
  rankSeparate: boolean;
  subnetDeBand: boolean;
  staircaseBandOverlap: boolean;
  reorder: boolean;
  straighten: boolean;
  columnPacking: "spread" | "none" | "compact";
};

export const RCLL_LAYOUT_PROFILES: readonly RcllLayoutProfile[] = [
  "readable",
  "balanced",
  "compact",
] as const;

export const DEFAULT_RCLL_LAYOUT_PROFILE: RcllLayoutProfile = "balanced";

export function isRcllLayoutProfile(value: unknown): value is RcllLayoutProfile {
  return (
    value === "readable" || value === "balanced" || value === "compact"
  );
}

/**
 * Expand a profile into its flag bundle.
 *
 * - `balanced` — today's defaults: every pass off except the cycle-rise (`staircaseBandOverlap`)
 *   which ships on. The safe identity; selecting it changes nothing.
 * - `readable` — tallest, clearest: cycles STACK (own row each), ordering + straighten on to
 *   cut crossings and align spines. No width-shrinking passes.
 * - `compact` — shortest + narrowest: lane-rise + lane-split (the −42% height composition),
 *   subnet de-band (≈ −28% height), cycle-rise, column compaction (pull-left), plus ordering
 *   + straighten for legibility under the denser packing.
 *
 * NOTE: the per-preset *magnitude* of each profile is validated by measurement
 * (curl the dev `/api/terraform-layout?profile=…`); a profile may be a measured no-op on a
 * given preset, which the dev payload's `suppressions[]` reports honestly.
 */
export function resolveRcllLayoutProfile(
  profile: RcllLayoutProfile,
): RcllLayoutProfileFlags {
  switch (profile) {
    case "readable":
      return {
        swimlaneLaneRise: false,
        rankSeparate: false,
        subnetDeBand: false,
        staircaseBandOverlap: false,
        reorder: true,
        straighten: true,
        columnPacking: "none",
      };
    case "compact":
      return {
        swimlaneLaneRise: true,
        rankSeparate: true,
        subnetDeBand: true,
        staircaseBandOverlap: true,
        reorder: true,
        straighten: true,
        columnPacking: "compact",
      };
    case "balanced":
    default:
      return {
        swimlaneLaneRise: false,
        rankSeparate: false,
        subnetDeBand: false,
        staircaseBandOverlap: true,
        reorder: false,
        straighten: false,
        columnPacking: "none",
      };
  }
}
