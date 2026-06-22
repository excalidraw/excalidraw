import React from "react";

import { renderOptionFigure } from "./terraformPipelineSettingsFigures";

import {
  DEBAND_LEVELS,
  type DeBandLevel,
  type PipelineLayoutVariant,
  type RcllLayoutProfile,
  type RcllLayoutProfileSelection,
} from "./terraformImportDialogUtils";

/** Per-option explanation shown in the side panel — the detail a user needs to
 * understand what each choice actually does to the diagram. `dev` names the
 * actual algorithm/papers the option implements (this is a developer menu);
 * custom heuristics are flagged as such rather than attributed to a paper. */
type OptionHelpEntry = {
  title: string;
  body: string;
  dev: { implements: string; refs?: string[] };
};

const OPTION_HELP: Record<string, OptionHelpEntry> = {
  "detail.compact": {
    title: "Detail · Compact",
    body: "Each resource group is drawn as one representative card (the primary resource, e.g. an ECS service standing in for its task definition, target group, etc.). Click a card to expand the resources inside it. Smaller, faster, and easier to scan — you drill in only where you care.",
    dev: {
      implements:
        "Cluster collapse to a primary representative (interactive expand). A detail filter — no layout algorithm.",
    },
  },
  "detail.full": {
    title: "Detail · Full",
    body: "Every resource is drawn as its own card up front — nothing hidden. You see the complete picture immediately, but the diagram is much denser and taller and takes longer to lay out. Use it when you need to see everything at once rather than explore.",
    dev: {
      implements:
        "Fully-expanded clusters. A detail filter — no layout algorithm.",
    },
  },
  "layout.classic": {
    title: "Layout · Classic",
    body: "The original grid engine. Resources sit in left-to-right depth columns (by dataflow distance) and stack into vertical lanes. Predictable, and the only mode you fine-tune with the Height / Resources / Placement controls below.",
    dev: {
      implements:
        "Longest-path (ASAP) layered rank assignment + model-order lane stacking (computeDepths).",
      refs: ["Sugiyama, Tagawa & Toda 1981 — layered framework"],
    },
  },
  "layout.compound": {
    title: "Layout · Compound",
    body: "Same placement as Classic, but each geographic group is wrapped in a labelled, nested frame (provider → account → region → VPC → subnet). Dragging a frame moves everything inside it and reroutes its arrows. Pick this when the nesting matters visually.",
    dev: {
      implements:
        "Compound (clustered) layered layout — Classic ranks drawn inside the topology hull hierarchy, with TFD edges lifted onto hulls.",
      refs: ["Sander 1996 — Layout of Compound Directed Graphs"],
    },
  },
  "layout.v2": {
    title: "Layout · V2 (newest)",
    body: "Packs each geographic group into a compact, near-square block and spills fan-out targets beside their source instead of stacking them below (e.g. us-east-1 → us-west-1/2 + us-east-2 sit next to us-east-1, not in a tall column). It manages height and placement automatically, so those controls don't apply here.",
    dev: {
      implements:
        'Longest-path depth columns + geometric skyline (left-edge) strip packing; pure-sink fan-out bundles spilled rightward to fill the source\'s span — "elastic depth" (custom heuristic, order-safe by construction). Compound hull tree + edge lifting.',
      refs: [
        "Sander 1996 (compound + edge lifting)",
        "Hashimoto & Stevens 1971 (left-edge packing)",
        "Domrös & von Hanxleden 2022 (model-order ties)",
      ],
    },
  },
  "height.stacked": {
    title: "Height · Stacked",
    body: "One box per row. The tallest result, but the easiest to read straight down — nothing shares a row, so vertical position alone tells the story.",
    dev: {
      implements:
        "ASAP longest-path ranks, one lane per vertical band (no packing).",
      refs: ["Sugiyama, Tagawa & Toda 1981"],
    },
  },
  "height.packed": {
    title: "Height · Packed",
    body: "Boxes that don't conflict are slid side by side into the same row (skyline packing), cutting the diagram's height substantially at the cost of a busier layout.",
    dev: {
      implements:
        "Skyline / left-edge track assignment of column-disjoint boxes (placeClustersPackedGrid).",
      refs: [
        "Hashimoto & Stevens 1971 (left-edge)",
        "Baker, Coffman & Rivest 1980 (strip packing)",
      ],
    },
  },
  "height.pullLeft": {
    title: "Height · Packed + pull-left",
    body: "Packing, plus each box is pulled to its leftmost legal column — as early in the dataflow as its dependencies allow. Tightens the diagram horizontally and groups related work, but can lengthen some arrows.",
    dev: {
      implements:
        "1-D leftward compaction — leftmost feasible column via constraint-graph longest path (computePackedPullLeftShifts).",
      refs: ["Liao & Wong 1983 — 1-D compaction"],
    },
  },
  "resources.dataflow": {
    title: "Resources · Dataflow only",
    body: "Draw only resources connected by a .tfd dataflow edge. Keeps the diagram focused on the actual flow; standalone resources (IAM roles, log groups, …) are omitted.",
    dev: {
      implements: "Edge-connectivity content filter — no layout algorithm.",
    },
  },
  "resources.all": {
    title: "Resources · All resources",
    body: "Also draw the unconnected resources, collected into an 'Unconnected' strip per VPC/region so they don't clutter the flow. Primary resources (Lambda, S3, ECS, …) keep their full cluster grouping there — category color, nested satellites, expandable — so the strip is an inventory, not a pile of bare boxes. Works in all three layouts.",
    dev: {
      implements:
        "Ancillary resources grouped into per-region/VPC strips, each card built by the same primary-cluster builder as connected primaries (never the bare fallback). A content filter — no new layout algorithm.",
    },
  },
  "placement.default": {
    title: "Placement · Default",
    body: "Plain packing with no extra adjustment. Boxes in the same account/region may share vertical bands.",
    dev: { implements: "No post-pass on top of the chosen Height packing." },
  },
  "laneheight.stacked": {
    title: "Lane height · Stacked",
    body: "Inside a dependency lane (mutually-dependent accounts that share a left-to-right axis), nested groups stack straight down. Clearest vertically, but taller.",
    dev: {
      implements:
        "Swimlane interiors laid as pure Y-stacked lanes on the shared denseRank(LB) column axis (M3b arrangeSubtreeOnAxis).",
      refs: ["Sander 1996 — compound layout"],
    },
  },
  "laneheight.risen": {
    title: "Lane height · Risen",
    body: "Inside a dependency lane, groups whose columns don't overlap slide up to share a row instead of stacking, reclaiming vertical space. The shared left-to-right axis is kept, so the dataflow still reads forward. On its own the gain is small on dependency-dense presets — its big win is paired with Lane split, which makes more lanes column-disjoint.",
    dev: {
      implements:
        "DEC-1 Y-rise extended to swimlane lanes (M4): each lane's frame is tightened to its content shared-column range while leaf X is preserved (CON-12-safe); X-disjoint lanes share rows via riseStackY.",
      refs: ["Brandes & Köpf 2001 (coordinate assignment)"],
    },
  },
  "ordering.off": {
    title: "Ordering · Off",
    body: "Nodes inside each group stack in declaration order. Simplest, but arrows may cross more than necessary.",
    dev: {
      implements:
        "Within-column leaf order = model order (minDescendantSequence, key). No crossing-reduction pass.",
      refs: ["Sugiyama et al. 1981 (layered drawing)"],
    },
  },
  "ordering.on": {
    title: "Ordering · On",
    body: "Inside each group, nodes are reordered to reduce crossing arrows — a node moves next to the ones it connects to. Only applied when it actually cuts crossings, so it never makes a group worse. On presets whose order is already crossing-optimal (e.g. the staging v2) it finds nothing to change.",
    dev: {
      implements:
        "M6 per-container barycenter reorder with a strict-improve gate (terraformPipelineOrdering.ts): leaves are permuted within their column to minimize a geometric crossing count; accepted only if strictly fewer crossings, else model order. X (columns) untouched — iron rule unaffected.",
      refs: [
        "Sugiyama et al. 1981 (barycenter)",
        "Forster 2005 (crossing reduction)",
      ],
    },
  },
  "crossingmin.off": {
    title: "Cross-container · Off",
    body: "Crossing reduction stays within each group (see Ordering above). Arrows that run between groups keep whatever order the layering produced.",
    dev: {
      implements:
        "crossingMin=false: no global pass. Sibling order = the leaf reorder (if on) or model order. Cross-container long edges are unaddressed (DI-M6-3).",
    },
  },
  "crossingmin.on": {
    title: "Cross-container · On (supersedes Ordering)",
    body: "Reorders whole groups within their parent AND leaves within columns to cut arrows that cross BETWEEN groups — the thing the per-group Ordering pass can't reach. Each candidate order is re-placed and kept only if the actual drawn crossings strictly drop, so it never makes a diagram worse. Pays back the extra crossings that Lane split trades for height (measured −28% on the compact staging preset). Supersedes Ordering when both are on.",
    dev: {
      implements:
        "crossingMin (M6c): container-aware crossing minimization (terraformPipelineRcllCrossingMin.ts). A Sander/Forster hierarchical barycenter PROPOSES a sibling order (lanes within parents + leaves within columns); the candidate is re-placed on a clone and ACCEPTED only if the RENDERED crossing count (box.x/box.y, same kernel as diagnosePipelineScene) strictly drops AND containment/overlap gates don't regress. X never moves ⇒ CON-12 holds by construction; height/width unbounded but reported. Bounded sweeps + eval budget. Supersedes the leaf reorder (terraformPipelineToggleGuards.ts: ordering-conflict-crossing-min-wins).",
      refs: [
        "Sander 1996 (compound crossing reduction)",
        "Forster 2005 (crossing reduction)",
        "Brandes & Köpf 2001 (coordinate assignment)",
      ],
    },
  },
  "deband.depth": {
    title: "De-band depth",
    body: "How deep to dissolve the topology boxes. None keeps every level boxed (tallest, clearest ownership). Pick a level — subnet, VPC, region, account, or provider — and that level AND everything inside it collapse into one shared column stack. De-banding cascades downward: de-banding VPC also de-bands its subnets; provider merges everything. Dissolved membership reads from per-card colored rails + a legend instead of boxes. Subnet and VPC are the clean wins (much shorter, columns intact). Going deeper (region+) merges resources across containers that never shared a column axis, so it reshapes — and usually widens — the diagram; provider on a dense graph overflows into one giant stack. Use the deep levels deliberately.",
    dev: {
      implements:
        "De-band depth: collapseTreeForDeBand collapses at the absorbing parent (subnet→vpc, vpc→region, …, provider→root), lifting ALL descendant leaf clusters to direct children (one shared colCursor stack; X / colByCluster untouched → CON-12-safe at any level). collectClusterLeaves already recurses, so the cascade is automatic. Dissolved frames suppressed (emitTopologyContextFrames skips roles with rank ≥ target); topology paths truncated to the surviving level so edges/connectors reparent cleanly. Membership re-encoded as per-card rails (one per dissolved level) + a legend (terraformPipelineSubnetAnnotation.ts), gate/diagnostic-invisible.",
      refs: [
        "MapSets / BubbleSets (set-membership without overlapping regions)",
      ],
    },
  },
  "lanesplit.off": {
    title: "Lane split · Off",
    body: "Dependent sibling lanes keep their natural columns. Combined with risen lane height they may still overlap and stack. Leave off unless you also want the lane-separation win.",
    dev: {
      implements:
        "rankSeparate=false: denseClusterColumns uses the base longest-path floor; sibling lanes are not pushed into disjoint column ranges.",
    },
  },
  "lanesplit.on": {
    title: "Lane split · On (needs Lane height = Risen)",
    body: "One-way-dependent lanes (regions in an account, VPCs in a region) are pushed into separate columns so risen lanes can pack their height — much shorter (≈ −42% on the staging preset) at the cost of more width and a few more crossings. Only has an effect with Lane height = Risen, so it is disabled until you turn that on.",
    dev: {
      implements:
        "rankSeparate (M8r / DEC-13 / RFC §9.6): whole-model-global Sander base-node layering — one longestPath over the whole-model leaf DAG ∪ all-to-all separation edges per one-way quotient pair (mutual cycles stay co-axial). CON-12 forward by construction. Gated to swimlaneLaneRise (terraformPipelineToggleGuards.ts): alone it is taller + ~+28% width + ~+45% crossings; the height win is only realized once the M4 lane-rise shares the now-disjoint lanes' Y rows.",
      refs: ["Sander 1996 — Layout of Compound Directed Graphs"],
    },
  },
  "straighten.off": {
    title: "Straighten · Off",
    body: "Each group's nodes keep a plain top-down stack.",
    dev: {
      implements: "straighten=false: leaf Y is the naive within-column stack.",
    },
  },
  "straighten.on": {
    title: "Straighten · On",
    body: "Aligns fan-out spines and lifts direct resources into open Y space beside topology lanes where their columns do not overlap, keeping boxes collision-free.",
    dev: {
      implements:
        "straighten (M5): mixed lane/leaf occupancy plus two-sided size-aware Brandes–Köpf coordinate assignment rewrites leaf box.y to align with adjacent-column dataflow neighbours; Y-only, columns + within-column order untouched (CON-12-safe).",
      refs: ["Brandes & Köpf 2001 (coordinate assignment)"],
    },
  },
  "columnpacking.spread": {
    title: "Column packing · Spread",
    body: "Spreads a crowded column by moving independent cards (no dependency edges) one column to the right, making vertical room. Has no effect where every crowded card has a dependency edge — e.g. the staging v2 — because the rule conservatively leaves connected cards alone.",
    dev: {
      implements:
        "deDensify (M5b, Axis-2 B): promotes a SAFE subset of same-floor independent leaves one column right (forward-only, column-preserving ⇒ CON-12-safe). The width dial deDensifyMaxCols defaults to 2 when enabled (terraformPipelineToggleGuards.ts). Measured no-op on v2 (dataflow too dense).",
    },
  },
  "columnpacking.none": {
    title: "Column packing · None (default)",
    body: "Columns keep every card where the dense-rank layering placed it — no spread, no compaction.",
    dev: {
      implements:
        "columnPacking=none: neither deDensify nor columnCompact runs; the dense-rank axis is untouched (OFF byte-identical).",
    },
  },
  "columnpacking.compact": {
    title: "Column packing · Compact",
    body: "Pulls independent cards LEFT into an earlier column's vertical whitespace to shrink the diagram's width, spending vertical room the group already has. A move is kept only when the re-measured group does not grow wider OR taller. Forward-only — never crosses a dependency edge (CON-12-safe).",
    dev: {
      implements:
        "columnCompact (M5c, Axis-2 A): measure-driven greedy leftward column reassignment in arrangeSwimlaneGroup; accepts a move only if re-placing a clone for the trial column map grows neither the hull width nor any inner frame height; empties + re-dense-ranks columns to realize the width win. CON-12 re-verified. Mutually exclusive with Spread.",
      refs: [
        "Rüegg et al. 2016 (1D compaction for smaller graph drawings)",
        "Liao & Wong 1983 (constraint-graph longest path)",
      ],
    },
  },
  "profile.readable": {
    title: "Layout · Readable",
    body: "The clearest, most spread-out arrangement. Mutually-dependent groups stack on their own rows, arrows are ordered to cross less, and fan-out spines are aligned. Tallest of the three — best when you want to follow the dataflow without anything sharing space.",
    dev: {
      implements:
        "Profile bundle: staircaseBandOverlap=false (cycles stack), reorder=on, straighten=on; no width-shrinking passes (laneRise/laneSplit off, deBandLevel=none, columnPacking=none).",
    },
  },
  "profile.balanced": {
    title: "Layout · Balanced (default)",
    body: "Today's default arrangement — a middle ground that keeps cycles compact (sharing rows where columns don't overlap) but applies no other reflow. Selecting it is identical to importing with no layout tuning at all.",
    dev: {
      implements:
        "Profile bundle = the shipped defaults: staircaseBandOverlap=on, everything else off (columnPacking=none). Byte-identical to no profile.",
    },
  },
  "profile.compact": {
    title: "Layout · Compact",
    body: "The smallest overall footprint. Turns on every space-saving pass at once: dependent lanes rise to share rows and split into separate columns, subnet boxes collapse into colored rails, and independent cards are pulled left. It is much shorter — and a bit wider, since splitting lanes trades some width for a lot of height (measured on the staging v2: roughly a third the area, but ~65% shorter and ~30% wider). Densest to read, best when vertical space is tight.",
    dev: {
      implements:
        "Profile bundle: laneRise + laneSplit (the −42% height / +28% width composition) + deBandLevel=subnet (≈ −28% height) + cycle-rise + columnPacking=compact (pull-left), plus reorder + straighten for legibility under the denser packing. Net area on v2 ≈ −55%.",
      refs: [
        "Sander 1996 (compound layout)",
        "Rüegg et al. 2016 (1D compaction)",
      ],
    },
  },
  "profile.custom": {
    title: "Layout · Custom",
    body: "You've adjusted one or more individual passes in Fine-tune below, so the layout no longer matches a named profile. Pick Readable, Balanced, or Compact above to snap back to a preset bundle.",
    dev: {
      implements:
        "Sentinel state: the seven RCLL flags no longer equal any profile's expansion. Re-selecting a profile re-applies its bundle.",
    },
  },
  "cycleheight.risen": {
    title: "Cycle height · Risen (default)",
    body: "Inside a mutually-dependent group, sub-groups whose columns don't overlap share a row instead of stacking — shorter. This is the default.",
    dev: {
      implements:
        "staircaseBandOverlap=true (M3b / DEC-1): X-disjoint cyclic SCC groups rise to share Y via riseStackY on the condensation staircase.",
    },
  },
  "cycleheight.stacked": {
    title: "Cycle height · Stacked",
    body: "Mutually-dependent sub-groups stack vertically in sequence instead of sharing rows — taller, but each group sits on its own row. Turns off a height-saving default.",
    dev: {
      implements:
        "staircaseBandOverlap=false: cyclic SCC groups are placed in sequential disjoint Y bands (no rise). Taller than the default.",
    },
  },
  "placement.semantic": {
    title: "Placement · Semantic",
    body: "Two clean-up passes on top of packing: (1) force each account and region into its own distinct horizontal band so regions never interleave vertically (clearer, but taller), and (2) straighten single-occupant lanes by nudging them toward the one resource that feeds them. It never reorders or overlaps boxes.",
    dev: {
      implements:
        "Forced topology bands + barycenter lane-order crossing reduction (experimental) + scoped lane straightening toward the predecessor centroid (cf. Gansner balance()).",
      refs: [
        "Sugiyama 1981 (barycenter)",
        "Gansner, Koutsofios, North & Vo 1993 (TSE93 balance())",
      ],
    },
  },
};

