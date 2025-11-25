import { describe, it, expect } from "vitest";
import { newElement, newLinearElement } from "../newElement";
import type { ExcalidrawLineElement } from "../types";
import type { LocalPoint } from "@excalidraw/math";

const lp = (x: number, y: number): LocalPoint => [x, y] as LocalPoint;

describe("newLinearElement - preserves bindings when recreating", () => {
  it("should preserve startBinding and endBinding when recreating a bound line", () => {
    const rectA = newElement({ type: "rectangle", x: 0, y: 0 });
    const rectB = newElement({ type: "rectangle", x: 100, y: 0 });

    const startBinding = { elementId: rectA.id, focus: 0.5, gap: 0 };
    const endBinding = { elementId: rectB.id, focus: 0.5, gap: 0 };

    const original = newLinearElement({
      type: "line",
      x: 10,
      y: 10,
      points: [lp(0, 0), lp(90, 0)],
      startBinding,
      endBinding,
    }) as ExcalidrawLineElement;

    const recreated = newLinearElement({
      type: "line",
      x: original.x,
      y: original.y,
      points: original.points,
    }) as ExcalidrawLineElement;

    expect(recreated.startBinding).toEqual(original.startBinding);
    expect(recreated.endBinding).toEqual(original.endBinding);
  });
});
