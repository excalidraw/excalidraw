import { pointFrom } from "@excalidraw/math";

import { randomId } from "@excalidraw/common";
import { newLinearElement, newElement } from "@excalidraw/element/newElement";
import { newElementWith } from "@excalidraw/element/mutateElement";

import type { LocalPoint } from "@excalidraw/math";
import type {
  ExcalidrawElement,
  FillStyle,
  GroupId,
} from "@excalidraw/element/types";

interface SolidPresetStyles {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  frameId: string | null;
}

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const makeLineElement = (
  x: number,
  y: number,
  points: LocalPoint[],
  styles: SolidPresetStyles,
  opts: { dashed?: boolean; polygon?: boolean } = {},
) =>
  newLinearElement({
    type: "line",
    x,
    y,
    strokeColor: styles.strokeColor,
    backgroundColor: opts.polygon ? "transparent" : "transparent",
    fillStyle: styles.fillStyle,
    strokeWidth: styles.strokeWidth,
    strokeStyle: opts.dashed ? "dashed" : "solid",
    roughness: styles.roughness,
    opacity: styles.opacity,
    locked: false,
    frameId: styles.frameId,
    points,
    polygon: opts.polygon ?? false,
  });

const makeEllipseElement = (
  x: number,
  y: number,
  width: number,
  height: number,
  styles: SolidPresetStyles,
  opts: { dashed?: boolean } = {},
) =>
  newElement({
    type: "ellipse",
    x,
    y,
    width,
    height,
    strokeColor: styles.strokeColor,
    backgroundColor: "transparent",
    fillStyle: styles.fillStyle,
    strokeWidth: styles.strokeWidth,
    strokeStyle: opts.dashed ? "dashed" : "solid",
    roughness: styles.roughness,
    opacity: styles.opacity,
    locked: false,
    frameId: styles.frameId,
  });

const makeLine = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  styles: SolidPresetStyles,
  dashed = false,
) =>
  makeLineElement(
    x1,
    y1,
    [pointFrom<LocalPoint>(0, 0), pointFrom<LocalPoint>(x2 - x1, y2 - y1)],
    styles,
    { dashed },
  );

function groupElements(elements: ExcalidrawElement[]): {
  elements: ExcalidrawElement[];
  groupId: GroupId;
} {
  const groupId = randomId();
  const grouped = elements.map((el) =>
    newElementWith(el, { groupIds: [groupId] }),
  );
  return { elements: grouped, groupId };
}

// ─── PRISM (rectangular prism / cuboid) ────────────────────────────
function createPrism(bbox: BBox, styles: SolidPresetStyles) {
  const { x, y, w, h } = bbox;
  const d = Math.min(w, h) * 0.25;
  const fw = w - d; // front face width
  const fh = h - d; // front face height

  // Front face (bottom-left) — solid polygon
  const front = makeLineElement(
    x,
    y + d,
    [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(fw, 0),
      pointFrom<LocalPoint>(fw, fh),
      pointFrom<LocalPoint>(0, fh),
      pointFrom<LocalPoint>(0, 0),
    ],
    styles,
    { polygon: true },
  );

  // Back face (top-right) — dashed polygon
  const back = makeLineElement(
    x + d,
    y,
    [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(fw, 0),
      pointFrom<LocalPoint>(fw, fh),
      pointFrom<LocalPoint>(0, fh),
      pointFrom<LocalPoint>(0, 0),
    ],
    styles,
    { polygon: true, dashed: true },
  );

  // Connecting edges: front corners → back corners
  // Front-top-left → Back-top-left (visible)
  const e1 = makeLine(x, y + d, x + d, y, styles, false);
  // Front-top-right → Back-top-right (visible)
  const e2 = makeLine(x + fw, y + d, x + d + fw, y, styles, false);
  // Front-bottom-right → Back-bottom-right (visible)
  const e3 = makeLine(x + fw, y + d + fh, x + d + fw, y + fh, styles, false);
  // Front-bottom-left → Back-bottom-left (hidden)
  const e4 = makeLine(x, y + d + fh, x + d, y + fh, styles, true);

  return groupElements([front, back, e1, e2, e3, e4]);
}

