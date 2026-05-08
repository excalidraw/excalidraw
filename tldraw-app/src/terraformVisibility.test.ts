import { describe, expect, it } from "vitest";
import type { TLShapePartial } from "tldraw";
import {
  collapseAllKeys,
  expandAllKeys,
  filterTerraformShapes,
  getSelectedExplodeTriggerKey,
  getSelectedExplodeTriggerKeys,
  toggleExpandedKey,
} from "./terraformVisibility";

function resourceShape(
  id: string,
  key: string,
  initiallyVisible: boolean,
  parents: string[] = [],
): TLShapePartial {
  return {
    id: `shape:${id}`,
    type: "geo",
    x: 0,
    y: 0,
    props: {
      geo: "rectangle",
      w: 100,
      h: 40,
      color: "grey",
      fill: "semi",
      dash: "solid",
      size: "m",
    },
    meta: {
      terraformVisibilityRole: "resource",
      terraformVisibilityKey: key,
      terraformInitiallyVisible: initiallyVisible,
      terraformNodeKind: "resource",
      terraformExplodeParentKeys: parents,
    },
  };
}

function edgeShape(
  id: string,
  layer: "dependency" | "dataFlow",
  source: string,
  target: string,
): TLShapePartial {
  return {
    id: `shape:${id}`,
    type: "arrow",
    x: 0,
    y: 0,
    props: {
      start: { x: 0, y: 0 },
      end: { x: 10, y: 10 },
      bend: 0,
      color: "grey",
      fill: "none",
      dash: "solid",
      size: "m",
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
    },
    meta: {
      terraformEdgeLayer: layer,
      relationship: { source, target },
    },
  };
}

describe("terraformVisibility", () => {
  it("expands and collapses children and filters edge layers", () => {
    const root = resourceShape("root", "root", true);
    const child = resourceShape("child", "child", false, ["root"]);
    const grandchild = resourceShape("grandchild", "grandchild", false, ["child"]);
    const dependency = edgeShape("dep", "dependency", "root", "child");
    const dataFlow = edgeShape("flow", "dataFlow", "root", "child");
    const shapes = [root, child, grandchild, dependency, dataFlow];

    let expanded = collapseAllKeys();
    let visible = filterTerraformShapes(shapes, expanded, {
      dependencyLayerEnabled: true,
      dataFlowLayerEnabled: true,
    });
    expect(visible.some((shape) => shape.id === child.id)).toBe(false);
    expect(visible.some((shape) => shape.id === dependency.id)).toBe(false);

    expanded = toggleExpandedKey(shapes, expanded, "root");
    visible = filterTerraformShapes(shapes, expanded, {
      dependencyLayerEnabled: true,
      dataFlowLayerEnabled: false,
    });
    expect(visible.some((shape) => shape.id === child.id)).toBe(true);
    expect(visible.some((shape) => shape.id === dependency.id)).toBe(true);
    expect(visible.some((shape) => shape.id === dataFlow.id)).toBe(false);

    expanded = toggleExpandedKey(shapes, expanded, "child");
    visible = filterTerraformShapes(shapes, expanded, {
      dependencyLayerEnabled: true,
      dataFlowLayerEnabled: true,
    });
    expect(visible.some((shape) => shape.id === grandchild.id)).toBe(true);

    expanded = expandAllKeys(shapes);
    expect(expanded.has("root")).toBe(true);
    expect(expanded.has("child")).toBe(true);
  });

  it("resolves selected explode trigger key from selected shapes", () => {
    const shape = resourceShape("selected", "module.lambda", true);
    const child = resourceShape("child", "module.lambda.child", false, [
      "module.lambda",
    ]);
    const key = getSelectedExplodeTriggerKey([shape], [shape, child]);
    expect(key).toBe("module.lambda");
    const keys = getSelectedExplodeTriggerKeys([shape], [shape, child]);
    expect(keys).toEqual(["module.lambda"]);
  });
});
