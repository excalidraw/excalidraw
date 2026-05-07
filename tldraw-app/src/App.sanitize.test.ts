import { describe, expect, it } from "vitest";
import type { TLShapePartial } from "tldraw";
import { orderShapesForRender, sanitizeShapes } from "./App";

describe("sanitizeShapes", () => {
  it("preserves arrow kind so edges remain renderable", () => {
    const input: TLShapePartial[] = [
      {
        id: "shape:edge-1",
        type: "arrow",
        x: 0,
        y: 0,
        props: {
          kind: "arc",
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
          bend: 0,
          color: "grey",
          fill: "none",
          dash: "solid",
          size: "m",
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
        },
      } as TLShapePartial,
    ];

    const [edge] = sanitizeShapes(input);
    expect(edge.type).toBe("arrow");
    expect((edge.props as Record<string, unknown>).kind).toBe("arc");
  });

  it("defaults arrow kind to arc when missing", () => {
    const input: TLShapePartial[] = [
      {
        id: "shape:edge-2",
        type: "arrow",
        x: 0,
        y: 0,
        props: {
          start: { x: 0, y: 0 },
          end: { x: 100, y: 100 },
        },
      } as TLShapePartial,
    ];

    const [edge] = sanitizeShapes(input);
    expect(edge.type).toBe("arrow");
    expect((edge.props as Record<string, unknown>).kind).toBe("arc");
  });

  it("keeps arrows after non-arrow shapes for visibility", () => {
    const input: TLShapePartial[] = [
      {
        id: "shape:edge",
        type: "arrow",
        x: 0,
        y: 0,
        props: {
          kind: "arc",
          start: { x: 0, y: 0 },
          end: { x: 10, y: 10 },
        },
      } as TLShapePartial,
      {
        id: "shape:node",
        type: "geo",
        x: 20,
        y: 20,
        props: {
          geo: "rectangle",
          w: 100,
          h: 40,
          color: "grey",
          fill: "semi",
          dash: "solid",
          size: "m",
        },
      } as TLShapePartial,
    ];

    const sanitized = sanitizeShapes(input);
    const ordered = orderShapesForRender(sanitized);

    expect(ordered.at(-1)?.type).toBe("arrow");
  });
});
