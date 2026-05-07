/**
 * First-pass converter: Excalidraw scene JSON -> tldraw shape partials.
 *
 * This is intentionally lossy. The backend produces an Excalidraw scene with
 * fully-resolved layout, hand-tuned styles, custom data, and AWS icon
 * elements. We map the structurally-meaningful subset (rectangles, ellipses,
 * diamonds, text, arrows, lines) onto tldraw default shapes. Image / icon
 * elements are dropped for now; module/group containers become rectangles.
 *
 * When the backend grows a real `connectors/tldraw.js` renderer, this module
 * goes away and the canvas can load tldraw documents directly.
 */
import {
  toRichText,
  type TLShapeId,
  type TLShapePartial,
  type TLDefaultColorStyle,
  createShapeId,
} from "tldraw";

type ExcalidrawElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  points?: Array<[number, number]>;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  isDeleted?: boolean;
  customData?: Record<string, unknown>;
};

export type ExcalidrawScene = {
  type?: string;
  elements?: ExcalidrawElement[];
};

const HEX_TO_TLDRAW: Array<{ test: RegExp; color: TLDefaultColorStyle }> = [
  { test: /^#?(000|111|222|333)/i, color: "black" },
  { test: /^#?(444|555|666|777|888|999|aaa|bbb|ccc)/i, color: "grey" },
  { test: /red|#?(c[0-9a-f]{2}|d[0-9a-f]{2}|e[0-3])/i, color: "red" },
  { test: /orange|#?(f[58]|fa|fb)/i, color: "orange" },
  { test: /yellow|#?(fc|fd|fe|ff[a-c])/i, color: "yellow" },
  { test: /green|#?(0f|2f|3f|4f|5f)/i, color: "green" },
  { test: /violet|purple|#?(9[0-9a-f]|a[0-7])/i, color: "violet" },
  { test: /blue|#?(0[0-9a-f]{2}[5-9a-f]|1[0-9a-f][a-f])/i, color: "blue" },
];

function mapColor(hex: string | undefined): TLDefaultColorStyle {
  if (!hex) return "black";
  for (const { test, color } of HEX_TO_TLDRAW) {
    if (test.test(hex)) return color;
  }
  return "grey";
}

function mapStrokeSize(strokeWidth: number | undefined): "s" | "m" | "l" | "xl" {
  if (!strokeWidth || strokeWidth <= 1) return "s";
  if (strokeWidth <= 2) return "m";
  if (strokeWidth <= 4) return "l";
  return "xl";
}

/** Excalidraw uses CSS-ish alignment; tldraw text shapes expect start/middle/end. */
export function mapExcalidrawTextAlignToTldraw(
  align: ExcalidrawElement["textAlign"] | string | undefined,
): "start" | "middle" | "end" {
  switch (align) {
    case "left":
    case "start":
      return "start";
    case "center":
    case "middle":
      return "middle";
    case "right":
    case "end":
      return "end";
    default:
      return "start";
  }
}

function isContainerElement(el: ExcalidrawElement): boolean {
  if (el.type !== "rectangle") return false;
  const cd = el.customData as { terraform?: boolean; container?: boolean } | undefined;
  return Boolean(cd?.container);
}

/**
 * Walks an Excalidraw scene and returns shape partials ready to feed
 * `editor.createShapes(...)`. A second-pass `idMap` is returned so callers can
 * resolve original Excalidraw ids → tldraw shape ids if they need to wire up
 * arrow bindings later.
 */
export function excalidrawSceneToTldrawShapes(scene: ExcalidrawScene): {
  shapes: TLShapePartial[];
  idMap: Map<string, TLShapeId>;
} {
  const elements = (scene.elements || []).filter((el) => !el.isDeleted);
  const idMap = new Map<string, TLShapeId>();
  for (const el of elements) {
    idMap.set(el.id, createShapeId());
  }

  const shapes: TLShapePartial[] = [];

  for (const el of elements) {
    const id = idMap.get(el.id)!;
    const color = mapColor(el.strokeColor);
    const size = mapStrokeSize(el.strokeWidth);
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    const w = Math.max(1, el.width ?? 1);
    const h = Math.max(1, el.height ?? 1);

    switch (el.type) {
      case "rectangle":
      case "ellipse":
      case "diamond": {
        const geo =
          el.type === "ellipse"
            ? "ellipse"
            : el.type === "diamond"
              ? "diamond"
              : "rectangle";
        shapes.push({
          id,
          type: "geo",
          x,
          y,
          props: {
            geo,
            w,
            h,
            color,
            size,
            fill: isContainerElement(el) ? "none" : "semi",
            dash: "solid",
          },
        });
        break;
      }
      case "text": {
        shapes.push({
          id,
          type: "text",
          x,
          y,
          props: {
            richText: toRichText(el.text ?? ""),
            color,
            size:
              !el.fontSize || el.fontSize <= 14
                ? "s"
                : el.fontSize <= 20
                  ? "m"
                  : el.fontSize <= 32
                    ? "l"
                    : "xl",
            font: "sans",
            textAlign: mapExcalidrawTextAlignToTldraw(el.textAlign),
            autoSize: true,
          },
        });
        break;
      }
      case "arrow":
      case "line": {
        const points = el.points && el.points.length >= 2 ? el.points : null;
        const start = points ? points[0] : [0, 0];
        const end = points ? points[points.length - 1] : [w, h];
        shapes.push({
          id,
          type: "arrow",
          x,
          y,
          props: {
            kind: "arc",
            start: { x: start[0], y: start[1] },
            end: { x: end[0], y: end[1] },
            bend: 0,
            color,
            fill: "none",
            dash: "solid",
            size,
            arrowheadStart: "none",
            arrowheadEnd: el.type === "arrow" ? "arrow" : "none",
            font: "sans",
            richText: toRichText(""),
            labelPosition: 0.5,
            labelColor: color,
            scale: 1,
          },
        });
        break;
      }
      default: {
        // image, freedraw, frame, etc. - drop for now.
        idMap.delete(el.id);
        break;
      }
    }
  }

  return { shapes, idMap };
}
