import { describe, expect, it } from "vitest";

import { buildPipelineDeclaredDataFlowLineSkeletons } from "./terraformPipelineEdges";

describe("buildPipelineDeclaredDataFlowLineSkeletons", () => {
  it("routes straight relay arrows with bend points without adding arrows", () => {
    const arrows = buildPipelineDeclaredDataFlowLineSkeletons(
      { source: {} as never, target: {} as never },
      {
        source: { x: 0, y: 0, width: 100, height: 80 },
        target: { x: 300, y: 220, width: 100, height: 80 },
      },
      [
        {
          source: "source",
          target: "target",
          type: "declared_dataflow",
          label: "declared",
          origin: "tfd",
          detail: "0",
        },
      ],
      { pipelineVerticalSolverMode: "straight-relay" },
    );

    expect(arrows).toHaveLength(1);
    expect(
      (arrows[0] as { points?: readonly unknown[] } | undefined)?.points,
    ).toHaveLength(4);
  });
});
