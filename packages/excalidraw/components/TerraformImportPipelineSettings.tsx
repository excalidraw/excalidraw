import React from "react";

import type { PipelineLayoutVariant } from "./terraformImportDialogUtils";

export const TerraformImportPipelineSettings = ({
  pipelineCompact,
  pipelineLayoutVariant,
  pipelinePacked,
  pipelinePackedPullLeft,
  setPipelineCompact,
  setPipelineLayoutVariant,
  setPipelinePacked,
  setPipelinePackedPullLeft,
}: {
  pipelineCompact: boolean;
  pipelineLayoutVariant: PipelineLayoutVariant;
  pipelinePacked: boolean;
  pipelinePackedPullLeft: boolean;
  setPipelineCompact: (compact: boolean) => void;
  setPipelineLayoutVariant: (variant: PipelineLayoutVariant) => void;
  setPipelinePacked: (packed: boolean) => void;
  setPipelinePackedPullLeft: (pullLeft: boolean) => void;
}) => {
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
          <span className="TerraformImportModal__controlLabel">Detail</span>
          <div className="TerraformImportModal__segmentedControl">
            {option("Compact", pipelineCompact, () => setPipelineCompact(true))}
            {option("Full", !pipelineCompact, () => setPipelineCompact(false))}
          </div>
        </div>
        <div role="group" aria-label="Pipeline layout variant">
          <span className="TerraformImportModal__controlLabel">Layout</span>
          <div className="TerraformImportModal__segmentedControl">
            {option("Classic", pipelineLayoutVariant === "classic", () =>
              setPipelineLayoutVariant("classic"),
            )}
            {option("Compound", pipelineLayoutVariant === "compound", () =>
              setPipelineLayoutVariant("compound"),
            )}
          </div>
        </div>
        <div role="group" aria-label="Pipeline height packing">
          <span className="TerraformImportModal__controlLabel">Height</span>
          <div className="TerraformImportModal__segmentedControl">
            {option("Stacked", !pipelinePacked, () => {
              setPipelinePacked(false);
              setPipelinePackedPullLeft(false);
            })}
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
      </div>
    </div>
  );
};
