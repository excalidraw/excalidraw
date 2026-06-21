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

/**
 * De-band **depth** — the hierarchy level whose containers are dissolved (along with
 * every deeper level) so all of that subtree's resources share ONE column stack.
 * `none` (default) = today's boxed layout, byte-identical. The ladder runs from the
 * deepest container outward: `subnet → vpc → region → account → provider`. De-banding
 * a level cascades downward (vpc also de-bands subnets; provider de-bands everything).
 * Generalizes the original subnet-only `subnetDeBand` boolean (kept as an alias).
 */
export type DeBandLevel =
  | "none"
  | "subnet"
  | "vpc"
  | "region"
  | "account"
  | "provider";

export const DEBAND_LEVELS: readonly DeBandLevel[] = [
  "none",
  "subnet",
  "vpc",
  "region",
  "account",
  "provider",
] as const;

export function isDeBandLevel(value: unknown): value is DeBandLevel {
  return (
    value === "none" ||
    value === "subnet" ||
    value === "vpc" ||
    value === "region" ||
    value === "account" ||
    value === "provider"
  );
}

/**
 * Container depth ladder (provider shallowest = 1 … subnet deepest = 5; `none` = 0).
 * A de-band at level L dissolves every container whose depth ≥ depth(L) — so comparing
 * ranks is the single predicate shared by the collapse, the frame suppression, the path
 * truncation, and the membership annotation.
 */
const DEBAND_LEVEL_RANK: Record<DeBandLevel, number> = {
  none: 0,
  provider: 1,
  account: 2,
  region: 3,
  vpc: 4,
  subnet: 5,
};

export function deBandLevelRank(level: DeBandLevel): number {
  return DEBAND_LEVEL_RANK[level];
}

/** Topology container role (frame role) → the de-band level that dissolves it. */
export const DEBAND_LEVEL_BY_TOPOLOGY_ROLE: Record<
  "subnetZone" | "vpc" | "region" | "account" | "provider",
  Exclude<DeBandLevel, "none">
> = {
  subnetZone: "subnet",
  vpc: "vpc",
  region: "region",
  account: "account",
  provider: "provider",
};

/** Depth rank of a topology container role (subnetZone = 5 … provider = 1). */
export function topologyRoleDeBandRank(
  role: "subnetZone" | "vpc" | "region" | "account" | "provider",
): number {
  return DEBAND_LEVEL_RANK[DEBAND_LEVEL_BY_TOPOLOGY_ROLE[role]];
}

/** The RCLL layout flags a profile resolves to. Column packing is the existing
 * tri-state and de-band depth is an ordered enum; the rest are booleans. This is the
 * exact set the dialog owns as `pipeline*` state and the engine consumes via
 * `LayoutSceneContext`. */
export type RcllLayoutProfileFlags = {
  swimlaneLaneRise: boolean;
  rankSeparate: boolean;
  deBandLevel: DeBandLevel;
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
 *   de-band at `subnet` (≈ −28% height), cycle-rise, column compaction (pull-left), plus
 *   ordering + straighten for legibility under the denser packing.
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
        deBandLevel: "none",
        staircaseBandOverlap: false,
        reorder: true,
        straighten: true,
        columnPacking: "none",
      };
    case "compact":
      return {
        swimlaneLaneRise: true,
        rankSeparate: true,
        deBandLevel: "subnet",
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
        deBandLevel: "none",
        staircaseBandOverlap: true,
        reorder: false,
        straighten: false,
        columnPacking: "none",
      };
  }
}
