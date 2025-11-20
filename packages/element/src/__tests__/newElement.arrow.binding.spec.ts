import { describe, it, expect } from "vitest";
import { newElement, newArrowElement } from "../newElement";
import type { ExcalidrawArrowElement } from "../types";
import type { LocalPoint } from "@excalidraw/math";

// helper para criar LocalPoint válido
const lp = (x: number, y: number): LocalPoint => [x, y] as LocalPoint;

describe("newArrowElement - preserves bindings when recreating", () => {
  it("should preserve startBinding and endBinding when recreating a bound arrow", () => {
    const rectA = newElement({ type: "rectangle", x: 0, y: 0 });
    const rectB = newElement({ type: "rectangle", x: 100, y: 0 });

    const startBinding = { elementId: rectA.id, focus: 0.5, gap: 0 };
    const endBinding = { elementId: rectB.id, focus: 0.5, gap: 0 };

    const original = newArrowElement({
      type: "arrow",
      x: 10,
      y: 10,
      points: [lp(0, 0), lp(90, 0)], // ✅ agora é LocalPoint
      startBinding,
      endBinding,
      startArrowhead: "arrow",
      endArrowhead: "arrow",
    }) as ExcalidrawArrowElement;

    const recreated = newArrowElement({
      type: "arrow",
      x: original.x,
      y: original.y,
      points: original.points,
      elbowed: false,
      startArrowhead: original.startArrowhead,
      endArrowhead: original.endArrowhead,
      startBinding: original.startBinding,
      endBinding: original.endBinding,
    }) as ExcalidrawArrowElement;

    expect(recreated.startBinding).toEqual(original.startBinding);
    expect(recreated.endBinding).toEqual(original.endBinding);
  });

  it("should default bindings to null when not provided", () => {
    const arrow = newArrowElement({
      type: "arrow",
      x: 0,
      y: 0,
      points: [lp(0, 0), lp(10, 10)], // ✅ corrigido
    }) as ExcalidrawArrowElement;

    expect(arrow.startBinding).toBeNull();
    expect(arrow.endBinding).toBeNull();
  });
});
