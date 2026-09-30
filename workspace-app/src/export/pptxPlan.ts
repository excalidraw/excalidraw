/**
 * Scene -> PowerPoint drawing plan. Pure data (no pptxgenjs, no DOM) so the mapping
 * is unit-testable; `pptx.ts` turns the commands into real slide objects.
 *
 * Geometry: 1 Excalidraw px = 1/96 inch, so shapes keep their exact proportions.
 */
export interface Fill {
  color?: string; // hex without '#'
  transparency: number; // 0..100
}
export interface Stroke {
  color: string;
  widthPt: number;
  dash: "solid" | "dash" | "sysDot";
  transparency: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PathPoint =
  | { x: number; y: number; moveTo?: boolean }
  | {
      x: number;
      y: number;
      curve: { type: "cubic"; x1: number; y1: number; x2: number; y2: number };
    }
  | { close: true };

export type Command =
  | ({
      kind: "shape";
      shape: "rect" | "roundRect" | "ellipse" | "diamond";
      fill: Fill;
      stroke: Stroke | null;
      rotate: number;
      radius?: number;
    } & Rect)
  | ({
      kind: "path";
      points: PathPoint[];
      fill: Fill;
      stroke: Stroke | null;
      beginArrow: ArrowType;
      endArrow: ArrowType;
    } & Rect)
  | ({
      kind: "text";
      text: string;
      fontFace: string;
      fontPt: number;
      color: string;
      align: "left" | "center" | "right";
      valign: "top" | "middle" | "bottom";
      lineSpacing: number;
      rotate: number;
      transparency: number;
    } & Rect)
  | ({
      kind: "image";
      fileId: string;
      elementId: string;
      rotate: number;
      flipH: boolean;
      flipV: boolean;
      crop: any | null;
      transparency: number;
    } & Rect);

export type ArrowType =
  | "none"
  | "arrow"
  | "diamond"
  | "oval"
  | "stealth"
  | "triangle";

const px = (n: number) => n / 96;

/** PowerPoint can't embed our fonts, so pick the closest widely-installed face. */
export const FONT_MAP: Record<number, string> = {
  1: "Comic Sans MS", // Virgil
  2: "Arial", // Helvetica
  3: "Consolas", // Cascadia
  5: "Comic Sans MS", // Excalifont
  6: "Calibri", // Nunito
  7: "Impact", // Lilita One
  8: "Consolas", // Comic Shanns
  9: "Arial", // Liberation Sans
  10: "Arial", // Assistant
};

export const toHex = (input: string | undefined | null): string | null => {
  if (!input || input === "transparent") {
    return null;
  }
  const s = input.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) {
    return m[1]!
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase();
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    return m[1]!.toUpperCase();
  }
  m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
  if (m) {
    return [m[1], m[2], m[3]]
      .map((v) => Math.min(255, Number(v)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return null; // named colours never come out of the editor
};

const ARROWHEAD: Record<string, ArrowType> = {
  arrow: "arrow",
  triangle: "triangle",
  triangle_outline: "triangle",
  dot: "oval",
  circle: "oval",
  circle_outline: "oval",
  diamond: "diamond",
  diamond_outline: "diamond",
  bar: "none",
  crowfoot_one: "none",
};

export interface PlanContext {
  /** top-left of the page content in scene coordinates */
  origin: { x: number; y: number };
  /** uniform scale from scene px to slide px */
  scale: number;
  /** slide offset (centering) in slide px */
  offset: { x: number; y: number };
}

const X = (c: PlanContext, sceneX: number) =>
  px((sceneX - c.origin.x) * c.scale + c.offset.x);
const Y = (c: PlanContext, sceneY: number) =>
  px((sceneY - c.origin.y) * c.scale + c.offset.y);
const S = (c: PlanContext, len: number) => px(len * c.scale);

const transparencyOf = (opacity: number | undefined) =>
  Math.max(0, Math.min(100, 100 - (opacity ?? 100)));

const strokeOf = (el: any, c: PlanContext): Stroke | null => {
  const color = toHex(el.strokeColor);
  if (!color || !(el.strokeWidth > 0)) {
    return null;
  }
  return {
    color,
    widthPt: Math.max(0.25, el.strokeWidth * c.scale * 0.75),
    dash:
      el.strokeStyle === "dashed"
        ? "dash"
        : el.strokeStyle === "dotted"
        ? "sysDot"
        : "solid",
    transparency: transparencyOf(el.opacity),
  };
};

const fillOf = (el: any): Fill => {
  const color = toHex(el.backgroundColor);
  if (!color) {
    return { transparency: 100 };
  }
  // hatch / cross-hatch / zigzag have no native PPTX equivalent: approximate with a lighter tint
  const patterned = el.fillStyle && el.fillStyle !== "solid";
  return {
    color,
    transparency: patterned
      ? Math.max(transparencyOf(el.opacity), 55)
      : transparencyOf(el.opacity),
  };
};

const degrees = (rad: number | undefined) =>
  (((((rad ?? 0) * 180) / Math.PI) % 360) + 360) % 360;

/** Catmull-Rom -> cubic Bezier segments through every point (matches Excalidraw's rounded lines). */
export const smoothPath = (pts: Array<[number, number]>): PathPoint[] => {
  const out: PathPoint[] = [{ x: pts[0]![0], y: pts[0]![1], moveTo: true }];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    out.push({
      x: p2[0],
      y: p2[1],
      curve: {
        type: "cubic",
        x1: p1[0] + (p2[0] - p0[0]) / 6,
        y1: p1[1] + (p2[1] - p0[1]) / 6,
        x2: p2[0] - (p3[0] - p1[0]) / 6,
        y2: p2[1] - (p3[1] - p1[1]) / 6,
      },
    });
  }
  return out;
};

const MAX_FREEDRAW_POINTS = 400;

const linearToCommand = (el: any, c: PlanContext): Command | null => {
  const raw: Array<[number, number]> = (el.points ?? []).map((p: number[]) => [
    el.x + p[0]!,
    el.y + p[1]!,
  ]);
  if (raw.length < 2) {
    return null;
  }
  let pts = raw;
  if (el.type === "freedraw" && pts.length > MAX_FREEDRAW_POINTS) {
    const step = Math.ceil(pts.length / MAX_FREEDRAW_POINTS);
    pts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  // slide-space, relative to the shape's own top-left
  const local = pts.map(
    (p) => [S(c, p[0] - minX), S(c, p[1] - minY)] as [number, number],
  );
  const curved =
    el.roundness && !el.elbowed && el.type !== "freedraw" && pts.length >= 3;
  const points: PathPoint[] = curved
    ? smoothPath(local)
    : local.map((p, i) =>
        i === 0 ? { x: p[0], y: p[1], moveTo: true } : { x: p[0], y: p[1] },
      );
  const closed = el.type === "line" && el.polygon;
  if (closed) {
    points.push({ close: true });
  }
  const isArrow = el.type === "arrow";
  return {
    kind: "path",
    x: X(c, minX),
    y: Y(c, minY),
    // zero-size boxes are invalid in OOXML
    w: Math.max(S(c, w), 0.001),
    h: Math.max(S(c, h), 0.001),
    points,
    fill: closed ? fillOf(el) : { transparency: 100 },
    stroke:
      strokeOf(el, c) ??
      (el.type === "freedraw" && toHex(el.strokeColor)
        ? {
            color: toHex(el.strokeColor)!,
            widthPt: 1,
            dash: "solid",
            transparency: 0,
          }
        : null),
    beginArrow: isArrow ? ARROWHEAD[el.startArrowhead ?? ""] ?? "none" : "none",
    endArrow: isArrow ? ARROWHEAD[el.endArrowhead ?? ""] ?? "none" : "none",
  };
};

const textToCommand = (el: any, c: PlanContext): Command | null => {
  if (!el.text || !String(el.text).trim()) {
    return null;
  }
  return {
    kind: "text",
    x: X(c, el.x),
    y: Y(c, el.y),
    w: S(c, el.width),
    h: S(c, el.height),
    text: String(el.text),
    fontFace: FONT_MAP[el.fontFamily] ?? "Arial",
    fontPt: Math.max(1, el.fontSize * c.scale * 0.75),
    color: toHex(el.strokeColor) ?? "000000",
    align:
      el.textAlign === "center"
        ? "center"
        : el.textAlign === "right"
        ? "right"
        : "left",
    valign:
      el.verticalAlign === "middle"
        ? "middle"
        : el.verticalAlign === "bottom"
        ? "bottom"
        : "top",
    // Excalidraw's lineHeight is a multiple of font size; PPT's is a multiple of the font's natural (~1.2) line height
    lineSpacing: (el.lineHeight ?? 1.25) / 1.2,
    rotate: degrees(el.angle),
    transparency: transparencyOf(el.opacity),
  };
};

export const planElement = (el: any, c: PlanContext): Command | null => {
  if (el.isDeleted) {
    return null;
  }
  switch (el.type) {
    case "rectangle": {
      const round = !!el.roundness;
      return {
        kind: "shape",
        shape: round ? "roundRect" : "rect",
        x: X(c, el.x),
        y: Y(c, el.y),
        w: S(c, el.width),
        h: S(c, el.height),
        fill: fillOf(el),
        stroke: strokeOf(el, c),
        rotate: degrees(el.angle),
        ...(round ? { radius: 0.12 } : {}),
      };
    }
    case "ellipse":
    case "diamond":
      return {
        kind: "shape",
        shape: el.type,
        x: X(c, el.x),
        y: Y(c, el.y),
        w: S(c, el.width),
        h: S(c, el.height),
        fill: fillOf(el),
        stroke: strokeOf(el, c),
        rotate: degrees(el.angle),
      };
    case "text":
      return textToCommand(el, c);
    case "line":
    case "arrow":
    case "freedraw":
      return linearToCommand(el, c);
    case "image":
      if (!el.fileId) {
        return null;
      }
      return {
        kind: "image",
        x: X(c, el.x),
        y: Y(c, el.y),
        w: S(c, el.width),
        h: S(c, el.height),
        fileId: el.fileId,
        elementId: el.id,
        rotate: degrees(el.angle),
        flipH: (el.scale?.[0] ?? 1) < 0,
        flipV: (el.scale?.[1] ?? 1) < 0,
        crop: el.crop ?? null,
        transparency: transparencyOf(el.opacity),
      };
    default:
      return null; // frames are slides; embeds/iframes have no PPTX equivalent
  }
};

// ---------------------------------------------------------------- pages

export interface PageSpec {
  name: string;
  /** scene-space rectangle shown on the slide */
  bounds: Rect;
  frameId: string | null;
}

const center = (el: any) => ({
  x: el.x + el.width / 2,
  y: el.y + el.height / 2,
});

/** Elements belonging to a slide: explicit frame children first, then anything whose centre lies inside. */
export const elementsForPage = (elements: readonly any[], page: PageSpec) =>
  elements.filter((el) => {
    if (el.isDeleted || el.type === "frame" || el.type === "magicframe") {
      return false;
    }
    if (page.frameId) {
      if (el.frameId === page.frameId) {
        return true;
      }
      if (el.frameId) {
        return false; // belongs to another frame
      }
    }
    const c = center(el);
    const { x, y, w, h } = page.bounds;
    return c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h;
  });

/** Uniform fit of a page into the deck's slide size (all PPTX slides share one size). */
export const fitPage = (
  page: PageSpec,
  deck: { w: number; h: number },
): PlanContext => {
  const scale = Math.min(deck.w / page.bounds.w, deck.h / page.bounds.h);
  return {
    origin: { x: page.bounds.x, y: page.bounds.y },
    scale,
    offset: {
      x: (deck.w - page.bounds.w * scale) / 2,
      y: (deck.h - page.bounds.h * scale) / 2,
    },
  };
};

export const deckSize = (pages: readonly PageSpec[]) => ({
  w: Math.max(...pages.map((p) => p.bounds.w)),
  h: Math.max(...pages.map((p) => p.bounds.h)),
});

export const planPage = (
  elements: readonly any[],
  page: PageSpec,
  deck: { w: number; h: number },
) => {
  const ctx = fitPage(page, deck);
  const commands: Command[] = [];
  for (const el of elementsForPage(elements, page)) {
    const cmd = planElement(el, ctx);
    if (cmd) {
      commands.push(cmd);
    }
  }
  return commands;
};
