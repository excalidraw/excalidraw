import { describe, expect, it } from "vitest";

import { getTerraformEdgeLayer, getTerraformPersistableElements } from "./terraformVisibility";

describe("terraform persistence", () => {
  it("keeps soft-deleted terraform edges in localStorage payload", () => {
    const rect = {
      id: "rect-1",
      type: "rectangle",
      isDeleted: false,
      customData: { terraform: true, terraformVisibilityRole: "resource" },
    } as any;
    const edge = {
      id: "edge-1",
      type: "arrow",
      isDeleted: true,
      customData: {
        terraform: true,
        terraformEdgeLayer: "dependency",
        relationship: { source: "a", target: "b" },
      },
    } as any;
    const saved = getTerraformPersistableElements([rect, edge]);
    expect(saved).toHaveLength(2);
    expect(saved.some((element) => element.id === "edge-1")).toBe(true);
    expect(getTerraformEdgeLayer(saved[1]!)).toBe("dependency");
  });
});
