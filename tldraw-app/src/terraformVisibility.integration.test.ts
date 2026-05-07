import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { sanitizeShapes } from "./App";
import { expandAllKeys, filterTerraformShapes } from "./terraformVisibility";

const require = createRequire(import.meta.url);

describe("terraformVisibility with backend-rendered tldraw shapes", () => {
  it("shows edges once Terraform keys are expanded", async () => {
    const { runAllplanModulesPipeline } = require(
      "../../packages/backend/terraform/allplan-modules-pipeline.js",
    );
    const renderer = require("../../packages/backend/connectors/tldraw.js");

    const nodes = runAllplanModulesPipeline();
    const result = await renderer.render({ nodes, options: {} });
    const shapes = sanitizeShapes(result.body.shapes);

    const collapsed = filterTerraformShapes(shapes, new Set(), {
      dependencyLayerEnabled: true,
      dataFlowLayerEnabled: true,
    });
    const expanded = filterTerraformShapes(shapes, expandAllKeys(shapes), {
      dependencyLayerEnabled: true,
      dataFlowLayerEnabled: true,
    });

    const collapsedEdgeCount = collapsed.filter((shape) => shape.type === "arrow").length;
    const expandedEdgeCount = expanded.filter((shape) => shape.type === "arrow").length;

    expect(expandedEdgeCount).toBeGreaterThan(0);
    expect(expandedEdgeCount).toBeGreaterThanOrEqual(collapsedEdgeCount);
  });
});
