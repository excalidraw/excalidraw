import { SHAPES, SELECTION_TOOLS, getToolbarTools } from "../components/shapes";

import type { AppClassProperties } from "../types";

const createMockApp = (
  preferredSelectionType: "selection" | "lasso",
): AppClassProperties =>
  ({
    state: {
      preferredSelectionTool: { type: preferredSelectionType },
    },
  } as unknown as AppClassProperties);

describe("getToolbarTools", () => {
  it("should return original SHAPES when preferred selection tool is 'selection'", () => {
    const app = createMockApp("selection");
    const result = getToolbarTools(app);

    expect(result).toEqual(SHAPES);
  });

  it("should preserve all entries when preferred selection tool is 'lasso'", () => {
    const app = createMockApp("lasso");
    const result = getToolbarTools(app);

    expect(result.length).toBe(SHAPES.length);
  });

  it("should keep hand tool as first entry when preferred selection tool is 'lasso'", () => {
    const app = createMockApp("lasso");
    const result = getToolbarTools(app);

    expect(result[0].value).toBe("hand");
  });

  it("should replace selection with lasso when preferred selection tool is 'lasso'", () => {
    const app = createMockApp("lasso");
    const result = getToolbarTools(app);

    const lassoEntry = result.find((s) => s.value === "lasso");
    const selectionEntry = result.find((s) => s.value === "selection");

    expect(lassoEntry).toBeDefined();
    expect(selectionEntry).toBeUndefined();
    expect(lassoEntry!.icon).toBe(
      SELECTION_TOOLS.find((t) => t.type === "lasso")!.icon,
    );
  });

  it("should preserve key and numericKey from original selection entry", () => {
    const app = createMockApp("lasso");
    const result = getToolbarTools(app);

    const original = SHAPES.find((s) => s.value === "selection")!;
    const lassoEntry = result.find((s) => s.value === "lasso")!;

    expect(lassoEntry.key).toBe(original.key);
    expect(lassoEntry.numericKey).toBe(original.numericKey);
  });

  it("should place lasso at the same index as original selection entry", () => {
    const app = createMockApp("lasso");
    const result = getToolbarTools(app);

    const selectionIndex = SHAPES.findIndex((s) => s.value === "selection");
    expect(result[selectionIndex].value).toBe("lasso");
  });

  it("should not modify other entries when preferred selection tool is 'lasso'", () => {
    const app = createMockApp("lasso");
    const result = getToolbarTools(app);

    const otherOriginal = SHAPES.filter((s) => s.value !== "selection");
    const otherResult = result.filter((s) => s.value !== "lasso");

    expect(otherResult).toEqual(otherOriginal);
  });
});