// ─── PYRAMID (quadrilateral pyramid) ───────────────────────────────
function createPyramid(bbox: BBox, styles: SolidPresetStyles) {
  const { x, y, w, h } = bbox;

  // Base rectangle (bottom, in perspective)
  const bw = w * 0.7;
  const bh = h * 0.25;
  const bx = x + (w - bw) / 2;
  const by = y + h - bh;

  const base = makeLineElement(
    bx,
    by,
    [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(bw, 0),
      pointFrom<LocalPoint>(bw, bh),
      pointFrom<LocalPoint>(0, bh),
      pointFrom<LocalPoint>(0, 0),
    ],
    styles,
    { polygon: true },
  );

  // Apex
  const ax = x + w / 2;
  const ay = y;

  // Edges from apex to base corners
  // Front-left (visible)
  const e1 = makeLine(ax, ay, bx, by + bh, styles, false);
  // Front-right (visible)
  const e2 = makeLine(ax, ay, bx + bw, by + bh, styles, false);
  // Back-left (hidden)
  const e3 = makeLine(ax, ay, bx, by, styles, true);
  // Back-right (hidden)
  const e4 = makeLine(ax, ay, bx + bw, by, styles, true);

  return groupElements([base, e1, e2, e3, e4]);
}

// ─── TETRAHEDRON ───────────────────────────────────────────────────
function createTetrahedron(bbox: BBox, styles: SolidPresetStyles) {
  const { x, y, w, h } = bbox;

  // Base triangle (bottom, in perspective)
  const b1x = x + w * 0.1;
  const b1y = y + h;
  const b2x = x + w * 0.9;
  const b2y = y + h;
  const b3x = x + w * 0.5;
  const b3y = y + h * 0.6;

  // Apex
  const ax = x + w * 0.45;
  const ay = y;

  // Visible base edges
  const baseVisible = makeLineElement(
    b1x,
    b1y,
    [
      pointFrom<LocalPoint>(0, 0),
      pointFrom<LocalPoint>(b2x - b1x, b2y - b1y),
      pointFrom<LocalPoint>(b3x - b1x, b3y - b1y),
    ],
    styles,
  );

  // Hidden base edge (back)
  const baseHidden = makeLine(b3x, b3y, b1x, b1y, styles, true);

  // Edges from apex
  const e1 = makeLine(ax, ay, b1x, b1y, styles, false);
  const e2 = makeLine(ax, ay, b2x, b2y, styles, false);
  const e3 = makeLine(ax, ay, b3x, b3y, styles, true); // back edge

  return groupElements([baseVisible, baseHidden, e1, e2, e3]);
}

// ─── CYLINDER ──────────────────────────────────────────────────────
function createCylinder(bbox: BBox, styles: SolidPresetStyles) {
  const { x, y, w, h } = bbox;
  const ellipseH = Math.min(h * 0.2, w * 0.3);

  // Top ellipse (solid)
  const topEllipse = makeEllipseElement(x, y, w, ellipseH, styles);

  // Bottom ellipse (dashed — back half hidden)
  const bottomEllipse = makeEllipseElement(
    x,
    y + h - ellipseH,
    w,
    ellipseH,
    styles,
    { dashed: true },
  );

  // Side lines
  const leftSide = makeLine(
    x,
    y + ellipseH / 2,
    x,
    y + h - ellipseH / 2,
    styles,
    false,
  );
  const rightSide = makeLine(
    x + w,
    y + ellipseH / 2,
    x + w,
    y + h - ellipseH / 2,
    styles,
    false,
  );

  return groupElements([topEllipse, bottomEllipse, leftSide, rightSide]);
}

// ─── SPHERE ────────────────────────────────────────────────────────
function createSphere(bbox: BBox, styles: SolidPresetStyles) {
  const { x, y, w, h } = bbox;
  const size = Math.min(w, h);
  const cx = x + (w - size) / 2;
  const cy = y + (h - size) / 2;

  // Main circle (solid)
  const circle = makeEllipseElement(cx, cy, size, size, styles);

  // Horizontal meridian ellipse (dashed, for 3D feel)
  const meridianH = size * 0.3;
  const meridianY = cy + (size - meridianH) / 2;
  const meridian = makeEllipseElement(cx, meridianY, size, meridianH, styles, {
    dashed: true,
  });

  return groupElements([circle, meridian]);
}

// ─── FACTORY ───────────────────────────────────────────────────────
export function createSolidElements(
  type: string,
  bbox: BBox,
  styles: SolidPresetStyles,
): { elements: ExcalidrawElement[]; groupId: GroupId } {
  switch (type) {
    case "prism":
      return createPrism(bbox, styles);
    case "pyramid":
      return createPyramid(bbox, styles);
    case "tetrahedron":
      return createTetrahedron(bbox, styles);
    case "cylinder":
      return createCylinder(bbox, styles);
    case "sphere":
      return createSphere(bbox, styles);
    default:
      throw new Error(`Unknown solid preset: ${type}`);
  }
}