export type OptionHelpKey = keyof typeof OPTION_HELP;

/** Human labels for the de-band depth `<select>` options. */
const DEBAND_LEVEL_LABELS: Record<DeBandLevel, string> = {
  none: "None — keep every level boxed",
  subnet: "Subnet",
  vpc: "VPC (+ subnets)",
  region: "Region (+ VPCs, subnets)",
  account: "Account (+ regions …)",
  provider: "Provider (everything)",
};

export const TerraformImportPipelineSettings = ({
  pipelineCompact,
  pipelineLayoutVariant,
  pipelinePacked,
  pipelinePackedPullLeft,
  pipelineIncludeAncillary,
  pipelineSemanticPlacement,
  pipelineSwimlaneLaneRise,
  pipelineReorder,
  pipelineCrossingMin,
  pipelineDeBandLevel,
  pipelineRankSeparate,
  pipelineStraighten,
  pipelineColumnPacking,
  pipelineLayoutProfile,
  pipelineStaircaseBandOverlap,
  setPipelineCompact,
  setPipelineLayoutVariant,
  setPipelinePacked,
  setPipelinePackedPullLeft,
  setPipelineIncludeAncillary,
  setPipelineSemanticPlacement,
  setPipelineSwimlaneLaneRise,
  setPipelineReorder,
  setPipelineCrossingMin,
  setPipelineDeBandLevel,
  setPipelineRankSeparate,
  setPipelineStraighten,
  setPipelineColumnPacking,
  setPipelineLayoutProfile,
  setPipelineStaircaseBandOverlap,
  showPlacement = true,
  showVariant = true,
}: {
  pipelineCompact: boolean;
  pipelineLayoutVariant: PipelineLayoutVariant;
  pipelinePacked: boolean;
  pipelinePackedPullLeft: boolean;
  pipelineIncludeAncillary: boolean;
  pipelineSemanticPlacement: boolean;
  pipelineSwimlaneLaneRise: boolean;
  pipelineReorder: boolean;
  pipelineCrossingMin: boolean;
  pipelineDeBandLevel: DeBandLevel;
  pipelineRankSeparate: boolean;
  pipelineStraighten: boolean;
  pipelineColumnPacking: "spread" | "none" | "compact";
  pipelineLayoutProfile: RcllLayoutProfileSelection;
  pipelineStaircaseBandOverlap: boolean;
  setPipelineCompact: (compact: boolean) => void;
  setPipelineLayoutVariant: (variant: PipelineLayoutVariant) => void;
  setPipelinePacked: (packed: boolean) => void;
  setPipelinePackedPullLeft: (pullLeft: boolean) => void;
  setPipelineIncludeAncillary: (includeAncillary: boolean) => void;
  setPipelineSemanticPlacement: (semanticPlacement: boolean) => void;
  setPipelineSwimlaneLaneRise: (swimlaneLaneRise: boolean) => void;
  setPipelineReorder: (reorder: boolean) => void;
  setPipelineCrossingMin: (crossingMin: boolean) => void;
  setPipelineDeBandLevel: (deBandLevel: DeBandLevel) => void;
  setPipelineRankSeparate: (rankSeparate: boolean) => void;
  setPipelineStraighten: (straighten: boolean) => void;
  setPipelineColumnPacking: (
    columnPacking: "spread" | "none" | "compact",
  ) => void;
  setPipelineLayoutProfile: (profile: RcllLayoutProfile) => void;
  setPipelineStaircaseBandOverlap: (staircaseBandOverlap: boolean) => void;
  /** Experimental view hides Placement — Semantic forced-bands competes with its engine. */
  showPlacement?: boolean;
  /** RCLL view hides the Layout variant + Height — it owns placement (M0 delegates to Compound). */
  showVariant?: boolean;
}) => {
  // V2 is a self-contained engine: it pins X to global TFD depth columns and
  // 2-D-packs hulls by construction, so the Height / Resources / Placement
  // controls (all classic/compound-only post-passes) do nothing under it.
  // Hiding them removes dead controls rather than letting the user toggle
  // options the V2 builder ignores.
  const isV2 = pipelineLayoutVariant === "v2";

  // RCLL is the view that hides the Layout-variant control (mirrors the swimlane
  // control's gating); the dialog's `pipelineLayoutVariant` state is NOT "rcll".
  const isRcll = !showVariant;

  // The side panel shows the option being hovered/focused (preview); when the
  // pointer leaves it falls back to the last option clicked (sticky), seeded
  // with the current Layout variant so it is never empty on open.
  const layoutHelpKey = `layout.${pipelineLayoutVariant}` as OptionHelpKey;
  const [hoverKey, setHoverKey] = React.useState<OptionHelpKey | null>(null);
  const [stickyKey, setStickyKey] =
    React.useState<OptionHelpKey>(layoutHelpKey);
  const activeKey = hoverKey ?? stickyKey;
  const activeHelp = OPTION_HELP[activeKey] ?? OPTION_HELP[layoutHelpKey];
  // Decorative before/after schematic for the active option (null for content
  // filters / layout-variant keys that have no geometry to show).
  const activeFigure = renderOptionFigure(activeKey);

  const option = (
    label: string,
    pressed: boolean,
    helpKey: OptionHelpKey,
    onClick: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      className={`TerraformImportModal__segmentedButton${
        pressed ? " TerraformImportModal__segmentedButton--active" : ""
      }`}
      aria-pressed={pressed}
      // `aria-disabled` (not native `disabled`) keeps the button focusable, so
      // the "why is this off?" explanation is reachable by keyboard (Tab) and by
      // hover; only the click action is suppressed (below). Native `disabled`
      // buttons are not focusable, which hides the explanation from keyboard users.
      aria-disabled={disabled || undefined}
      title={OPTION_HELP[helpKey].body}
      onMouseEnter={() => setHoverKey(helpKey)}
      onMouseLeave={() => setHoverKey(null)}
      onFocus={() => setHoverKey(helpKey)}
      onBlur={() => setHoverKey(null)}
      onClick={() => {
        setStickyKey(helpKey);
        if (!disabled) {
          onClick();
        }
      }}
    >
      {label}
    </button>
  );

  // A small uppercase section label that announces the next pipeline phase, so
  // the RCLL controls read top-to-bottom as the order the engine applies them
  // (Sugiyama: content → structure → layer/columns → ordering → coordinate/Y).
  const phaseHeader = (label: string, hint: string) => (
    <div
      className="TerraformImportModal__layoutSettingsGroupHeader"
      aria-hidden="true"
    >
      {label}
      <span>{hint}</span>
    </div>
  );

  // Detail + Resources are the two content filters shared by every layout (RCLL
  // and Classic/Compound/V2), so they are extracted once and placed by branch.
  const detailGroup = (
    <div role="group" aria-label="Pipeline detail level">
      <span className="TerraformImportModal__controlLabel">
        Detail <span>how much of each cluster to draw</span>
      </span>
      <div className="TerraformImportModal__segmentedControl">
        {option("Compact", pipelineCompact, "detail.compact", () =>
          setPipelineCompact(true),
        )}
        {option("Full", !pipelineCompact, "detail.full", () =>
          setPipelineCompact(false),
        )}
      </div>
    </div>
  );

  const resourcesGroup = (
    <div role="group" aria-label="Pipeline resource scope">
      <span className="TerraformImportModal__controlLabel">
        Resources <span>which resources appear in the diagram</span>
      </span>
      <div className="TerraformImportModal__segmentedControl">
        {option(
          "Dataflow only",
          !pipelineIncludeAncillary,
          "resources.dataflow",
          () => setPipelineIncludeAncillary(false),
        )}
        {option(
          "All resources",
          pipelineIncludeAncillary,
          "resources.all",
          () => setPipelineIncludeAncillary(true),
        )}
      </div>
    </div>
  );

  return (
    <div className="TerraformImportModal__layoutSettings">
      <div className="TerraformImportModal__layoutSettingsHeader">
        <strong>Pipeline settings</strong>
        <span>Fine-tune how the dataflow diagram is arranged.</span>
      </div>
      <div className="TerraformImportModal__layoutSettingsBody">
        <div className="TerraformImportModal__layoutSettingsGrid">
          {isRcll ? (
            // RCLL owns placement. PRIMARY: pick a plain-outcome "Layout" profile.
            // ADVANCED (collapsed): the individual Sugiyama passes for A/B work —
            // touching any of them flips the profile control to "Custom".
            <>
              {phaseHeader("Content", "how much to draw")}
              {detailGroup}
              {phaseHeader("Layout", "height ↔ width ↔ readability")}
              <div role="group" aria-label="Pipeline layout profile">
                <span className="TerraformImportModal__controlLabel">
                  Layout{" "}
                  <span>pick the trade — adjust passes below to tune</span>
                </span>
                <div className="TerraformImportModal__segmentedControl">
                  {option(
                    "Readable",
                    pipelineLayoutProfile === "readable",
                    "profile.readable",
                    () => setPipelineLayoutProfile("readable"),
                  )}
                  {option(
                    "Balanced",
                    pipelineLayoutProfile === "balanced",
                    "profile.balanced",
                    () => setPipelineLayoutProfile("balanced"),
                  )}
                  {option(
                    "Compact",
                    pipelineLayoutProfile === "compact",
                    "profile.compact",
                    () => setPipelineLayoutProfile("compact"),
                  )}
                  {pipelineLayoutProfile === "custom" &&
                    // Non-clickable badge: surfaces the active "Custom" state once an
                    // advanced lever is touched. Click a profile above to leave it.
                    option("Custom", true, "profile.custom", () => {}, true)}
                </div>
              </div>
              <details className="TerraformImportModal__advancedDisclosure">
                <summary className="TerraformImportModal__advancedSummary">
                  Fine-tune layout (advanced) — individual passes
                </summary>
                <div className="TerraformImportModal__controlNote">
                  Each control is one pass of the layout engine, in the order it
                  applies. Changing any of them switches Layout to “Custom”.
                </div>
                {phaseHeader("Content", "which resources appear")}
                {resourcesGroup}
                {phaseHeader("Structure", "the model")}
                <div role="group" aria-label="Pipeline de-band depth">
                  <span className="TerraformImportModal__controlLabel">
                    De-band depth{" "}
                    <span>
                      dissolve a level + everything inside it into one stack
                    </span>
                  </span>
                  <select
                    className="TerraformImportModal__select"
                    aria-label="De-band depth"
                    value={pipelineDeBandLevel}
                    title={OPTION_HELP["deband.depth"].body}
                    onMouseEnter={() => setHoverKey("deband.depth")}
                    onMouseLeave={() => setHoverKey(null)}
                    onFocus={() => {
                      setHoverKey("deband.depth");
                      setStickyKey("deband.depth");
                    }}
                    onBlur={() => setHoverKey(null)}
                    onChange={(e) =>
                      setPipelineDeBandLevel(e.target.value as DeBandLevel)
                    }
                  >
                    {DEBAND_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {DEBAND_LEVEL_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </div>
                {phaseHeader("Columns", "left → right placement (X)")}
                <div role="group" aria-label="Pipeline column packing">
                  <span className="TerraformImportModal__controlLabel">
                    Column packing <span>spread or compact columns</span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option(
                      "Spread",
                      pipelineColumnPacking === "spread",
                      "columnpacking.spread",
                      () => setPipelineColumnPacking("spread"),
                    )}
                    {option(
                      "None",
                      pipelineColumnPacking === "none",
                      "columnpacking.none",
                      () => setPipelineColumnPacking("none"),
                    )}
                    {option(
                      "Compact",
                      pipelineColumnPacking === "compact",
                      "columnpacking.compact",
                      () => setPipelineColumnPacking("compact"),
                    )}
                  </div>
                </div>
                {phaseHeader("Ordering", "reduce crossing arrows")}
                <div role="group" aria-label="Pipeline ordering">
                  <span className="TerraformImportModal__controlLabel">
                    Ordering <span>reduce crossing arrows within groups</span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option("Off", !pipelineReorder, "ordering.off", () =>
                      setPipelineReorder(false),
                    )}
                    {option("On", pipelineReorder, "ordering.on", () =>
                      setPipelineReorder(true),
                    )}
                  </div>
                </div>
                {/* Cross-container is NESTED under Ordering: it is the hierarchical
                    superset of the per-group reorder (reorders whole groups within
                    their parent, not just leaves within a column), so it reads as
                    "extend the crossing-min across group boundaries". When On it
                    supersedes the leaf reorder (the toggle guard makes it win). */}
                <div
                  role="group"
                  aria-label="Pipeline cross-container crossing-min"
                  className="TerraformImportModal__nestedControl"
                >
                  <span className="TerraformImportModal__controlLabel">
                    Cross-container{" "}
                    <span>
                      cut crossings between groups (supersedes Ordering)
                    </span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option(
                      "Off",
                      !pipelineCrossingMin,
                      "crossingmin.off",
                      () => setPipelineCrossingMin(false),
                    )}
                    {option("On", pipelineCrossingMin, "crossingmin.on", () =>
                      setPipelineCrossingMin(true),
                    )}
                  </div>
                </div>
                {phaseHeader("Vertical", "top → down placement (Y)")}
                <div role="group" aria-label="Pipeline lane height">
                  <span className="TerraformImportModal__controlLabel">
                    Lane height <span>height of mutually-dependent groups</span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option(
                      "Stacked",
                      !pipelineSwimlaneLaneRise,
                      "laneheight.stacked",
                      () => {
                        // Footgun guard: Lane split is only valid with risen lane
                        // height, so turning the rise off also clears it (it would
                        // otherwise be a stale, suppressed On).
                        setPipelineSwimlaneLaneRise(false);
                        setPipelineRankSeparate(false);
                      },
                    )}
                    {option(
                      "Risen",
                      pipelineSwimlaneLaneRise,
                      "laneheight.risen",
                      () => setPipelineSwimlaneLaneRise(true),
                    )}
                  </div>
                </div>
                {/* Lane split is NESTED under Lane height: it is a sub-choice that
                    only does something once Lane height = Risen. Indented + an
                    always-visible prerequisite line make the dependency structural
                    (not a silent grey-out the user has to discover). */}
                <div
                  role="group"
                  aria-label="Pipeline lane split"
                  className="TerraformImportModal__nestedControl"
                >
                  <span className="TerraformImportModal__controlLabel">
                    Lane split{" "}
                    <span>
                      {pipelineSwimlaneLaneRise
                        ? "split dependent lanes into separate columns"
                        : "needs Lane height = Risen (above) — off until then"}
                    </span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option("Off", !pipelineRankSeparate, "lanesplit.off", () =>
                      setPipelineRankSeparate(false),
                    )}
                    {option(
                      "On",
                      pipelineRankSeparate,
                      "lanesplit.on",
                      () => setPipelineRankSeparate(true),
                      // Footgun guard: lane split alone is taller + wider; the win
                      // exists only composed with the risen lane height (M4).
                      !pipelineSwimlaneLaneRise,
                    )}
                  </div>
                </div>
                <div role="group" aria-label="Pipeline cycle height">
                  <span className="TerraformImportModal__controlLabel">
                    Cycle height{" "}
                    <span>height of mutually-dependent cycles</span>
                  </span>
                  {/* Button order matches Lane height (Stacked, Risen) so the two
                      height levers read as the same control at different scopes. */}
                  <div className="TerraformImportModal__segmentedControl">
                    {option(
                      "Stacked",
                      !pipelineStaircaseBandOverlap,
                      "cycleheight.stacked",
                      () => setPipelineStaircaseBandOverlap(false),
                    )}
                    {option(
                      "Risen",
                      pipelineStaircaseBandOverlap,
                      "cycleheight.risen",
                      () => setPipelineStaircaseBandOverlap(true),
                    )}
                  </div>
                </div>
                <div role="group" aria-label="Pipeline straighten">
                  <span className="TerraformImportModal__controlLabel">
                    Straighten <span>align and lift direct resources</span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option("Off", !pipelineStraighten, "straighten.off", () =>
                      setPipelineStraighten(false),
                    )}
                    {option("On", pipelineStraighten, "straighten.on", () =>
                      setPipelineStraighten(true),
                    )}
                  </div>
                </div>
              </details>
            </>
          ) : (
            // Classic / Compound / V2: the original flat order (no phases — these
            // engines expose Layout / Height / Placement, not the RCLL passes).
            <>
              {detailGroup}
              <div role="group" aria-label="Pipeline layout variant">
                <span className="TerraformImportModal__controlLabel">
                  Layout{" "}
                  <span>which placement engine arranges the diagram</span>
                </span>
                <div className="TerraformImportModal__segmentedControl">
                  {option(
                    "Classic",
                    pipelineLayoutVariant === "classic",
                    "layout.classic",
                    () => setPipelineLayoutVariant("classic"),
                  )}
                  {option(
                    "Compound",
                    pipelineLayoutVariant === "compound",
                    "layout.compound",
                    () => setPipelineLayoutVariant("compound"),
                  )}
                  {option(
                    "V2",
                    pipelineLayoutVariant === "v2",
                    "layout.v2",
                    () => setPipelineLayoutVariant("v2"),
                  )}
                </div>
              </div>
              {isV2 && (
                <div className="TerraformImportModal__controlNote">
                  V2 arranges height, packing, and placement automatically. Only
                  the Detail and Resources toggles apply.
                </div>
              )}
              {!isV2 && (
                <div role="group" aria-label="Pipeline height packing">
                  <span className="TerraformImportModal__controlLabel">
                    Height <span>trade vertical height for width</span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option(
                      "Stacked",
                      !pipelinePacked,
                      "height.stacked",
                      () => {
                        setPipelinePacked(false);
                        setPipelinePackedPullLeft(false);
                      },
                    )}
                    {option(
                      "Packed",
                      pipelinePacked && !pipelinePackedPullLeft,
                      "height.packed",
                      () => {
                        setPipelinePacked(true);
                        setPipelinePackedPullLeft(false);
                      },
                    )}
                    {option(
                      "Packed + pull-left",
                      pipelinePacked && pipelinePackedPullLeft,
                      "height.pullLeft",
                      () => {
                        setPipelinePacked(true);
                        setPipelinePackedPullLeft(true);
                      },
                    )}
                  </div>
                </div>
              )}
              {resourcesGroup}
              {!isV2 && showPlacement && (
                <div role="group" aria-label="Pipeline semantic placement">
                  <span className="TerraformImportModal__controlLabel">
                    Placement <span>nesting-aware band &amp; arrow tuning</span>
                  </span>
                  <div className="TerraformImportModal__segmentedControl">
                    {option(
                      "Default",
                      !pipelineSemanticPlacement,
                      "placement.default",
                      () => setPipelineSemanticPlacement(false),
                    )}
                    {option(
                      "Semantic",
                      pipelineSemanticPlacement,
                      "placement.semantic",
                      () => setPipelineSemanticPlacement(true),
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <aside
          className="TerraformImportModal__layoutHelp"
          aria-live="polite"
          aria-label="Option explanation"
        >
          <strong className="TerraformImportModal__layoutHelpTitle">
            {activeHelp.title}
          </strong>
          {activeFigure && (
            <div className="TerraformImportModal__layoutHelpFigure">
              {activeFigure}
            </div>
          )}
          <p className="TerraformImportModal__layoutHelpBody">
            {activeHelp.body}
          </p>
          <div className="TerraformImportModal__layoutHelpDev">
            <span className="TerraformImportModal__layoutHelpDevLabel">
              Implements
            </span>
            <span className="TerraformImportModal__layoutHelpDevText">
              {activeHelp.dev.implements}
            </span>
            {activeHelp.dev.refs && activeHelp.dev.refs.length > 0 && (
              <span className="TerraformImportModal__layoutHelpDevRefs">
                {activeHelp.dev.refs.join(" · ")}
              </span>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
