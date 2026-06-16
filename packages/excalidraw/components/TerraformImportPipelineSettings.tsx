import React from "react";

import type { PipelineLayoutVariant } from "./terraformImportDialogUtils";

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
}) => {
  // V2 is a self-contained engine: it pins X to global TFD depth columns and
  // 2-D-packs hulls by construction, so the Height / Resources / Placement
  // controls (all classic/compound-only post-passes) do nothing under it.
  // Hiding them removes dead controls rather than letting the user toggle
  // options the V2 builder ignores.
  const isV2 = pipelineLayoutVariant === "v2";
  const option = (
    label: string,
    pressed: boolean,
    onClick: () => void,
    description?: string,
  ) => (
    <button
      type="button"
      className={`TerraformImportModal__segmentedButton${
        pressed ? " TerraformImportModal__segmentedButton--active" : ""
      }`}
      aria-pressed={pressed}
      title={description}
      onClick={onClick}
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
      <div className="TerraformImportModal__layoutSettingsGrid">
        <div role="group" aria-label="Pipeline detail level">
          <span className="TerraformImportModal__controlLabel">
            Detail <span>how much of each cluster to draw</span>
          </span>
          <div className="TerraformImportModal__segmentedControl">
            {option(
              "Compact",
              pipelineCompact,
              () => setPipelineCompact(true),
              "One card per cluster; click a card to expand its resources",
            )}
            {option(
              "Full",
              !pipelineCompact,
              () => setPipelineCompact(false),
              "Draw every resource up front (denser, slower)",
            )}
          </div>
        </div>
        <div role="group" aria-label="Pipeline layout variant">
          <span className="TerraformImportModal__controlLabel">
            Layout <span>which placement engine arranges the diagram</span>
          </span>
          <div className="TerraformImportModal__segmentedControl">
            {option(
              "Classic",
              pipelineLayoutVariant === "classic",
              () => setPipelineLayoutVariant("classic"),
              "Original grid layout; tune it with the Height / Resources / Placement controls below",
            )}
            {option(
              "Compound",
              pipelineLayoutVariant === "compound",
              () => setPipelineLayoutVariant("compound"),
              "Classic layout drawn inside nested provider/region/VPC hull frames",
            )}
            {option(
              "V2",
              pipelineLayoutVariant === "v2",
              () => setPipelineLayoutVariant("v2"),
              "Newest engine: auto-packs hulls into a square, height/placement managed for you",
            )}
          </div>
        </div>
        {isV2 && (
          <div className="TerraformImportModal__controlNote">
            V2 arranges height, packing, and placement automatically. Only the
            Detail toggle applies.
          </div>
        )}
        {!isV2 && (
          <>
            <div role="group" aria-label="Pipeline height packing">
              <span className="TerraformImportModal__controlLabel">
                Height <span>trade vertical height for width</span>
              </span>
              <div className="TerraformImportModal__segmentedControl">
                {option(
                  "Stacked",
                  !pipelinePacked,
                  () => {
                    setPipelinePacked(false);
                    setPipelinePackedPullLeft(false);
                  },
                  "One box per row — tallest, but easiest to follow top-to-bottom",
                )}
                {option(
                  "Packed",
                  pipelinePacked && !pipelinePackedPullLeft,
                  () => {
                    setPipelinePacked(true);
                    setPipelinePackedPullLeft(false);
                  },
                  "Pack boxes side by side to reduce diagram height",
                )}
                {option(
                  "Packed + pull-left",
                  pipelinePacked && pipelinePackedPullLeft,
                  () => {
                    setPipelinePacked(true);
                    setPipelinePackedPullLeft(true);
                  },
                  "Pack boxes and pull clusters to their leftmost valid column",
                )}
              </div>
            </div>
            <div role="group" aria-label="Pipeline resource scope">
              <span className="TerraformImportModal__controlLabel">
                Resources <span>which resources appear in the diagram</span>
              </span>
              <div className="TerraformImportModal__segmentedControl">
                {option(
                  "Dataflow only",
                  !pipelineIncludeAncillary,
                  () => setPipelineIncludeAncillary(false),
                  "Only resources connected by .tfd dataflow edges",
                )}
                {option(
                  "All resources",
                  pipelineIncludeAncillary,
                  () => setPipelineIncludeAncillary(true),
                  "Also draw resources not connected by .tfd dataflow in an Unconnected strip per VPC/region",
                )}
              </div>
            </div>
            {showPlacement && (
              <div role="group" aria-label="Pipeline semantic placement">
                <span className="TerraformImportModal__controlLabel">
                  Placement <span>nesting-aware band & arrow tuning</span>
                </span>
                <div className="TerraformImportModal__segmentedControl">
                  {option(
                    "Default",
                    !pipelineSemanticPlacement,
                    () => setPipelineSemanticPlacement(false),
                    "Plain packing with no extra band/arrow adjustment",
                  )}
                  {option(
                    "Semantic",
                    pipelineSemanticPlacement,
                    () => setPipelineSemanticPlacement(true),
                    "Nesting-aware placement: force distinct account/region bands and straighten dataflow arrows",
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
