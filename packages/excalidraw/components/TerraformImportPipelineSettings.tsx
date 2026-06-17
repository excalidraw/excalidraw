import React from "react";

import type { PipelineLayoutVariant } from "./terraformImportDialogUtils";

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

type OptionHelpKey = keyof typeof OPTION_HELP;

export const TerraformImportPipelineSettings = ({
  pipelineCompact,
  pipelineLayoutVariant,
  pipelinePacked,
  pipelinePackedPullLeft,
  pipelineIncludeAncillary,
  pipelineSemanticPlacement,
  setPipelineCompact,
  setPipelineLayoutVariant,
  setPipelinePacked,
  setPipelinePackedPullLeft,
  setPipelineIncludeAncillary,
  setPipelineSemanticPlacement,
  showPlacement = true,
  showVariant = true,
}: {
  pipelineCompact: boolean;
  pipelineLayoutVariant: PipelineLayoutVariant;
  pipelinePacked: boolean;
  pipelinePackedPullLeft: boolean;
  pipelineIncludeAncillary: boolean;
  pipelineSemanticPlacement: boolean;
  setPipelineCompact: (compact: boolean) => void;
  setPipelineLayoutVariant: (variant: PipelineLayoutVariant) => void;
  setPipelinePacked: (packed: boolean) => void;
  setPipelinePackedPullLeft: (pullLeft: boolean) => void;
  setPipelineIncludeAncillary: (includeAncillary: boolean) => void;
  setPipelineSemanticPlacement: (semanticPlacement: boolean) => void;
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

  // The side panel shows the option being hovered/focused (preview); when the
  // pointer leaves it falls back to the last option clicked (sticky), seeded
  // with the current Layout variant so it is never empty on open.
  const layoutHelpKey = `layout.${pipelineLayoutVariant}` as OptionHelpKey;
  const [hoverKey, setHoverKey] = React.useState<OptionHelpKey | null>(null);
  const [stickyKey, setStickyKey] =
    React.useState<OptionHelpKey>(layoutHelpKey);
  const activeHelp =
    OPTION_HELP[hoverKey ?? stickyKey] ?? OPTION_HELP[layoutHelpKey];

  const option = (
    label: string,
    pressed: boolean,
    helpKey: OptionHelpKey,
    onClick: () => void,
  ) => (
    <button
      type="button"
      className={`TerraformImportModal__segmentedButton${
        pressed ? " TerraformImportModal__segmentedButton--active" : ""
      }`}
      aria-pressed={pressed}
      title={OPTION_HELP[helpKey].body}
      onMouseEnter={() => setHoverKey(helpKey)}
      onMouseLeave={() => setHoverKey(null)}
      onFocus={() => setHoverKey(helpKey)}
      onBlur={() => setHoverKey(null)}
      onClick={() => {
        setStickyKey(helpKey);
        onClick();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="TerraformImportModal__layoutSettings">
      <div className="TerraformImportModal__layoutSettingsHeader">
        <strong>Pipeline settings</strong>
        <span>Fine-tune how the dataflow diagram is arranged.</span>
      </div>
      <div className="TerraformImportModal__layoutSettingsBody">
        <div className="TerraformImportModal__layoutSettingsGrid">
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
          {showVariant && (
            <div role="group" aria-label="Pipeline layout variant">
              <span className="TerraformImportModal__controlLabel">
                Layout <span>which placement engine arranges the diagram</span>
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
                {option("V2", pipelineLayoutVariant === "v2", "layout.v2", () =>
                  setPipelineLayoutVariant("v2"),
                )}
              </div>
            </div>
          )}
          {isV2 && (
            <div className="TerraformImportModal__controlNote">
              V2 arranges height, packing, and placement automatically. Only the
              Detail and Resources toggles apply.
            </div>
          )}
          {!showVariant && (
            <div className="TerraformImportModal__controlNote">
              RCLL arranges layout automatically (M0 delegates to Compound).
              Only the Detail and Resources toggles apply.
            </div>
          )}
          {!isV2 && showVariant && (
            <div role="group" aria-label="Pipeline height packing">
              <span className="TerraformImportModal__controlLabel">
                Height <span>trade vertical height for width</span>
              </span>
              <div className="TerraformImportModal__segmentedControl">
                {option("Stacked", !pipelinePacked, "height.stacked", () => {
                  setPipelinePacked(false);
                  setPipelinePackedPullLeft(false);
                })}
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
        </div>
        <aside
          className="TerraformImportModal__layoutHelp"
          aria-live="polite"
          aria-label="Option explanation"
        >
          <strong className="TerraformImportModal__layoutHelpTitle">
            {activeHelp.title}
          </strong>
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
